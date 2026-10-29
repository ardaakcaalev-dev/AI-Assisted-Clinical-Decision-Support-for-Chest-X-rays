from pydantic import BaseModel
from datetime import date, time
from typing import Optional

class DoctorTimeOffBase(BaseModel):
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    reason: Optional[str] = None

class DoctorTimeOffCreate(DoctorTimeOffBase):
    pass

class DoctorTimeOffResponse(DoctorTimeOffBase):
    id: int
    doctor_id: int

    class Config:
        from_attributes = True
