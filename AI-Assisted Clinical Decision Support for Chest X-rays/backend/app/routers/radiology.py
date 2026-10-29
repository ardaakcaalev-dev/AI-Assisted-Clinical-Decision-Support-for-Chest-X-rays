import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.core.database import get_db
from app.models.radiology_study import RadiologyStudy
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.ai_analysis import AIAnalysis
from app.schemas.radiology import RadiologyStudyResponse
from app.core.config import API_BASE_URL, UPLOAD_DIR
from app.core.security import ensure_self_or_roles, get_current_user

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

@router.post("/upload", response_model=RadiologyStudyResponse, status_code=status.HTTP_201_CREATED)
def upload_radiology_study(
    patient_id: int = Form(...),
    doctor_id: int = Form(...),
    appointment_id: int = Form(None),
    title: str = Form(...),
    modality: str = Form(...),
    body_part: str = Form(...),
    report: str = Form(None),
    ai_results: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Only a doctor can upload, and only under their own name.
    ensure_self_or_roles(current_user, "doctor", doctor_id)
    # Verify patient and doctor exist
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
        
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")

    # Create safe filename
    file_extension = os.path.splitext(file.filename or "")[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Sadece JPG ve PNG dosyaları yüklenebilir")
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Dosya kaydedilemedi")

    # Save to db
    new_study = RadiologyStudy(
        patient_id=patient_id,
        doctor_id=doctor_id,
        appointment_id=appointment_id,
        title=title,
        modality=modality,
        body_part=body_part,
        date=date.today(),
        file_url=f"{API_BASE_URL}/uploads/{unique_filename}",
        report=report
    )
    
    db.add(new_study)
    db.commit()
    db.refresh(new_study)
    
    if ai_results:
        import json
        try:
            parsed_results = json.loads(ai_results)
            new_ai = AIAnalysis(
                radiology_study_id=new_study.id,
                model_name="DenseNet_ViT_Fusion",
                model_version="v2.0",
                results=parsed_results
            )
            db.add(new_ai)
            db.commit()
        except Exception as e:
            print(f"Error saving AI Analysis: {e}")
    
    return _format_response(new_study, db)

@router.get("/patient/{patient_id}", response_model=List[RadiologyStudyResponse])
def get_patient_radiology(patient_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "patient", patient_id, "doctor", "admin")
    studies = db.query(RadiologyStudy).filter(RadiologyStudy.patient_id == patient_id).order_by(RadiologyStudy.date.desc()).all()
    return [_format_response(s, db) for s in studies]

@router.get("/doctor/{doctor_id}", response_model=List[RadiologyStudyResponse])
def get_doctor_radiology(doctor_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "doctor", doctor_id, "admin")
    studies = db.query(RadiologyStudy).filter(RadiologyStudy.doctor_id == doctor_id).order_by(RadiologyStudy.date.desc()).all()
    return [_format_response(s, db) for s in studies]

def _format_response(study: RadiologyStudy, db: Session) -> dict:
    doctor = db.query(Doctor).filter(Doctor.id == study.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == study.patient_id).first()
    
    return {
        "id": study.id,
        "patient_id": study.patient_id,
        "doctor_id": study.doctor_id,
        "title": study.title,
        "modality": study.modality,
        "body_part": study.body_part,
        "date": study.date,
        "file_url": study.file_url,
        "report": study.report,
        "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
        "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
        "ai_analyses": [
            {
                "model_name": a.model_name, 
                "model_version": a.model_version, 
                "results": a.results, 
                "created_at": str(a.created_at)
            } for a in study.ai_analyses
        ] if study.ai_analyses else None
    }
