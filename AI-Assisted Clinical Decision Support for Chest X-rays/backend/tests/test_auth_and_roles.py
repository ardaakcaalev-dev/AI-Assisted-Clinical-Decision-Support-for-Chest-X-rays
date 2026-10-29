"""Authentication, password hashing and role-based access control."""
from app.core.security import verify_password
from app.models.doctor import Doctor
from app.models.patient import Patient

from tests.conftest import PASSWORD, login


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
def test_root_is_public(client):
    assert client.get("/").status_code == 200


def test_login_returns_token_and_role(client, users):
    response = login(client, users["doctor_a"].email)
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "doctor" and body["access_token"]


def test_login_wrong_password_is_rejected(client, users):
    assert login(client, users["patient_a"].email, "wrong-password").status_code == 401


def test_plaintext_password_in_database_does_not_log_in(client, users, db):
    """Old builds stored plain-text passwords; the hash itself must never work as a password."""
    stored_hash = users["patient_a"].password
    assert stored_hash.startswith("$2b$")
    assert login(client, users["patient_a"].email, stored_hash).status_code == 401


def test_protected_route_requires_token(client):
    assert client.get("/api/doctors/").status_code == 401


def test_invalid_token_is_rejected(client):
    response = client.get("/api/doctors/", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Role checks: whole routers
# ---------------------------------------------------------------------------
def test_only_admin_can_use_admin_api(client, headers):
    assert client.get("/api/admin/stats", headers=headers["patient_a"]).status_code == 403
    assert client.get("/api/admin/stats", headers=headers["doctor_a"]).status_code == 403
    assert client.get("/api/admin/stats", headers=headers["admin"]).status_code == 200


def test_patient_cannot_use_ai_api(client, headers):
    files = {"file": ("x.png", b"not-really-an-image", "image/png")}
    assert client.post("/api/ai/analyze-xray", files=files, headers=headers["patient_a"]).status_code == 403


def test_ai_rejects_non_image_upload(client, headers):
    files = {"file": ("virus.txt", b"malicious", "text/plain")}
    assert client.post("/api/ai/analyze-xray", files=files, headers=headers["doctor_a"]).status_code == 400


# ---------------------------------------------------------------------------
# Role checks: patient data
# ---------------------------------------------------------------------------
def test_patient_can_read_own_data_but_not_others(client, users, headers):
    own, other = users["patient_a"].id, users["patient_b"].id
    for path in ["/api/patients/{}", "/api/medical-records/patient/{}", "/api/lab-studies/patient/{}",
                 "/api/radiology/patient/{}", "/api/appointments/patient/{}"]:
        assert client.get(path.format(own), headers=headers["patient_a"]).status_code == 200, path
        assert client.get(path.format(other), headers=headers["patient_a"]).status_code == 403, path


def test_doctor_can_read_patient_data(client, users, headers):
    pid = users["patient_a"].id
    assert client.get(f"/api/patients/{pid}", headers=headers["doctor_b"]).status_code == 200
    assert client.get(f"/api/medical-records/patient/{pid}", headers=headers["doctor_b"]).status_code == 200


def test_patient_cannot_edit_another_patient(client, users, headers):
    response = client.put(f"/api/patients/{users['patient_b'].id}", json={"city": "Hacked"}, headers=headers["patient_a"])
    assert response.status_code == 403


def test_patient_cannot_book_for_someone_else(client, users, headers):
    payload = {"patient_id": users["patient_b"].id, "doctor_id": users["doctor_a"].id,
               "appointment_date": "2099-01-05", "appointment_time": "10:00:00", "reason": "x"}
    assert client.post("/api/appointments/", json=payload, headers=headers["patient_a"]).status_code == 403


# ---------------------------------------------------------------------------
# Role checks: doctor data
# ---------------------------------------------------------------------------
def test_doctor_cannot_edit_another_doctor(client, users, headers):
    other = users["doctor_b"].id
    assert client.put(f"/api/doctors/{other}", json={"phone_number": "0"}, headers=headers["doctor_a"]).status_code == 403
    assert client.put(f"/api/doctors/{other}/schedule", json={"schedules": []}, headers=headers["doctor_a"]).status_code == 403


def test_patient_cannot_read_doctor_appointment_list(client, users, headers):
    assert client.get(f"/api/appointments/doctor/{users['doctor_a'].id}", headers=headers["patient_a"]).status_code == 403


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------
def test_appointment_status_rules(client, users, headers):
    appt = users["appointment"].id
    url = f"/api/appointments/{appt}"
    # Patient may not mark their own appointment completed, and others may not touch it at all
    assert client.put(url, json={"status": "Tamamlandı"}, headers=headers["patient_a"]).status_code == 403
    assert client.put(url, json={"status": "İptal Edildi"}, headers=headers["patient_b"]).status_code == 403
    assert client.put(url, json={"status": "Tamamlandı"}, headers=headers["doctor_b"]).status_code == 403
    # Its doctor can update it; its patient can cancel it
    assert client.put(url, json={"status": "Devam Ediyor"}, headers=headers["doctor_a"]).status_code == 200
    assert client.put(url, json={"status": "İptal Edildi"}, headers=headers["patient_a"]).status_code == 200


def test_only_appointment_doctor_can_write_medical_record(client, users, headers):
    payload = {"appointment_id": users["appointment"].id, "complaint": "c", "diagnosis": "d", "notes": "", "medicines": ""}
    assert client.post("/api/medical-records/", json=payload, headers=headers["doctor_b"]).status_code == 403
    assert client.post("/api/medical-records/", json=payload, headers=headers["patient_a"]).status_code == 403


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def test_password_change_requires_current_password_and_stores_hash(client, users, headers, db):
    pid = users["patient_b"].id
    url = f"/api/patients/{pid}"
    bad = client.put(url, json={"current_password": "wrong", "password": "New-pass-456"}, headers=headers["patient_b"])
    assert bad.status_code == 400

    good = client.put(url, json={"current_password": PASSWORD, "password": "New-pass-456"}, headers=headers["patient_b"])
    assert good.status_code == 200

    db.expire_all()
    stored = db.get(Patient, pid).password
    assert stored != "New-pass-456" and verify_password("New-pass-456", stored)
    assert login(client, users["patient_b"].email, "New-pass-456").status_code == 200


def test_admin_created_doctor_password_is_hashed(client, users, headers, db):
    email = f"new-doc-{users['tag']}@hekim-test.com"
    payload = {"first_name": "New", "last_name": "Doc", "email": email, "password": "Doc-pass-789", "specialty": "Radyoloji"}
    assert client.post("/api/admin/doctors", json=payload, headers=headers["admin"]).status_code == 201

    stored = db.query(Doctor).filter(Doctor.email == email).first().password
    assert stored.startswith("$2b$")
    assert login(client, email, "Doc-pass-789").status_code == 200
