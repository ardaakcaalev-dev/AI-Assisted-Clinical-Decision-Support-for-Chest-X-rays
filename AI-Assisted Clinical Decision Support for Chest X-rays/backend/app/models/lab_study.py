from sqlalchemy import Column, Integer, String, Date, JSON, ForeignKey
from app.core.database import Base

class LabStudy(Base):
    __tablename__ = "lab_studies"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    date = Column(Date)
    
    title = Column(String) # e.g. 'Tam Kan Sayımı'
    department = Column(String) # e.g. 'Biyokimya Laboratuvarı'
    status = Column(String, default="Tamamlandı")
    
    results = Column(JSON) # e.g. [{"name": "Hemoglobin", "value": 14.2, "unit": "g/dL", "range": "12-16", "status": "normal"}]
