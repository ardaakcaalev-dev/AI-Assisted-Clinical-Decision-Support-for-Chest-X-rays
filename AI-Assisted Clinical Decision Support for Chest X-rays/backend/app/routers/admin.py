from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.admin import Admin
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.schemas.admin import AdminResponse
from app.schemas.doctor import DoctorCreate, DoctorResponse
from app.schemas.patient import PatientResponse
from app.schemas.appointment import AppointmentListResponse
from sqlalchemy import desc

from app.core.security import get_password_hash

router = APIRouter()

@router.get("/stats")
def get_hospital_stats(db: Session = Depends(get_db)):
    total_doctors = db.query(Doctor).count()
    total_patients = db.query(Patient).count()
    total_appointments = db.query(Appointment).count()
    
    # Calculate some basic metrics
    completed_appointments = db.query(Appointment).filter(Appointment.status == "Tamamlandı").count()
    
    return {
        "total_doctors": total_doctors,
        "total_patients": total_patients,
        "total_appointments": total_appointments,
        "completed_appointments": completed_appointments
    }

@router.post("/doctors", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(doctor: DoctorCreate, db: Session = Depends(get_db)):
    # Check if email exists
    if db.query(Doctor).filter(Doctor.email == doctor.email).first():
        raise HTTPException(status_code=400, detail="Bu email adresine sahip bir doktor zaten var.")
        
    new_doctor = Doctor(
        first_name=doctor.first_name,
        last_name=doctor.last_name,
        email=doctor.email,
        password=get_password_hash(doctor.password),
        specialty=doctor.specialty,
        phone_number=doctor.phone_number
    )
    db.add(new_doctor)
    db.commit()
    db.refresh(new_doctor)
    return new_doctor

@router.delete("/doctors/{doctor_id}")
def delete_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı.")
    
    db.delete(doctor)
    db.commit()
    return {"success": True, "message": "Doktor başarıyla silindi."}

@router.get("/doctors", response_model=List[DoctorResponse])
def get_all_doctors(db: Session = Depends(get_db)):
    return db.query(Doctor).all()

@router.get("/patients", response_model=List[PatientResponse])
def get_all_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()

@router.get("/appointments", response_model=List[AppointmentListResponse])
def get_all_appointments(db: Session = Depends(get_db)):
    appointments = db.query(Appointment).order_by(desc(Appointment.appointment_date)).all()
    result = []
    for appt in appointments:
        doctor = db.query(Doctor).filter(Doctor.id == appt.doctor_id).first()
        patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
        result.append({
            "id": appt.id,
            "patient_id": appt.patient_id,
            "doctor_id": appt.doctor_id,
            "appointment_date": appt.appointment_date,
            "appointment_time": appt.appointment_time,
            "status": appt.status,
            "reason": appt.reason,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else "Bilinmiyor",
            "doctor_specialty": doctor.specialty if doctor else "Bilinmiyor",
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Bilinmiyor",
        })
    return result
