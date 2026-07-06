"""Anaj Bahi cloud sync/backup API (FastAPI + SQLite).

Endpoints:
  GET  /health      -> {"status":"ok"}   (no auth)
  POST /sync/push   -> upsert bills/farmers/grainTypes/profile   (Bearer)
  GET  /sync/pull   -> full snapshot for restore                 (Bearer)
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .config import require_device_token, settings
from .deps import AuthDep, get_db
from .init_db import init_db
from .models import PROFILE_SINGLETON_ID, Bill, Farmer, GrainType, Profile
from .schemas import PushRequest, PushResponse, PullResponse

logger = logging.getLogger("anajbahi.sync")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast with a clear (secret-free) message if the token is unset.
    require_device_token()
    # Fresh runs work without a separate init step; init_db() is still runnable standalone.
    init_db()
    # Presence-only — never log the token value.
    logger.info("DEVICE_TOKEN configured: %s", bool(settings.device_token))
    yield


app = FastAPI(title="Anaj Bahi Sync", version="0.1.0", lifespan=lifespan)

# The static-export PWA (localhost:3000 in dev; a different origin in prod) calls
# this API cross-origin. Auth is a Bearer device token (no cookies/credentials),
# so allow_origins=["*"] is safe here and lets the browser's preflight succeed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SQLAlchemyError)
async def _sqlalchemy_error_handler(_request, exc: SQLAlchemyError) -> JSONResponse:
    # Never leak a DB stack trace to the client.
    logger.exception("Database error handling request")
    return JSONResponse(status_code=500, content={"detail": "Database error"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _require_id(record: dict, kind: str) -> str:
    rec_id = record.get("id")
    if not isinstance(rec_id, str) or not rec_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Each {kind} record must have a non-empty string 'id'",
        )
    return rec_id


@app.post("/sync/push", response_model=PushResponse, dependencies=[AuthDep])
def sync_push(payload: PushRequest, db: Session = Depends(get_db)) -> PushResponse:
    # Bills: last-write-wins by updatedAt.
    for bill in payload.bills:
        bill_id = _require_id(bill, "bill")
        incoming_updated = int(bill.get("updatedAt") or 0)
        existing = db.get(Bill, bill_id)
        if existing is None:
            db.add(Bill(id=bill_id, updated_at=incoming_updated, data=bill))
        elif incoming_updated >= existing.updated_at:
            existing.updated_at = incoming_updated
            existing.data = bill
        # else: older incoming bill -> ignore

    # Farmers: upsert-by-id, last push wins.
    for farmer in payload.farmers:
        farmer_id = _require_id(farmer, "farmer")
        existing_f = db.get(Farmer, farmer_id)
        if existing_f is None:
            db.add(Farmer(id=farmer_id, data=farmer))
        else:
            existing_f.data = farmer

    # Grain types: upsert-by-id, last push wins.
    for grain in payload.grainTypes:
        grain_id = _require_id(grain, "grain type")
        existing_g = db.get(GrainType, grain_id)
        if existing_g is None:
            db.add(GrainType(id=grain_id, data=grain))
        else:
            existing_g.data = grain

    # Profile: singleton, latest wins; null = no-op (never deletes an existing one).
    profile_count = 0
    if payload.profile is not None:
        profile_count = 1
        now_ms = int(time.time() * 1000)
        existing_p = db.get(Profile, PROFILE_SINGLETON_ID)
        if existing_p is None:
            db.add(Profile(id=PROFILE_SINGLETON_ID, updated_at=now_ms, data=payload.profile))
        else:
            existing_p.updated_at = now_ms
            existing_p.data = payload.profile

    db.commit()

    return PushResponse(
        ok=True,
        counts={
            "bills": len(payload.bills),
            "farmers": len(payload.farmers),
            "grainTypes": len(payload.grainTypes),
            "profile": profile_count,
        },
    )


@app.get("/sync/pull", response_model=PullResponse, dependencies=[AuthDep])
def sync_pull(db: Session = Depends(get_db)) -> PullResponse:
    bills = [row.data for row in db.query(Bill).all()]
    farmers = [row.data for row in db.query(Farmer).all()]
    grain_types = [row.data for row in db.query(GrainType).all()]
    profile_row = db.get(Profile, PROFILE_SINGLETON_ID)
    profile = profile_row.data if profile_row is not None else None

    return PullResponse(
        bills=bills,
        farmers=farmers,
        grainTypes=grain_types,
        profile=profile,
    )
