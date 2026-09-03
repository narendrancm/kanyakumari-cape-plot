import os
import sys
import sqlite3
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from starlette.testclient import TestClient
from app.server import app

client = TestClient(app)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "kanyakumari_education.db")

def test_citizen_correction_workflow():
    # 1. Citizen submits correction
    inst_id = "COL_2"
    sub_res = client.post("/api/corrections", json={
        "institution_id": inst_id,
        "institution_name": "MSU Constituent College",
        "field_name": "principal_phone",
        "suggested_value": "04652-255999",
        "source_proof": "https://msuniv.ac.in/circulars/2026"
    })
    assert sub_res.status_code == 200, f"Submission failed: {sub_res.text}"
    corr_id = sub_res.json()["correction_id"]

    # 2. Verify PENDING state in Database
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT status, suggested_value FROM institution_corrections WHERE id = ?", (corr_id,))
    row = cur.fetchone()
    assert row[0] == "PENDING"
    assert row[1] == "04652-255999"

    # Read original phone to revert later
    cur.execute("SELECT principal_phone FROM colleges WHERE id = ?", (inst_id,))
    orig_phone = cur.fetchone()[0]
    conn.close()

    # 3. Admin logs in
    login_res = client.post("/api/admin/login", json={
        "username": "admin",
        "password": "Admin@EduCape2026!"
    })
    token = login_res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # 4. Admin Approves Correction
        approve_res = client.post(f"/api/admin/corrections/{corr_id}/approve", json={
            "admin_notes": "Verified against MSU circular proof link"
        }, headers=headers)
        assert approve_res.status_code == 200

        # 5. Verify Canonical DB Updated
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT principal_phone FROM colleges WHERE id = ?", (inst_id,))
        updated_phone = cur.fetchone()[0]
        assert updated_phone == "04652-255999"

        # Verify Correction Marked APPROVED
        cur.execute("SELECT status, reviewed_by FROM institution_corrections WHERE id = ?", (corr_id,))
        corr_status, reviewed_by = cur.fetchone()
        assert corr_status == "APPROVED"
        assert reviewed_by == "admin"
        conn.close()

    finally:
        # 6. Clean Revert
        client.put(f"/api/admin/institutions/{inst_id}", json={
            "phone": orig_phone,
            "edit_reason": "Reverting test correction"
        }, headers=headers)

if __name__ == "__main__":
    test_citizen_correction_workflow()
    print("✓ Citizen Correction Review Workflow test passed!")
