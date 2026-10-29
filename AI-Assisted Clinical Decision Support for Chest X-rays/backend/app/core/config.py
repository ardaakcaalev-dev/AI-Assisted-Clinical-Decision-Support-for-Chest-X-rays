"""Application settings, loaded from environment variables (see backend/.env.example)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            f"Copy backend/.env.example to backend/.env and fill it in."
        )
    return value


DATABASE_URL = _required("DATABASE_URL")
SECRET_KEY = _required("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Optional: the AI endpoints report a clear error if these are not set.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
DENSENET_WEIGHTS_PATH = os.getenv("DENSENET_WEIGHTS_PATH", str(BACKEND_DIR / "weights" / "densenet121_nih.pth"))
VIT_WEIGHTS_PATH = os.getenv("VIT_WEIGHTS_PATH", str(BACKEND_DIR / "weights" / "vit_nih.pt"))

# Public base URL of this API, used to build links to uploaded files.
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
UPLOAD_DIR = BACKEND_DIR / "uploads"

# Comma-separated list of frontend origins allowed by CORS.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Demo admin created on startup if no admin exists. Leave the password empty to skip.
DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@hekim.com")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "")
