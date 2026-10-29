from sqlalchemy import Column, Integer, String, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    
    # Core Information
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)  # bcrypt hash
    
    # Medical Profession Info
    specialty = Column(String(100), nullable=True) # e.g., "Kardiyoloji"
    registration_number = Column(String(50), unique=True, nullable=True) # Diploma/Sicil No
    
    # Personal Info (matching UI)
    phone_number = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    city = Column(String(50), nullable=True)
    address = Column(String(255), nullable=True)
    
    # Settings
    slot_duration_minutes = Column(Integer, default=20)
    
    # Relationships
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")
    schedules = relationship("DoctorSchedule", back_populates="doctor", cascade="all, delete-orphan")
    timeoffs = relationship("DoctorTimeOff", back_populates="doctor", cascade="all, delete-orphan")
    medical_records = relationship("MedicalRecord", back_populates="doctor", cascade="all, delete-orphan")
    radiology_studies = relationship("RadiologyStudy", back_populates="doctor", cascade="all, delete-orphan")

    # Auditing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
