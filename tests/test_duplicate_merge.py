import os
import sys
import sqlite3
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from starlette.testclient import TestClient
from app.server import app

client = TestClient(app)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "kanyakumari_education.db")

def test_duplicate_merge_and_recovery():
    # 1. Login as Admin
    login_res = client.post("/api/admin/login", json={
        "username": "admin",
        "password": "Admin@EduCape2026!"
    })
    token = login_res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify MACET merge state in DB
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT is_active, duplicate_of FROM colleges WHERE id = 'COL_52'")
    c52 = cur.fetchone()
    assert c52[0] == 0 and c52[1] == "COL_81"

    cur.execute("SELECT target_institution_id FROM institution_merge_history WHERE source_institution_id = 'COL_52'")
    merge_entry = cur.fetchone()
    assert merge_entry is not None
    assert merge_entry[0] == "COL_81"
    conn.close()

    # Verify calling COL_52 via API returns COL_81 with aliasing metadata
    res = client.get("/api/institutions/COL_52")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "COL_81"
    assert data["aliased_from"] == "COL_52"

if __name__ == "__main__":
    test_duplicate_merge_and_recovery()
    print("✓ Duplicate merge and alias recovery test passed!")
