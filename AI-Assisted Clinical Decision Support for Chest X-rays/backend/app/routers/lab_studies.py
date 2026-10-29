from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
import json

from app.core.database import get_db
from app.models.lab_study import LabStudy
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.schemas.lab_study import LabStudyCreate, LabStudyResponse
from app.core.security import FORBIDDEN, ensure_self_or_roles, get_current_user, is_self

router = APIRouter()

@router.post("/", response_model=LabStudyResponse, status_code=status.HTTP_201_CREATED)
def create_lab_study(study: LabStudyCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Verify appointment
    appointment = db.query(Appointment).filter(Appointment.id == study.appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")

    # Only the doctor of this appointment can add lab results.
    if not is_self(current_user, "doctor", appointment.doctor_id):
        raise FORBIDDEN

    # The results list contains Pydantic models. We need to convert them to dicts so JSON works.
    results_json = [param.dict() for param in study.results]

    new_study = LabStudy(
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        appointment_id=appointment.id,
        date=date.today(),
        title=study.title,
        department=study.department,
        status="Tamamlandı",
        results=results_json
    )
    db.add(new_study)
    db.commit()
    db.refresh(new_study)
    
    return _format_response(new_study, db)

@router.get("/patient/{patient_id}", response_model=List[LabStudyResponse])
def get_patient_lab_studies(patient_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "patient", patient_id, "doctor", "admin")
    studies = db.query(LabStudy).filter(LabStudy.patient_id == patient_id).order_by(LabStudy.date.desc()).all()
    return [_format_response(s, db) for s in studies]

def _format_response(study: LabStudy, db: Session) -> dict:
    doctor = db.query(Doctor).filter(Doctor.id == study.doctor_id).first()
    
    return {
        "id": study.id,
        "patient_id": study.patient_id,
        "doctor_id": study.doctor_id,
        "appointment_id": study.appointment_id,
        "date": study.date,
        "title": study.title,
        "department": study.department,
        "status": study.status,
        "results": study.results,
        "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
        "hospital": "Sistem Hastanesi" # Default placeholder since we don't have hospital table yet
    }
