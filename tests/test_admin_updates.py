import os
import sys
import sqlite3
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from starlette.testclient import TestClient
from app.server import app

client = TestClient(app)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "kanyakumari_education.db")

def test_admin_live_update_propagation():
    # 1. Login as Admin
    login_res = client.post("/api/admin/login", json={
        "username": "admin",
        "password": "Admin@EduCape2026!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Select target institution
    inst_id = "COL_1"
    res_orig = client.get(f"/api/institutions/{inst_id}")
    assert res_orig.status_code == 200
    orig_phone = res_orig.json().get("phone") or "04652-230000"

    test_temp_phone = "04652-999888"

    try:
        # 3. Perform Live Admin Update via CMS API
        update_res = client.put(f"/api/admin/institutions/{inst_id}", json={
            "phone": test_temp_phone,
            "edit_reason": "Automated E2E live update test"
        }, headers=headers)
        assert update_res.status_code == 200, f"Update failed: {update_res.text}"

        # 4. Verify Database Row Updated
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT principal_phone FROM colleges WHERE id = ?", (inst_id,))
        db_phone = cur.fetchone()[0]
        assert db_phone == test_temp_phone, f"Database phone not updated: {db_phone}"

        # 5. Verify Audit Log Recorded
        cur.execute("SELECT action, old_value, new_value, reason FROM audit_logs WHERE institution_id = ? ORDER BY id DESC LIMIT 1", (inst_id,))
        audit_row = cur.fetchone()
        assert audit_row is not None
        assert audit_row[0] == "EDIT_FIELD"
        assert audit_row[2] == test_temp_phone
        conn.close()

        # 6. Verify Public API Returns New Value Instantly
        public_res = client.get(f"/api/institutions/{inst_id}")
        assert public_res.status_code == 200
        assert public_res.json()["phone"] == test_temp_phone, "Public API did not reflect live update!"

    finally:
        # 7. Safely Revert Back to Original Phone
        revert_res = client.put(f"/api/admin/institutions/{inst_id}", json={
            "phone": orig_phone,
            "edit_reason": "Reverting automated test"
        }, headers=headers)
        assert revert_res.status_code == 200

        # Verify revert propagated
        revert_check = client.get(f"/api/institutions/{inst_id}")
        assert revert_check.json()["phone"] == orig_phone

if __name__ == "__main__":
    test_admin_live_update_propagation()
    print("✓ Admin Live Update Propagation test passed with 100% success!")
