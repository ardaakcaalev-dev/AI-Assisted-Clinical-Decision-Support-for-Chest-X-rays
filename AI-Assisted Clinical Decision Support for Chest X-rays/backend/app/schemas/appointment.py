from pydantic import BaseModel
from typing import Optional
from datetime import date, time

class AppointmentBase(BaseModel):
    doctor_id: int
    appointment_date: date
    appointment_time: time
    reason: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    patient_id: int

class AppointmentUpdate(BaseModel):
    status: str

class AppointmentResponse(AppointmentBase):
    id: int
    patient_id: int
    status: str
    
    class Config:
        from_attributes = True

# Extended response to include related data for the frontend UI
class AppointmentListResponse(AppointmentResponse):
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    patient_name: Optional[str] = None
    patient_date_of_birth: Optional[date] = None
