from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    radiology_study_id = Column(Integer, ForeignKey("radiology_studies.id"), nullable=False)
    
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=True)
    results = Column(JSON, nullable=False) # Ham AI çıktıları
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    study = relationship("RadiologyStudy", back_populates="ai_analyses")
