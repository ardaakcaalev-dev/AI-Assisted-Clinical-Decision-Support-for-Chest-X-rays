from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import date

class LabParameter(BaseModel):
    name: str
    value: Any
    unit: str
    range: str
    status: str # 'normal', 'low', 'high'

class LabStudyBase(BaseModel):
    appointment_id: int
    title: str
    department: str
    results: List[LabParameter]

class LabStudyCreate(LabStudyBase):
    pass

class LabStudyResponse(LabStudyBase):
    id: int
    patient_id: int
    doctor_id: int
    date: date
    status: str
    
    # Nested info for frontend convenience
    doctor_name: Optional[str] = None
    hospital: Optional[str] = None # Will just hardcode for now as the system doesn't have a hospital table
    
    class Config:
        from_attributes = True
