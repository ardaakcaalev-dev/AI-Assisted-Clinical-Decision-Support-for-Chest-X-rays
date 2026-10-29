from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from app.core.database import get_db
from app.models.admin import Admin
from app.models.doctor import Doctor
from app.models.patient import Patient

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ROLE_MODELS = {"doctor": Doctor, "patient": Patient, "admin": Admin}


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a password against its bcrypt hash. Plain-text values never match."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Geçersiz kimlik doğrulama bilgisi. Lütfen tekrar giriş yapın.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise credentials_exception

    email, role = payload.get("sub"), payload.get("role")
    model = ROLE_MODELS.get(role)
    if email is None or model is None:
        raise credentials_exception

    user = db.query(model).filter(model.email == email).first()
    if user is None:
        raise credentials_exception
    return {"user": user, "role": role}


# ---------------------------------------------------------------------------
# Role-based access control
# ---------------------------------------------------------------------------
FORBIDDEN = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok.")


def require_roles(*roles: str):
    """Dependency factory: only users whose role is in `roles` may call the endpoint."""

    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise FORBIDDEN
        return current_user

    return dependency


def is_self(current_user: dict, role: str, user_id: int) -> bool:
    return current_user["role"] == role and current_user["user"].id == user_id


def ensure_self_or_roles(current_user: dict, role: str, user_id: int, *allowed_roles: str) -> None:
    """Allow the user who owns the resource (`role` + `user_id`), or anyone with one of `allowed_roles`."""
    if current_user["role"] in allowed_roles or is_self(current_user, role, user_id):
        return
    raise FORBIDDEN
