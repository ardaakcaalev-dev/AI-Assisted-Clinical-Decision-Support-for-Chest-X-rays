from sqlalchemy import Column, Integer, String, Date, Float, JSON, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    
    # Core Information
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    national_id = Column(String(20), unique=True, index=True, nullable=True) # TC Kimlik
    email = Column(String(100), unique=True, index=True, nullable=True)
    password = Column(String(255), nullable=False)  # bcrypt hash
    phone_number = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(50), nullable=True)
    
    # Medical Information
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(10), nullable=True)
    blood_type = Column(String(20), nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    
    # Complex Medical Data (Using JSON to store lists like ["Penicillin", "Peanuts"])
    allergies = Column(JSON, default=[])
    chronic_diseases = Column(JSON, default=[])
    
    
    # Relationships
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    medical_records = relationship("MedicalRecord", back_populates="patient", cascade="all, delete-orphan")
    radiology_studies = relationship("RadiologyStudy", back_populates="patient", cascade="all, delete-orphan")

    # Auditing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
