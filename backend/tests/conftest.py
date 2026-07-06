"""Test fixtures: a TestClient backed by a real on-disk temp SQLite file per test.

Uses tmp_path (a real file), NOT :memory:, so file-DB behaviour is exercised.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

TEST_TOKEN = "test-device-token-abc123"


@pytest.fixture
def db_url(tmp_path) -> str:
    db_file = tmp_path / "anaj_test.db"
    # Forward slashes for a valid SQLAlchemy SQLite URL on any OS.
    return f"sqlite:///{db_file.as_posix()}"


@pytest.fixture
def client(db_url: str) -> Iterator[TestClient]:
    # Set env before anything reads it (belt-and-braces; we also mutate objects below).
    os.environ["DATABASE_URL"] = db_url
    os.environ["DEVICE_TOKEN"] = TEST_TOKEN

    from app import config
    from app import db as db_module
    from app import init_db as init_db_module
    from app import main

    # Point settings at the temp DB + test token.
    config.settings.database_url = db_url
    config.settings.device_token = TEST_TOKEN

    # Rebuild engine + sessionmaker bound to this test's temp file.
    engine = db_module.make_engine(db_url)
    db_module.engine = engine
    db_module.SessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, future=True
    )

    # Create tables on the temp DB (idempotent).
    init_db_module.init_db()

    with TestClient(main.app) as c:
        yield c

    engine.dispose()


def auth(token: str = TEST_TOKEN) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def sample_bill(bill_id: str = "060726/ab12x", updated_at: int = 1000) -> dict:
    """A realistic bill with embedded payments, grain lines, sacks, and deductions."""
    return {
        "id": bill_id,
        "farmerId": "farmer-1",
        "farmerName": "Ramesh Kumar",
        "farmerPlace": "Rampur",
        "purchaseDate": "2026-07-06",
        "grainTypeIds": ["wheat", "custom-bajra"],
        "lines": [
            {
                "id": "line-1",
                "grainTypeId": "wheat",
                "pricePerQuintal": 2450.5,
                "sackWeights": [50.25, 49.75, 51.0],
                "deductions": [
                    {"basis": "per_sack_kg", "value": 0.5},
                    {"basis": "percent_gross", "value": 1.0},
                ],
            },
            {
                "id": "line-2",
                "grainTypeId": "custom-bajra",
                "pricePerQuintal": 2100,
                "sackWeights": [40.0, 42.5],
                "deductions": [],
            },
        ],
        "dueDate": "2026-08-06",
        "payments": [
            {
                "id": "pay-1",
                "amount": 5000,
                "date": "2026-07-06",
                "note": "advance",
                "createdAt": 1720000000000,
            },
            {
                "id": "pay-2",
                "amount": 2500.75,
                "date": "2026-07-07",
                "createdAt": 1720100000000,
            },
        ],
        "createdAt": 1720000000000,
        "updatedAt": updated_at,
    }


def sample_farmer(farmer_id: str = "farmer-1") -> dict:
    return {
        "id": farmer_id,
        "name": "Ramesh Kumar",
        "place": "Rampur",
        "phone": "9876543210",
        "createdAt": 1720000000000,
    }


def sample_grain_types() -> list[dict]:
    return [
        {"id": "wheat", "nameEn": "Wheat", "nameHi": "गेहूं", "isCustom": 0, "createdAt": 1720000000000},
        {"id": "custom-bajra", "nameEn": "Bajra", "nameHi": "बाजरा", "isCustom": 1, "createdAt": 1720000000001},
    ]


def sample_profile() -> dict:
    return {
        "shopName": "Anaj Bhandar",
        "traderName": "Suresh Trader",
        "phone": "9998887776",
        "address": "Main Market, Rampur",
    }
