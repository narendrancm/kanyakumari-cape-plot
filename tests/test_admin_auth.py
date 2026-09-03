import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from starlette.testclient import TestClient
from app.server import app

client = TestClient(app)

def test_admin_login_success():
    res = client.post("/api/admin/login", json={
        "username": "admin",
        "password": "Admin@EduCape2026!"
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    data = res.json()
    assert data["status"] == "success"
    assert data["user"]["role"] == "SUPER_ADMIN"
    assert "session_token" in data

def test_admin_login_invalid_password():
    res = client.post("/api/admin/login", json={
        "username": "admin",
        "password": "WrongPassword123"
    })
    assert res.status_code == 401

def test_admin_me_endpoint():
    # Login first
    login_res = client.post("/api/admin/login", json={
        "username": "admin",
        "password": "Admin@EduCape2026!"
    })
    token = login_res.json()["session_token"]

    # Call /api/admin/me with bearer token
    res = client.get("/api/admin/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    user = res.json()["user"]
    assert user["username"] == "admin"
    assert user["role"] == "SUPER_ADMIN"

def test_admin_logout():
    login_res = client.post("/api/admin/login", json={
        "username": "admin",
        "password": "Admin@EduCape2026!"
    })
    token = login_res.json()["session_token"]

    # Logout
    logout_res = client.post("/api/admin/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200

    # Verify session revoked
    me_res = client.get("/api/admin/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 401

if __name__ == "__main__":
    test_admin_login_success()
    test_admin_login_invalid_password()
    test_admin_me_endpoint()
    test_admin_logout()
    print("✓ All Admin Authentication tests passed!")
