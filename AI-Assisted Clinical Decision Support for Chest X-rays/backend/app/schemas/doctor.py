from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, date

# Base Schema
class DoctorBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    specialty: Optional[str] = None
    registration_number: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    slot_duration_minutes: Optional[int] = 20

# Schema for creating a new doctor (Request Body)
class DoctorCreate(DoctorBase):
    password: str

# Schema for returning a doctor (Response Body - password excluded)
class DoctorResponse(DoctorBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Schema for updating a doctor (all fields optional)
class DoctorUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialty: Optional[str] = None
    registration_number: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    password: Optional[str] = None
    current_password: Optional[str] = None
