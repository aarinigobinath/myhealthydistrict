"""Browser tests: start a private copy of the whole app (API + built React app) on port 8001,
using the mhd_test database, and drive it with a real Chromium browser."""
import os
import subprocess
import sys
import time

import pytest
import httpx

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORT = 8001
BASE = f"http://127.0.0.1:{PORT}"
CHROME = os.getenv("MHD_CHROMIUM", "/opt/pw-browsers/chromium")


@pytest.fixture(scope="session", autouse=True)
def server():
    env = dict(os.environ,
               MHD_DATABASE_URL="postgresql+psycopg2://mhd:mhd_dev_pw@localhost:5432/mhd_test",
               MHD_STATIC_DIR=os.path.join(ROOT, "frontend", "dist"),
               PYTHONPATH=os.path.join(ROOT, "backend"))
    subprocess.run([sys.executable, "-m", "app.seed"], cwd=os.path.join(ROOT, "backend"), env=env, check=True)
    p = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PORT)],
                         cwd=os.path.join(ROOT, "backend"), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            if httpx.get(BASE + "/api/health", timeout=1).is_success:
                break
        except httpx.HTTPError:
            time.sleep(0.5)
    else:
        p.kill()
        raise RuntimeError("test server did not start")
    yield BASE
    p.terminate()


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        exe = CHROME if os.path.exists(CHROME) else None
        b = pw.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        yield b
        b.close()


@pytest.fixture()
def page(browser, server):
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(8000)
    pg.base = server
    yield pg
    ctx.close()


def sign_in(page, email, password):
    page.goto(page.base + "/login")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password").fill(password)
    page.get_by_role("button", name="Sign in").click()
    if "wrong" not in password:
        page.wait_for_url(lambda u: "/login" not in u)
