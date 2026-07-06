"""Auth + DB-session dependencies for the sync API."""

from __future__ import annotations

import secrets
from collections.abc import Iterator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from . import db as db_module
from .config import require_device_token


def get_db() -> Iterator[Session]:
    # Reference db_module.SessionLocal dynamically so tests can rebind it to a temp DB.
    db = db_module.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_auth(authorization: str | None = Header(default=None)) -> None:
    """Validate `Authorization: Bearer <DEVICE_TOKEN>` in constant time.

    Missing / malformed / wrong token -> 401. Never reveals the expected token.
    """
    expected = require_device_token()
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing device token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization:
        raise unauthorized
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise unauthorized
    if not secrets.compare_digest(token, expected):
        raise unauthorized


AuthDep = Depends(require_auth)
DbDep = Depends(get_db)
