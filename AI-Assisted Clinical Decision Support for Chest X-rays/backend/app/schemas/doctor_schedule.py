from pydantic import BaseModel
from datetime import time
from typing import List

class DoctorScheduleBase(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time

class DoctorScheduleCreate(DoctorScheduleBase):
    pass

class DoctorScheduleResponse(DoctorScheduleBase):
    id: int
    doctor_id: int

    class Config:
        from_attributes = True

class DoctorScheduleUpdateList(BaseModel):
    schedules: List[DoctorScheduleBase]
