from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import date, datetime

# Base Schema (Shared attributes)
class PatientBase(BaseModel):
    first_name: str
    last_name: str
    national_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    
    date_of_birth: date
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    
    allergies: List[str] = []
    chronic_diseases: List[str] = []

# Schema for creating a new patient (Request Body)
class PatientCreate(PatientBase):
    password: str

# Schema for returning a patient (Response Body)
class PatientResponse(PatientBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Schema for updating a patient (Request Body)
class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    # email and national_id are specifically excluded to make them read-only
    # password update can be handled here or in a separate endpoint, 
    # but for simplicity we will include it if provided
    current_password: Optional[str] = None
    password: Optional[str] = None
