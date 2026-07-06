"""CORS tests proving the browser cross-origin path works.

The PWA runs at a different origin (localhost:3000 in dev) than the API
(localhost:8000), so the browser fires a preflight OPTIONS before POST /sync/push
and expects Access-Control-Allow-Origin on the real responses. Starlette's
TestClient runs the middleware, so this is verifiable without a browser.
"""

from __future__ import annotations

from tests.conftest import auth

PWA_ORIGIN = "http://localhost:3000"


def test_preflight_sync_push_allows_cors(client):
    # Browser preflight for the cross-origin POST /sync/push.
    resp = client.options(
        "/sync/push",
        headers={
            "Origin": PWA_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert 200 <= resp.status_code < 300
    assert "access-control-allow-origin" in resp.headers
    # Method the browser asked about must be permitted.
    assert "POST" in resp.headers.get("access-control-allow-methods", "")


def test_health_response_carries_cors_header(client):
    # A normal (non-preflight) request with an Origin gets the ACAO header too.
    resp = client.get("/health", headers={"Origin": PWA_ORIGIN})
    assert resp.status_code == 200
    assert "access-control-allow-origin" in resp.headers


def test_authed_pull_carries_cors_header(client):
    # The real authed cross-origin request also carries the ACAO header.
    resp = client.get("/sync/pull", headers={"Origin": PWA_ORIGIN, **auth()})
    assert resp.status_code == 200
    assert "access-control-allow-origin" in resp.headers
