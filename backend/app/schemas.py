"""Wire shapes for /sync/push and /sync/pull.

Records are accepted as loose dicts so unknown nested fields round-trip faithfully;
only the keys the server needs (id, updatedAt) are read out explicitly in the route.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class PushRequest(BaseModel):
    bills: list[dict[str, Any]] = []
    farmers: list[dict[str, Any]] = []
    grainTypes: list[dict[str, Any]] = []
    profile: dict[str, Any] | None = None


class PushCounts(BaseModel):
    bills: int
    farmers: int
    grainTypes: int
    profile: int


class PushResponse(BaseModel):
    ok: bool
    counts: PushCounts


class PullResponse(BaseModel):
    bills: list[dict[str, Any]]
    farmers: list[dict[str, Any]]
    grainTypes: list[dict[str, Any]]
    profile: dict[str, Any] | None
