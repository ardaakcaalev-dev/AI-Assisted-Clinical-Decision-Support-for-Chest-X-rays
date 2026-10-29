from pydantic import BaseModel
from datetime import time
from typing import List, Optional

class DoctorAvailabilityBase(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time
    has_break: bool = False
    break_start_time: Optional[time] = None
    break_end_time: Optional[time] = None
    is_active: bool

class DoctorAvailabilityCreate(DoctorAvailabilityBase):
    pass

class DoctorAvailabilityResponse(DoctorAvailabilityBase):
    id: int
    doctor_id: int

    class Config:
        from_attributes = True

class DoctorAvailabilityUpdateList(BaseModel):
    availabilities: List[DoctorAvailabilityBase]
