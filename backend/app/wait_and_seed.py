"""Launcher helper: wait for Postgres, then load the Forsyth County sample data.

Loads it the first time, and again whenever the sample data was updated (SEED_VERSION in seed.py changes).
Reloading starts the demo database fresh, so accounts made while testing are removed.
"""
import time

from sqlalchemy import text

from .db import engine
from .seed import SEED_VERSION, ensure_current

for _ in range(60):
    try:
        with engine.connect() as c:
            c.execute(text("select 1"))
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("Postgres did not start")

if ensure_current():
    print(f"Loaded Forsyth County sample data (version {SEED_VERSION}).")
else:
    print("Sample data is already up to date.")
