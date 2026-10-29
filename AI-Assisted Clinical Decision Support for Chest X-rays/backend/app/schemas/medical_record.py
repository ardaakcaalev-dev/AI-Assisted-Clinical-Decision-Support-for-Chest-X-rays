from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date

class MedicalRecordBase(BaseModel):
    appointment_id: int
    complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    medicines: Optional[str] = None

class MedicalRecordCreate(MedicalRecordBase):
    pass

class MedicalRecordResponse(MedicalRecordBase):
    id: int
    patient_id: int
    doctor_id: int
    date: date
    prescription_no: Optional[str] = None
    
    # Nested info for frontend convenience
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    patient_name: Optional[str] = None
    
    radiology_studies: Optional[List[Any]] = []
    lab_studies: Optional[List[Any]] = []

    class Config:
        from_attributes = True
