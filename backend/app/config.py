import os

DATABASE_URL = os.getenv(
    "MHD_DATABASE_URL", "postgresql+psycopg2://mhd:mhd_dev_pw@localhost:5432/mhd"
)
# Change this in any real deployment (set MHD_SECRET_KEY).
SECRET_KEY = os.getenv("MHD_SECRET_KEY", "dev-only-change-me-please-0123456789abcdef")
TOKEN_HOURS = int(os.getenv("MHD_TOKEN_HOURS", "12"))
ALLOWED_ORIGINS = os.getenv(
    "MHD_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
# If this folder exists, the API also serves the built React app (single-port deploy).
STATIC_DIR = os.getenv("MHD_STATIC_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

# The county's official health events calendar (shown as "See the full official county calendar").
COUNTY_CALENDAR_URL = "https://www.forsythco.com/calendar/?event_category=165"
