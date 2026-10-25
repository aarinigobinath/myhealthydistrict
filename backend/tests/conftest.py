import os

# Use the separate test database so the real sample data is never touched.
os.environ["MHD_DATABASE_URL"] = os.getenv(
    "MHD_TEST_DATABASE_URL", "postgresql+psycopg2://mhd:mhd_dev_pw@localhost:5432/mhd_test"
)
os.environ["MHD_STATIC_DIR"] = "/nonexistent"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import reset_and_seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded():
    reset_and_seed()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


@pytest.fixture()
def maya(client):
    return login(client, "maya@example.com", "MayaDemo2026!")


@pytest.fixture()
def county(client):
    return login(client, "county@example.com", "CountyDemo2026!")
