"""Schema-light storage model: one row per client record, data stored verbatim as JSON.

Matches the FROZEN Phase-4 storage model in architecture.md § Phase-4 sync contract.
The server round-trips the exact frontend record shapes without re-modelling them.
"""

from __future__ import annotations

from sqlalchemy import JSON, BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

PROFILE_SINGLETON_ID = "singleton"


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    # Client `updatedAt` (epoch ms); drives last-write-wins.
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class Farmer(Base):
    __tablename__ = "farmers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class GrainType(Base):
    __tablename__ = "grain_types"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class Profile(Base):
    __tablename__ = "profile"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=PROFILE_SINGLETON_ID)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
