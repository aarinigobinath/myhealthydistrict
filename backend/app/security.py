from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import config
from .db import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode()[:72], hashed.encode())
    except ValueError:
        return False


def make_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=config.TOKEN_HOURS)
    return jwt.encode({"sub": str(user.id), "exp": exp}, config.SECRET_KEY, algorithm="HS256")


def _user_from(creds: HTTPAuthorizationCredentials | None, db: Session) -> User | None:
    if not creds:
        return None
    try:
        data = jwt.decode(creds.credentials, config.SECRET_KEY, algorithms=["HS256"])
        return db.get(User, int(data["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def current_user(creds=Depends(bearer), db: Session = Depends(get_db)) -> User:
    user = _user_from(creds, db)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in")
    return user


def optional_user(creds=Depends(bearer), db: Session = Depends(get_db)) -> User | None:
    return _user_from(creds, db)
