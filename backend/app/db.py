"""SQLAlchemy 2.0 engine + sessionmaker for the SQLite file DB."""

from __future__ import annotations

import os
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_dir(database_url: str) -> None:
    """For a file-backed SQLite URL, make sure the parent directory exists."""
    if not database_url.startswith("sqlite"):
        return
    # sqlite:///./data/anaj.db  ->  path part after the scheme's ':///'
    prefix = "sqlite:///"
    if database_url.startswith(prefix):
        path = database_url[len(prefix):]
    else:
        # e.g. sqlite:////absolute/path or sqlite://
        path = urlparse(database_url).path
    if not path or path == ":memory:":
        return
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


def make_engine(database_url: str | None = None):
    url = database_url or settings.database_url
    _ensure_sqlite_dir(url)
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, future=True)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
