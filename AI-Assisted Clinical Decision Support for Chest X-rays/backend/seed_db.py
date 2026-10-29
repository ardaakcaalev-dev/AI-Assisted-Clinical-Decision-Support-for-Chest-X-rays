import os
import random
from datetime import datetime, timedelta, date
from faker import Faker

# Adjust sys.path so we can import from app
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import engine, SessionLocal, Base
from app.models.admin import Admin
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.radiology_study import RadiologyStudy
from app.models.lab_study import LabStudy
from app.models.doctor_schedule import DoctorSchedule
from app.models.doctor_timeoff import DoctorTimeOff
from app.models.ai_analysis import AIAnalysis  # noqa: F401  (needed so RadiologyStudy.ai_analyses resolves)
from app.core.security import get_password_hash

# Demo credentials (see README). Hashed once; bcrypt is deliberately slow.
ADMIN_PASSWORD = "admin123"
DEMO_PASSWORD = "password123"

fake = Faker('tr_TR')

def seed_database():
    print("Veritabanı tabloları siliniyor (CASCADE ile)...")
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()
    
    print("Veritabanı tabloları yeniden oluşturuluyor...")
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    demo_hash = get_password_hash(DEMO_PASSWORD)
    
    try:
        # 1. ADMIN
        print("Yönetici oluşturuluyor...")
        admin = Admin(
            first_name="Sistem",
            last_name="Yöneticisi",
            email="admin@hekim.com",
            password=get_password_hash(ADMIN_PASSWORD)
        )
        db.add(admin)
        
        # 2. DOCTORS
        print("Doktorlar oluşturuluyor...")
        specialties = ["Kardiyoloji", "İç Hastalıkları (Dahiliye)", "Çocuk Sağlığı ve Hastalıkları", "Genel Cerrahi", "Göz Hastalıkları", "Ortopedi", "Nöroloji"]
        doctors = []
        for i in range(15):
            doc = Doctor(
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                email=f"doktor{i+1}@hekim.com",
                password=demo_hash,
                specialty=random.choice(specialties),
                phone_number=fake.phone_number()[:20],
                slot_duration_minutes=20
            )
            db.add(doc)
            doctors.append(doc)
        
        db.commit() # Commit to get IDs
        
        # 3. PATIENTS
        print("Hastalar oluşturuluyor...")
        patients = []
        blood_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"]
        for i in range(40):
            pat = Patient(
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                email=f"hasta{i+1}@hekim.com",
                password=demo_hash,
                national_id=str(fake.random_number(digits=11, fix_len=True)),
                date_of_birth=fake.date_of_birth(minimum_age=5, maximum_age=85),
                phone_number=fake.phone_number()[:20],
                blood_type=random.choice(blood_types),
                height_cm=random.randint(150, 190),
                weight_kg=random.randint(50, 110)
            )
            db.add(pat)
            patients.append(pat)
            
        db.commit()
        
        # 4. APPOINTMENTS & MEDICAL RECORDS
        print("Randevular, Muayene Kayıtları, Tahlil ve Röntgenler oluşturuluyor...")
        statuses = ["Tamamlandı", "Planlandı", "İptal Edildi"]
        appointment_reasons = ["Kontrol", "Baş Ağrısı", "Göğüs Ağrısı", "Mide Bulantısı", "Rutin Muayene", "Göz Kuruluğu", "Eklem Ağrısı"]
        
        for pat in patients:
            # Each patient has 1 to 4 appointments
            for _ in range(random.randint(1, 4)):
                doc = random.choice(doctors)
                status = random.choices(statuses, weights=[60, 30, 10])[0]
                
                # If planned, date is in future. If completed/cancelled, date is in past.
                if status == "Planlandı":
                    days_offset = random.randint(1, 14)
                else:
                    days_offset = random.randint(-60, -1)
                
                appt_date = date.today() + timedelta(days=days_offset)
                appt_time = f"{random.randint(9, 16):02d}:{random.choice(['00', '20', '40'])}"
                
                appt = Appointment(
                    patient_id=pat.id,
                    doctor_id=doc.id,
                    appointment_date=appt_date,
                    appointment_time=appt_time,
                    status=status,
                    reason=random.choice(appointment_reasons)
                )
                db.add(appt)
                db.flush() # get appt.id
                
                if status == "Tamamlandı":
                    # Generate Medical Record
                    med_rec = MedicalRecord(
                        patient_id=pat.id,
                        doctor_id=doc.id,
                        appointment_id=appt.id,
                        date=appt_date,
                        complaint=appt.reason,
                        diagnosis=f"Teşhis: {fake.catch_phrase()}",
                        medicines=f"{random.randint(1, 3)}x1 {fake.word().capitalize()} Hapı",
                        prescription_no=f"REC-{random.randint(100000, 999999)}",
                        notes="Hastaya istirahat önerildi. Bol sıvı tüketmesi gerektiği belirtildi."
                    )
                    db.add(med_rec)
                    
                    # 30% chance of Lab Study
                    if random.random() < 0.3:
                        lab = LabStudy(
                            patient_id=pat.id,
                            doctor_id=doc.id,
                            appointment_id=appt.id,
                            date=appt_date,
                            title="Tam Kan Sayımı (Hemogram)",
                            department="Biyokimya Laboratuvarı",
                            status="Tamamlandı",
                            results=[
                                {"name": "WBC", "value": str(random.uniform(4.0, 11.0))[:4], "unit": "10^3/uL", "range": "4.5-11.0", "status": "Normal"},
                                {"name": "RBC", "value": str(random.uniform(3.8, 5.8))[:4], "unit": "10^6/uL", "range": "4.0-5.2", "status": "Normal"},
                                {"name": "HGB", "value": str(random.uniform(11.0, 16.0))[:4], "unit": "g/dL", "range": "12.0-16.0", "status": "Normal"},
                                {"name": "PLT", "value": str(random.randint(140, 450)), "unit": "10^3/uL", "range": "150-400", "status": "Normal"}
                            ]
                        )
                        db.add(lab)
                    
                    # 20% chance of Radiology
                    if random.random() < 0.2:
                        rad = RadiologyStudy(
                            patient_id=pat.id,
                            doctor_id=doc.id,
                            title="Beyin MR İncelemesi",
                            modality="MR",
                            body_part="Beyin",
                            date=appt_date,
                            file_url="/uploads/mock_mri.dcm",
                            report="İncelemede patolojik bir bulguya rastlanmamıştır. Kesitler normal sınırlar içindedir."
                        )
                        db.add(rad)
                        
        db.commit()
        print("Tüm veriler başarıyla eklendi! ✨")
        
    except Exception as e:
        print(f"Hata oluştu: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
