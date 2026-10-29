from sqlalchemy import Column, Integer, Date, Time, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class DoctorTimeOff(Base):
    __tablename__ = "doctor_timeoffs"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    
    date = Column(Date, nullable=False)
    
    # If start_time and end_time are null, it implies the entire day is taken off.
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    
    reason = Column(String(255), nullable=True)
    
    doctor = relationship("Doctor", back_populates="timeoffs")
