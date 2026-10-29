from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    
    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(Time, nullable=False)
    
    # Status options: "Bekliyor", "Onaylandı", "Tamamlandı", "İptal Edildi"
    status = Column(String(50), default="Bekliyor", nullable=False)
    
    reason = Column(String(255), nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    medical_record = relationship("MedicalRecord", back_populates="appointment", uselist=False, cascade="all, delete-orphan")
