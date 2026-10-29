from sqlalchemy import Column, Integer, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    
    # 0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday
    day_of_week = Column(Integer, nullable=False)
    
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    doctor = relationship("Doctor", back_populates="schedules")
