from pydantic import BaseModel
from typing import Optional
from datetime import date

class RadiologyStudyBase(BaseModel):
    patient_id: int
    doctor_id: int
    title: str
    modality: str
    body_part: str
    report: Optional[str] = None

class RadiologyStudyCreate(RadiologyStudyBase):
    pass

class RadiologyStudyResponse(RadiologyStudyBase):
    id: int
    date: date
    file_url: str
    
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    ai_analyses: Optional[list] = None

    class Config:
        from_attributes = True
