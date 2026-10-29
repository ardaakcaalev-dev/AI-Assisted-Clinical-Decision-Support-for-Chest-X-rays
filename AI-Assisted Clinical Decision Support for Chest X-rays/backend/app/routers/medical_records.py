import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.core.database import get_db
from app.models.medical_record import MedicalRecord
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.radiology_study import RadiologyStudy
from app.models.lab_study import LabStudy
from app.schemas.medical_record import MedicalRecordCreate, MedicalRecordResponse
from app.core.security import FORBIDDEN, ensure_self_or_roles, get_current_user, is_self

router = APIRouter()

@router.post("/", response_model=MedicalRecordResponse, status_code=status.HTTP_200_OK)
def create_medical_record(record: MedicalRecordCreate, is_completed: bool = False, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Verify appointment
    appointment = db.query(Appointment).filter(Appointment.id == record.appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")

    # Only the doctor of this appointment can write its examination record.
    if not is_self(current_user, "doctor", appointment.doctor_id):
        raise FORBIDDEN

    if appointment.status == "İptal Edildi":
        raise HTTPException(status_code=400, detail="İptal edilmiş randevu için muayene kaydı oluşturulamaz")

    # Check if a medical record already exists for this appointment
    existing_record = db.query(MedicalRecord).filter(MedicalRecord.appointment_id == record.appointment_id).first()

    if existing_record:
        existing_record.complaint = record.complaint
        existing_record.diagnosis = record.diagnosis
        existing_record.notes = record.notes
        existing_record.medicines = record.medicines
        
        if not existing_record.prescription_no and record.medicines and record.medicines.strip() != "":
            existing_record.prescription_no = "REC" + str(uuid.uuid4().hex)[:6].upper()
            
        new_record = existing_record
    else:
        # Generate a random prescription no if medicines exist
        prescription_no = None
        if record.medicines and record.medicines.strip() != "":
            prescription_no = "REC" + str(uuid.uuid4().hex)[:6].upper()

        new_record = MedicalRecord(
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            appointment_id=appointment.id,
            date=date.today(),
            complaint=record.complaint,
            diagnosis=record.diagnosis,
            notes=record.notes,
            prescription_no=prescription_no,
            medicines=record.medicines
        )
        db.add(new_record)
    
    # Update appointment status based on completion
    if is_completed:
        appointment.status = "Tamamlandı"
    else:
        # Optional: could update to 'Devam Ediyor' or leave as is. Leaving as is if not completed, but marking 'Devam Ediyor' is nice.
        if appointment.status == "Onaylandı":
            appointment.status = "Devam Ediyor"
    
    db.commit()
    db.refresh(new_record)
    
    return _format_response(new_record, db)

@router.get("/appointment/{appointment_id}", response_model=MedicalRecordResponse)
def get_record_by_appointment(appointment_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    record = db.query(MedicalRecord).filter(MedicalRecord.appointment_id == appointment_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    ensure_self_or_roles(current_user, "patient", record.patient_id, "doctor", "admin")
    return _format_response(record, db)

@router.get("/patient/{patient_id}", response_model=List[MedicalRecordResponse])
def get_patient_records(patient_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "patient", patient_id, "doctor", "admin")
    records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.date.desc()).all()
    return [_format_response(r, db) for r in records]

@router.get("/doctor/{doctor_id}", response_model=List[MedicalRecordResponse])
def get_doctor_records(doctor_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "doctor", doctor_id, "admin")
    records = db.query(MedicalRecord).filter(MedicalRecord.doctor_id == doctor_id).order_by(MedicalRecord.date.desc()).all()
    return [_format_response(r, db) for r in records]

def _format_response(record: MedicalRecord, db: Session) -> dict:
    doctor = db.query(Doctor).filter(Doctor.id == record.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == record.patient_id).first()
    
    rads = db.query(RadiologyStudy).filter(RadiologyStudy.appointment_id == record.appointment_id).all()
    rad_list = []
    for rad in rads:
        ai_list = []
        for ai in rad.ai_analyses:
            ai_list.append({
                "id": ai.id,
                "model_name": ai.model_name,
                "model_version": ai.model_version,
                "results": ai.results
            })
        rad_list.append({
            "id": rad.id,
            "title": rad.title,
            "modality": rad.modality,
            "body_part": rad.body_part,
            "date": rad.date,
            "file_url": rad.file_url,
            "report": rad.report,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "",
            "ai_analyses": ai_list
        })
        
    labs = db.query(LabStudy).filter(LabStudy.appointment_id == record.appointment_id).all()
    lab_list = []
    for lab in labs:
        lab_list.append({
            "id": lab.id,
            "title": lab.title,
            "department": lab.department,
            "date": lab.date,
            "status": lab.status,
            "results": lab.results
        })
    
    return {
        "id": record.id,
        "patient_id": record.patient_id,
        "doctor_id": record.doctor_id,
        "appointment_id": record.appointment_id,
        "date": record.date,
        "complaint": record.complaint,
        "diagnosis": record.diagnosis,
        "notes": record.notes,
        "prescription_no": record.prescription_no,
        "medicines": record.medicines,
        "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
        "doctor_specialty": doctor.specialty if doctor else None,
        "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
        "radiology_studies": rad_list,
        "lab_studies": lab_list
    }
