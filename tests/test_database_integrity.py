import os
import sqlite3
import pytest

CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(CWD, "data", "kanyakumari_education.db")

def test_database_integrity():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA integrity_check")
    res = cur.fetchone()[0]
    conn.close()
    assert res == "ok", f"Integrity check failed: {res}"

def test_foreign_keys():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_key_check")
    violations = cur.fetchall()
    conn.close()
    assert len(violations) == 0, f"Foreign key violations found: {violations}"

def test_active_counts():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM institutions_master")
    active_total = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM schools WHERE is_active = 1")
    active_schools = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM colleges WHERE is_active = 1")
    active_colleges = cur.fetchone()[0]
    
    conn.close()
    assert active_schools == 1213, f"Expected 1213 active schools, got {active_schools}"
    assert active_colleges == 82, f"Expected 82 active colleges (with COL_52 merged), got {active_colleges}"
    assert active_total == 1295, f"Expected 1295 active institutions, got {active_total}"

if __name__ == "__main__":
    test_database_integrity()
    test_foreign_keys()
    test_active_counts()
    print("✓ All database integrity tests passed!")
