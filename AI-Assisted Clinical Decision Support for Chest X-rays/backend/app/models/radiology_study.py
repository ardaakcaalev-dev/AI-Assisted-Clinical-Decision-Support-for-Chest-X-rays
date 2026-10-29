from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class RadiologyStudy(Base):
    __tablename__ = "radiology_studies"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    
    title = Column(String(255), nullable=False)
    modality = Column(String(50), nullable=False) # e.g. XR, CT, MR
    body_part = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    file_url = Column(String(500), nullable=False)
    report = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    patient = relationship("Patient", back_populates="radiology_studies")
    doctor = relationship("Doctor", back_populates="radiology_studies")
    ai_analyses = relationship("AIAnalysis", back_populates="study", cascade="all, delete-orphan")
