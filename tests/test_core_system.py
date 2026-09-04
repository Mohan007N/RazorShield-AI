"""
RazorShield AI — Production Test Suite.

Tests JWT Authentication, RBAC, Policy Engine, Simulator, and Cryptographic Audit Ledger.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.auth.security import create_access_token, UserRole, decode_access_token

client = TestClient(app)


def test_health_and_readiness():
    """Verify health and readiness endpoints."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    ready_res = client.get("/ready")
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"


def test_jwt_auth_and_rbac():
    """Verify JWT token issue and role extraction."""
    login_res = client.post("/api/v1/auth/login", json={"email": "mohan.k@abcelectronics.com"})
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["user"]["role"] == UserRole.ADMIN.value
    assert "*" in data["user"]["permissions"]

    # Verify decoded token
    decoded = decode_access_token(data["access_token"])
    assert decoded is not None
    assert decoded["email"] == "mohan.k@abcelectronics.com"


def test_rbac_roles_matrix():
    """Verify available RBAC roles."""
    res = client.get("/api/v1/auth/roles")
    assert res.status_code == 200
    roles = res.json()["roles"]
    role_names = [r["role"] for r in roles]
    assert "analyst" in role_names
    assert "risk_manager" in role_names
    assert "admin" in role_names


def test_simulator_start_and_stop():
    """Verify fraud attack simulator endpoints."""
    start_res = client.post("/api/v1/simulator/start", json={
        "attack_type": "card_testing",
        "tps": 1500,
        "fraud_rate": 0.20,
        "merchant_id": "merchant_001",
    })
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "started"

    status_res = client.get("/api/v1/simulator/status")
    assert status_res.status_code == 200
    assert status_res.json()["is_running"] is True

    stop_res = client.post("/api/v1/simulator/stop")
    assert stop_res.status_code == 200
    assert stop_res.json()["status"] == "stopped"


def test_cryptographic_audit_ledger():
    """Verify HMAC-SHA256 audit ledger retrieval."""
    res = client.get("/api/v1/audit/ledger")
    assert res.status_code == 200
    data = res.json()
    assert "ledger" in data
    assert data["chain_valid"] is True
    assert data["hash_algorithm"] == "HMAC-SHA256"
    assert len(data["ledger"]) > 0
    assert "integrity_hash" in data["ledger"][0]
