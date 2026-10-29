from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule
from app.models.doctor_timeoff import DoctorTimeOff
from app.schemas.doctor import DoctorResponse, DoctorUpdate
from app.schemas.doctor_schedule import DoctorScheduleResponse, DoctorScheduleUpdateList
from app.schemas.doctor_timeoff import DoctorTimeOffResponse, DoctorTimeOffCreate
from app.core.security import ensure_self_or_roles, get_current_user, get_password_hash, verify_password

router = APIRouter()

@router.get("/", response_model=List[DoctorResponse])
def get_all_doctors(db: Session = Depends(get_db)):
    doctors = db.query(Doctor).all()
    return doctors

@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")
    return doctor

@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor_profile(
    doctor_id: int, 
    doctor_data: DoctorUpdate, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ensure_self_or_roles(current_user, "doctor", doctor_id)
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")

    # If trying to update password, verify current password
    if doctor_data.password:
        if not verify_password(doctor_data.current_password or "", doctor.password):
            raise HTTPException(status_code=400, detail="Mevcut şifreniz hatalı!")
        doctor.password = get_password_hash(doctor_data.password)

    # Update only the fields that were provided (email is not in the schema)
    update_data = doctor_data.model_dump(exclude_unset=True, exclude={'current_password', 'password'})
    
    for key, value in update_data.items():
        setattr(doctor, key, value)

    db.commit()
    db.refresh(doctor)
    return doctor

@router.get("/{doctor_id}/schedule", response_model=List[DoctorScheduleResponse])
def get_doctor_schedule(doctor_id: int, db: Session = Depends(get_db)):
    return db.query(DoctorSchedule).filter(DoctorSchedule.doctor_id == doctor_id).all()

@router.put("/{doctor_id}/schedule", response_model=List[DoctorScheduleResponse])
def update_doctor_schedule(doctor_id: int, data: DoctorScheduleUpdateList, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "doctor", doctor_id)
    # Delete existing
    db.query(DoctorSchedule).filter(DoctorSchedule.doctor_id == doctor_id).delete()
    
    # Insert new
    new_schedules = []
    for item in data.schedules:
        sched = DoctorSchedule(
            doctor_id=doctor_id,
            day_of_week=item.day_of_week,
            start_time=item.start_time,
            end_time=item.end_time
        )
        db.add(sched)
        new_schedules.append(sched)
        
    db.commit()
    for sched in new_schedules:
        db.refresh(sched)
        
    return new_schedules

@router.get("/{doctor_id}/timeoff", response_model=List[DoctorTimeOffResponse])
def get_doctor_timeoffs(doctor_id: int, db: Session = Depends(get_db)):
    return db.query(DoctorTimeOff).filter(DoctorTimeOff.doctor_id == doctor_id).all()

@router.post("/{doctor_id}/timeoff", response_model=DoctorTimeOffResponse)
def create_doctor_timeoff(doctor_id: int, data: DoctorTimeOffCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "doctor", doctor_id)
    timeoff = DoctorTimeOff(
        doctor_id=doctor_id,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        reason=data.reason
    )
    db.add(timeoff)
    db.commit()
    db.refresh(timeoff)
    return timeoff

@router.delete("/{doctor_id}/timeoff/{timeoff_id}")
def delete_doctor_timeoff(doctor_id: int, timeoff_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "doctor", doctor_id)
    timeoff = db.query(DoctorTimeOff).filter(DoctorTimeOff.id == timeoff_id, DoctorTimeOff.doctor_id == doctor_id).first()
    if not timeoff:
        raise HTTPException(status_code=404, detail="İzin kaydı bulunamadı")
    db.delete(timeoff)
    db.commit()
    return {"message": "İzin kaydı silindi"}
