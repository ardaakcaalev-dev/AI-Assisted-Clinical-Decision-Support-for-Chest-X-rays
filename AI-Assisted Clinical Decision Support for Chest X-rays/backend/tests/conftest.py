"""Shared fixtures. Tests run against the database in backend/.env, create their own users and clean up after."""
import uuid
from datetime import date, time, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.main import app
from app.models.admin import Admin
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient

PASSWORD = "Test-pass-123"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="session")
def users(db):
    """Two patients, two doctors, one admin and one appointment between patient_a and doctor_a."""
    tag = uuid.uuid4().hex[:8]
    hashed = get_password_hash(PASSWORD)
    patient_a = Patient(first_name="Test", last_name="A", email=f"pa-{tag}@hekim-test.com", password=hashed, date_of_birth=date(1990, 1, 1))
    patient_b = Patient(first_name="Test", last_name="B", email=f"pb-{tag}@hekim-test.com", password=hashed, date_of_birth=date(1991, 1, 1))
    doctor_a = Doctor(first_name="Doc", last_name="A", email=f"da-{tag}@hekim-test.com", password=hashed, specialty="Radyoloji")
    doctor_b = Doctor(first_name="Doc", last_name="B", email=f"db-{tag}@hekim-test.com", password=hashed, specialty="Kardiyoloji")
    admin = Admin(first_name="Admin", last_name="Test", email=f"ad-{tag}@hekim-test.com", password=hashed)
    db.add_all([patient_a, patient_b, doctor_a, doctor_b, admin])
    db.commit()

    appointment = Appointment(
        patient_id=patient_a.id, doctor_id=doctor_a.id,
        appointment_date=date.today() + timedelta(days=7), appointment_time=time(10, 0),
        reason="Test", status="Onaylandı",
    )
    db.add(appointment)
    db.commit()

    data = {"patient_a": patient_a, "patient_b": patient_b, "doctor_a": doctor_a,
            "doctor_b": doctor_b, "admin": admin, "appointment": appointment, "tag": tag}
    yield data

    # Cleanup: everything these tests created
    db.rollback()
    patient_ids = [patient_a.id, patient_b.id]
    db.query(Appointment).filter(Appointment.patient_id.in_(patient_ids)).delete(synchronize_session=False)
    db.query(Patient).filter(Patient.id.in_(patient_ids)).delete(synchronize_session=False)
    db.query(Doctor).filter(Doctor.email.like(f"%{tag}@hekim-test.com")).delete(synchronize_session=False)
    db.query(Admin).filter(Admin.id == admin.id).delete(synchronize_session=False)
    db.commit()


def login(client, email, password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


@pytest.fixture(scope="session")
def headers(client, users):
    """Authorization headers for each test user, keyed like `users`."""
    result = {}
    for key in ["patient_a", "patient_b", "doctor_a", "doctor_b", "admin"]:
        response = login(client, users[key].email)
        assert response.status_code == 200, response.text
        result[key] = {"Authorization": f"Bearer {response.json()['access_token']}"}
    return result
