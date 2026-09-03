import os
import sys
import sqlite3
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from starlette.testclient import TestClient
from app.server import app

client = TestClient(app)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "kanyakumari_education.db")

def test_macet_database_state():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # 1. Verify COL_52 is inactive duplicate
    cur.execute("SELECT id, name, is_active, duplicate_of FROM colleges WHERE id = 'COL_52'")
    col_52 = cur.fetchone()
    assert col_52 is not None
    assert col_52[2] == 0, f"COL_52 should be inactive, got {col_52[2]}"
    assert col_52[3] == "COL_81", f"COL_52 should point to COL_81, got {col_52[3]}"
    
    # 2. Verify COL_81 is canonical MACET
    cur.execute("SELECT id, name, acronym, website, is_active FROM colleges WHERE id = 'COL_81'")
    col_81 = cur.fetchone()
    assert col_81 is not None
    assert col_81[1] == "Marthandam College of Engineering and Technology"
    assert col_81[2] == "MACET"
    assert "macet.edu.in" in col_81[3]
    assert col_81[4] == 1
    
    conn.close()

def test_macet_api_alias_resolution():
    # Calling COL_52 must resolve seamlessly to COL_81
    res = client.get("/api/institutions/COL_52")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "COL_81"
    assert data["name"] == "Marthandam College of Engineering and Technology"
    assert data["is_merged_duplicate"] is True
    assert data["aliased_from"] == "COL_52"

def test_macet_search():
    # Search for acronym "MACET"
    res = client.get("/api/search?q=MACET")
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) > 0
    ids = [r["id"] for r in results]
    assert "COL_81" in ids, "Canonical COL_81 not returned for 'MACET' search"
    assert "COL_52" not in ids, "Inactive duplicate COL_52 should NOT appear in search"

def test_macet_export():
    res = client.get("/api/export/csv")
    assert res.status_code == 200
    csv_text = res.text
    assert "Marthandam College of Engineering and Technology" in csv_text
    assert "COL_81" in csv_text
    assert "COL_52" not in csv_text, "COL_52 duplicate should be excluded from canonical export"

if __name__ == "__main__":
    test_macet_database_state()
    test_macet_api_alias_resolution()
    test_macet_search()
    test_macet_export()
    print("✓ All MACET E2E verification tests passed!")
