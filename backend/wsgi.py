"""WSGI entry point — for WSGI-only hosts like PythonAnywhere's free tier.

PythonAnywhere serves WSGI apps, not ASGI/uvicorn. This drives the FastAPI
(ASGI) app from WSGI using a **fresh event loop per request**.

Why not `a2wsgi`? a2wsgi runs the ASGI app on a single shared background
event-loop thread. Under PythonAnywhere's uWSGI that deadlocks after the first
request or two (the worker serves 1–2 requests, then every request hangs to the
harakiri timeout). Running each request in its own short-lived loop is
self-contained — there is no shared loop/thread to wedge. This is fine for our
small JSON request/response API (no websockets, no streaming, no lifespan; the
DB tables are created out-of-band by `python -m app.init_db`, and auth is
per-request, so the ASGI lifespan is not needed here).

uvicorn / Docker deploys ignore this file and keep using `app.main:app`.
"""

from __future__ import annotations

import asyncio
from http import HTTPStatus
from urllib.parse import unquote

from app.main import app


def _reason(code: int) -> str:
    try:
        return HTTPStatus(code).phrase
    except ValueError:
        return ""


def _request_body(environ) -> bytes:
    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except (TypeError, ValueError):
        length = 0
    if length > 0:
        return environ["wsgi.input"].read(length)
    return b""


def _asgi_headers(environ) -> list[tuple[bytes, bytes]]:
    headers: list[tuple[bytes, bytes]] = []
    for key, value in environ.items():
        if key.startswith("HTTP_"):
            name = key[5:].replace("_", "-").lower()
            headers.append((name.encode("latin-1"), value.encode("latin-1")))
    if environ.get("CONTENT_TYPE"):
        headers.append((b"content-type", environ["CONTENT_TYPE"].encode("latin-1")))
    if environ.get("CONTENT_LENGTH"):
        headers.append((b"content-length", environ["CONTENT_LENGTH"].encode("latin-1")))
    return headers


def application(environ, start_response):
    body_in = _request_body(environ)
    path = environ.get("PATH_INFO", "") or "/"

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": environ.get("REQUEST_METHOD", "GET"),
        "scheme": environ.get("wsgi.url_scheme", "http"),
        "path": unquote(path),
        "raw_path": path.encode("latin-1"),
        "query_string": (environ.get("QUERY_STRING", "") or "").encode("latin-1"),
        "root_path": "",
        "headers": _asgi_headers(environ),
        "server": (environ.get("SERVER_NAME", ""), int(environ.get("SERVER_PORT") or 0)),
        "client": (environ.get("REMOTE_ADDR", ""), 0),
    }

    sent = {"body": False}

    async def receive():
        if not sent["body"]:
            sent["body"] = True
            return {"type": "http.request", "body": body_in, "more_body": False}
        return {"type": "http.disconnect"}

    response: dict = {"status": 500, "headers": [], "body": bytearray()}

    async def send(message):
        if message["type"] == "http.response.start":
            response["status"] = message["status"]
            response["headers"] = message.get("headers", [])
        elif message["type"] == "http.response.body":
            response["body"].extend(message.get("body", b""))

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(app(scope, receive, send))
    finally:
        loop.close()

    status_line = f"{response['status']} {_reason(response['status'])}".rstrip()
    wsgi_headers = [
        (k.decode("latin-1"), v.decode("latin-1")) for k, v in response["headers"]
    ]
    start_response(status_line, wsgi_headers)
    return [bytes(response["body"])]
