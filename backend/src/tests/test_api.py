import pytest
from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_get_files():
    response = client.get("/api/files")
    assert response.status_code == 200
    assert "files" in response.json()


def test_read_file_not_found():
    response = client.get("/api/files/read?path=nonexistent.txt")
    assert response.status_code == 404


def test_clear_files():
    response = client.post("/api/files/clear")
    assert response.status_code == 200
    assert response.json()["status"] == "cleared"


def test_session_not_found():
    response = client.get("/api/session/fake-session-id")
    assert response.status_code == 404


def test_agent_run_missing_fields():
    response = client.post("/api/agent/run", json={})
    assert response.status_code == 422