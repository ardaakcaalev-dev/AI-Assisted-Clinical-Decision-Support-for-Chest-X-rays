from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import CORS_ORIGINS, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, UPLOAD_DIR
from app.core.database import Base, SessionLocal, engine
from app.core.security import get_current_user, get_password_hash, require_roles

# Import models so SQLAlchemy knows about them before creating tables
from app.models import (  # noqa: F401
    admin, ai_analysis, appointment, doctor, doctor_schedule, doctor_timeoff,
    lab_study, medical_record, patient, radiology_study,
)
from app.models.admin import Admin
from app.routers import admin as admin_router
from app.routers import ai, appointments, auth, doctors, lab_studies, medical_records, patients, radiology

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hekim – Clinical Decision Support API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Hekim API is running. See /docs for the API reference."}


logged_in = [Depends(get_current_user)]

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(patients.router, prefix="/api/patients", tags=["patients"], dependencies=logged_in)
app.include_router(doctors.router, prefix="/api/doctors", tags=["doctors"], dependencies=logged_in)
app.include_router(appointments.router, prefix="/api/appointments", tags=["appointments"], dependencies=logged_in)
app.include_router(medical_records.router, prefix="/api/medical-records", tags=["medical-records"], dependencies=logged_in)
app.include_router(radiology.router, prefix="/api/radiology", tags=["radiology"], dependencies=logged_in)
app.include_router(lab_studies.router, prefix="/api/lab-studies", tags=["lab-studies"], dependencies=logged_in)
app.include_router(admin_router.router, prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_roles("admin"))])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"], dependencies=[Depends(require_roles("doctor"))])

# Uploaded radiology images are served as static files so the frontend can display them.
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def create_default_admin():
    """Create a demo admin account on first start, if DEFAULT_ADMIN_PASSWORD is set."""
    if not DEFAULT_ADMIN_PASSWORD:
        return
    db = SessionLocal()
    try:
        if not db.query(Admin).filter(Admin.email == DEFAULT_ADMIN_EMAIL).first():
            db.add(Admin(
                first_name="Sistem",
                last_name="Yöneticisi",
                email=DEFAULT_ADMIN_EMAIL,
                password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
            ))
            db.commit()
            print(f"Demo admin created: {DEFAULT_ADMIN_EMAIL}")
    finally:
        db.close()
