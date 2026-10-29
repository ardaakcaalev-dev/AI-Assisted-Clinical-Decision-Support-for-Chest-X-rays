from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime, timedelta
from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule
from app.models.doctor_timeoff import DoctorTimeOff
from app.models.patient import Patient
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, AppointmentListResponse, AppointmentUpdate
from app.core.security import FORBIDDEN, ensure_self_or_roles, get_current_user, is_self

CANCELLED = "İptal Edildi"

router = APIRouter()

@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(appointment: AppointmentCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Patients book for themselves; admins may book for anyone.
    ensure_self_or_roles(current_user, "patient", appointment.patient_id, "admin")
    # Check if patient exists
    patient = db.query(Patient).filter(Patient.id == appointment.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta bulunamadı")
        
    # Check if doctor exists
    doctor = db.query(Doctor).filter(Doctor.id == appointment.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doktor bulunamadı")
        
    # Prevent past dates
    if appointment.appointment_date < date.today():
        raise HTTPException(status_code=400, detail="Geçmiş bir tarihe randevu alınamaz")
    
    if appointment.appointment_date == date.today():
        if appointment.appointment_time <= datetime.now().time():
            raise HTTPException(status_code=400, detail="Geçmiş bir saate randevu alınamaz")

    new_appointment = Appointment(
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        appointment_date=appointment.appointment_date,
        appointment_time=appointment.appointment_time,
        reason=appointment.reason,
        status="Onaylandı"
    )
    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)
    return new_appointment

@router.get("/available-slots", response_model=List[str])
def get_available_slots(doctor_id: int, appointment_date: date, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        return []
        
    slot_duration = doctor.slot_duration_minutes or 20
    
    # If weekend or past date, return empty
    weekday = appointment_date.weekday()
    if weekday in [5, 6] or appointment_date < date.today():
        return []
        
    # Check for full-day or overlapping time_offs
    timeoffs = db.query(DoctorTimeOff).filter(
        DoctorTimeOff.doctor_id == doctor_id,
        DoctorTimeOff.date == appointment_date
    ).all()
    
    for toff in timeoffs:
        if toff.start_time is None and toff.end_time is None:
            # Full day off
            return []
            
    # Check doctor schedule for this weekday
    schedules = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.day_of_week == weekday
    ).all()
    
    if not schedules:
        return []

    # Fetch taken slots
    appointments = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.status != "İptal Edildi"
    ).all()
    taken_slots = [appt.appointment_time.strftime("%H:%M") for appt in appointments]
    
    slots = []
    
    now = datetime.now()
    is_today = appointment_date == date.today()
    
    for sched in schedules:
        current_time = datetime.strptime(sched.start_time.strftime("%H:%M"), "%H:%M")
        end_time = datetime.strptime(sched.end_time.strftime("%H:%M"), "%H:%M")
        
        while current_time + timedelta(minutes=slot_duration) <= end_time:
            time_str = current_time.strftime("%H:%M")
            
            # If today and past time, skip
            if is_today and current_time.time() <= now.time():
                current_time += timedelta(minutes=slot_duration)
                continue
            
            # Check if this slot overlaps with any partial timeoff
            slot_end = current_time + timedelta(minutes=slot_duration)
            is_off = False
            for toff in timeoffs:
                if toff.start_time and toff.end_time:
                    toff_start = datetime.strptime(toff.start_time.strftime("%H:%M"), "%H:%M")
                    toff_end = datetime.strptime(toff.end_time.strftime("%H:%M"), "%H:%M")
                    
                    if (current_time < toff_end) and (slot_end > toff_start):
                        is_off = True
                        break
                        
            if not is_off and time_str not in taken_slots:
                slots.append(time_str)
                
            current_time += timedelta(minutes=slot_duration)
            
    return sorted(list(set(slots)))

@router.get("/patient/{patient_id}", response_model=List[AppointmentListResponse])
def get_patient_appointments(patient_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "patient", patient_id, "doctor", "admin")
    appointments = db.query(Appointment).filter(Appointment.patient_id == patient_id).all()
    result = []
    for appt in appointments:
        doctor = db.query(Doctor).filter(Doctor.id == appt.doctor_id).first()
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
        })
    return result

@router.get("/doctor/{doctor_id}", response_model=List[AppointmentListResponse])
def get_doctor_appointments(doctor_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    ensure_self_or_roles(current_user, "doctor", doctor_id, "admin")
    appointments = db.query(Appointment).filter(Appointment.doctor_id == doctor_id).all()
    result = []
    for appt in appointments:
        patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
        result.append({
            "id": appt.id,
            "patient_id": appt.patient_id,
            "doctor_id": appt.doctor_id,
            "appointment_date": appt.appointment_date,
            "appointment_time": appt.appointment_time,
            "status": appt.status,
            "reason": appt.reason,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Bilinmiyor",
            "patient_date_of_birth": patient.date_of_birth if patient else None,
        })
    return result

@router.put("/{appointment_id}", response_model=AppointmentResponse)
def update_appointment_status(appointment_id: int, update_data: AppointmentUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")

    # The appointment's doctor and admins can set any status; its patient can only cancel it.
    if is_self(current_user, "patient", appointment.patient_id):
        if update_data.status != CANCELLED:
            raise FORBIDDEN
    elif not (is_self(current_user, "doctor", appointment.doctor_id) or current_user["role"] == "admin"):
        raise FORBIDDEN

    appointment.status = update_data.status
    db.commit()
    db.refresh(appointment)
    return appointment
