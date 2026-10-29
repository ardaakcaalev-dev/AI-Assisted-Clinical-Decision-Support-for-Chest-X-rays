from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.patient import Patient
from app.schemas.patient import PatientResponse, PatientUpdate
from app.core.security import ensure_self_or_roles, get_current_user, get_password_hash, verify_password

router = APIRouter()

@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "patient", patient_id, "doctor", "admin")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
    return patient

@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(patient_id: int, patient_data: PatientUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "patient", patient_id)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")

    # If trying to update password, verify current password
    if patient_data.password:
        if not verify_password(patient_data.current_password or "", patient.password):
            raise HTTPException(status_code=400, detail="Mevcut şifreniz hatalı!")
        patient.password = get_password_hash(patient_data.password)

    # Update only the fields that were provided (email/national_id are not in the schema)
    update_data = patient_data.model_dump(exclude_unset=True, exclude={'current_password', 'password'})
    
    for key, value in update_data.items():
        setattr(patient, key, value)

    db.commit()
    db.refresh(patient)
    return patient
