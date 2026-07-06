"""Integration tests for the sync API against a real on-disk temp SQLite file."""

from __future__ import annotations

from tests.conftest import (
    auth,
    sample_bill,
    sample_farmer,
    sample_grain_types,
    sample_profile,
)


def test_health_no_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_auth_required(client):
    empty = {"bills": [], "farmers": [], "grainTypes": [], "profile": None}

    # No token -> 401
    assert client.post("/sync/push", json=empty).status_code == 401
    assert client.get("/sync/pull").status_code == 401

    # Wrong token -> 401
    assert client.post("/sync/push", json=empty, headers=auth("wrong")).status_code == 401
    assert client.get("/sync/pull", headers=auth("wrong")).status_code == 401

    # Malformed (no Bearer scheme) -> 401
    assert (
        client.get("/sync/pull", headers={"Authorization": "test-device-token-abc123"}).status_code
        == 401
    )

    # Correct token -> 200
    assert client.post("/sync/push", json=empty, headers=auth()).status_code == 200
    assert client.get("/sync/pull", headers=auth()).status_code == 200


def test_push_pull_roundtrip(client):
    bill = sample_bill()
    farmer = sample_farmer()
    grains = sample_grain_types()
    profile = sample_profile()

    push = client.post(
        "/sync/push",
        json={"bills": [bill], "farmers": [farmer], "grainTypes": grains, "profile": profile},
        headers=auth(),
    )
    assert push.status_code == 200
    assert push.json() == {
        "ok": True,
        "counts": {"bills": 1, "farmers": 1, "grainTypes": 2, "profile": 1},
    }

    pull = client.get("/sync/pull", headers=auth())
    assert pull.status_code == 200
    body = pull.json()

    # Bill round-trips byte-faithfully, nested structures intact.
    assert body["bills"] == [bill]
    pulled_bill = body["bills"][0]
    assert pulled_bill["lines"][0]["sackWeights"] == [50.25, 49.75, 51.0]
    assert pulled_bill["lines"][0]["deductions"] == [
        {"basis": "per_sack_kg", "value": 0.5},
        {"basis": "percent_gross", "value": 1.0},
    ]
    assert pulled_bill["payments"][0]["note"] == "advance"
    assert pulled_bill["payments"][1]["amount"] == 2500.75
    assert pulled_bill["updatedAt"] == 1000

    assert body["farmers"] == [farmer]
    assert body["grainTypes"] == grains
    assert body["profile"] == profile


def test_lww_bills(client):
    # v1 @ updatedAt=1000
    v1 = sample_bill(updated_at=1000)
    v1["farmerName"] = "Version One"
    client.post("/sync/push", json={"bills": [v1], "farmers": [], "grainTypes": [], "profile": None}, headers=auth())

    # v2 @ updatedAt=2000 (newer, changed) -> wins
    v2 = sample_bill(updated_at=2000)
    v2["farmerName"] = "Version Two"
    client.post("/sync/push", json={"bills": [v2], "farmers": [], "grainTypes": [], "profile": None}, headers=auth())

    body = client.get("/sync/pull", headers=auth()).json()
    assert len(body["bills"]) == 1
    assert body["bills"][0]["farmerName"] == "Version Two"
    assert body["bills"][0]["updatedAt"] == 2000

    # Older push @ updatedAt=1500 -> ignored, v2 stays.
    v_old = sample_bill(updated_at=1500)
    v_old["farmerName"] = "Stale Version"
    client.post("/sync/push", json={"bills": [v_old], "farmers": [], "grainTypes": [], "profile": None}, headers=auth())

    body = client.get("/sync/pull", headers=auth()).json()
    assert len(body["bills"]) == 1
    assert body["bills"][0]["farmerName"] == "Version Two"
    assert body["bills"][0]["updatedAt"] == 2000


def test_idempotent(client):
    payload = {
        "bills": [sample_bill()],
        "farmers": [sample_farmer()],
        "grainTypes": sample_grain_types(),
        "profile": sample_profile(),
    }

    r1 = client.post("/sync/push", json=payload, headers=auth())
    first = client.get("/sync/pull", headers=auth()).json()

    r2 = client.post("/sync/push", json=payload, headers=auth())
    second = client.get("/sync/pull", headers=auth()).json()

    assert r1.json() == r2.json()  # counts reflect rows received, identical both times
    assert first == second  # no duplicates, no change

    # Exactly one row per id after re-push.
    assert len(second["bills"]) == 1
    assert len(second["farmers"]) == 1
    assert len(second["grainTypes"]) == 2
    assert second["profile"] is not None


def test_profile_null_is_noop(client):
    # Establish a profile.
    client.post(
        "/sync/push",
        json={"bills": [], "farmers": [], "grainTypes": [], "profile": sample_profile()},
        headers=auth(),
    )
    # Push with profile=null must NOT delete the existing one, and counts.profile == 0.
    resp = client.post(
        "/sync/push",
        json={"bills": [], "farmers": [], "grainTypes": [], "profile": None},
        headers=auth(),
    )
    assert resp.json()["counts"]["profile"] == 0
    body = client.get("/sync/pull", headers=auth()).json()
    assert body["profile"] == sample_profile()


def test_empty_push(client):
    # Edge case: entirely empty payload is valid and a no-op.
    resp = client.post(
        "/sync/push",
        json={"bills": [], "farmers": [], "grainTypes": [], "profile": None},
        headers=auth(),
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "ok": True,
        "counts": {"bills": 0, "farmers": 0, "grainTypes": 0, "profile": 0},
    }
    body = client.get("/sync/pull", headers=auth()).json()
    assert body == {"bills": [], "farmers": [], "grainTypes": [], "profile": None}


def test_bill_missing_id_rejected(client):
    # Error path: a bill without an id is a bad request (not a 500).
    bad = sample_bill()
    del bad["id"]
    resp = client.post(
        "/sync/push",
        json={"bills": [bad], "farmers": [], "grainTypes": [], "profile": None},
        headers=auth(),
    )
    assert resp.status_code == 400
