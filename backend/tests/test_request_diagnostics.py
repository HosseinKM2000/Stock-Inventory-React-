import logging

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app
import app.main as main_module


@pytest.fixture(scope="module", autouse=True)
def dispose_engine_after_module():
    yield
    engine.dispose()


def test_request_id_and_release_context_are_returned_on_success():
    Base.metadata.create_all(bind=engine)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/health", headers={"X-Request-ID": "client-request-123"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "client-request-123"
    assert response.headers["X-Tanzim-Build"]
    assert response.headers["X-Tanzim-Schema"] == "20261110_0018"


def test_unhandled_error_has_same_safe_request_id_in_response_and_log(monkeypatch, caplog):
    class BrokenEngine:
        def connect(self):
            raise RuntimeError("database unavailable with password=never-log-this")

    Base.metadata.create_all(bind=engine)
    with TestClient(app, raise_server_exceptions=False) as client:
        monkeypatch.setattr(main_module, "engine", BrokenEngine())
        with caplog.at_level(logging.ERROR, logger="tanzim.api"):
            response = client.get("/api/health", headers={"X-Request-ID": "release-check-456"})

    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "release-check-456"
    assert response.json()["request_id"] == "release-check-456"
    assert "release-check-456" in caplog.text
    assert "never-log-this" not in caplog.text
