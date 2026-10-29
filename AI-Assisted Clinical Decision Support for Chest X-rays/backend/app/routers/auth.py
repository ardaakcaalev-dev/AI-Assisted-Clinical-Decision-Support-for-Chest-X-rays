from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import timedelta

from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.admin import Admin
from app.schemas.patient import PatientCreate

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    # 1. Check if user is a Doctor
    doctor = db.query(Doctor).filter(Doctor.email == request.email).first()
    if doctor and verify_password(request.password, doctor.password):
        access_token = create_access_token(
            data={"sub": doctor.email, "role": "doctor"}, 
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "role": "doctor",
            "user": {
                "id": doctor.id,
                "first_name": doctor.first_name,
                "last_name": doctor.last_name,
                "email": doctor.email,
                "specialty": doctor.specialty
            }
        }
        
    # 2. Check if user is a Patient
    patient = db.query(Patient).filter(Patient.email == request.email).first()
    if patient and verify_password(request.password, patient.password):
        access_token = create_access_token(
            data={"sub": patient.email, "role": "patient"}, 
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "role": "patient",
            "user": {
                "id": patient.id,
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "email": patient.email,
                "blood_type": patient.blood_type
            }
        }

    # 3. Check if user is an Admin
    admin = db.query(Admin).filter(Admin.email == request.email).first()
    if admin and verify_password(request.password, admin.password):
        access_token = create_access_token(
            data={"sub": admin.email, "role": "admin"}, 
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "role": "admin",
            "user": {
                "id": admin.id,
                "first_name": admin.first_name,
                "last_name": admin.last_name,
                "email": admin.email
            }
        }

    # If neither matches
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Geçersiz email veya şifre"
    )

@router.post("/register/patient")
def register_patient(patient_data: PatientCreate, db: Session = Depends(get_db)):
    if db.query(Patient).filter(Patient.email == patient_data.email).first():
        raise HTTPException(status_code=400, detail="Bu email adresi zaten kayıtlı.")
        
    new_patient = Patient(
        first_name=patient_data.first_name,
        last_name=patient_data.last_name,
        email=patient_data.email,
        password=get_password_hash(patient_data.password),
        date_of_birth=patient_data.date_of_birth,
        national_id=patient_data.national_id,
        phone_number=patient_data.phone_number
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    
    return {"success": True, "message": "Kayıt başarılı", "patient_id": new_patient.id}
