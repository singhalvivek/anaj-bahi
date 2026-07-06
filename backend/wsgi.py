"""WSGI entry point — for WSGI-only hosts like PythonAnywhere's free tier.

PythonAnywhere serves WSGI apps, not ASGI/uvicorn, so `uvicorn app.main:app`
can't be the web app there. `a2wsgi.ASGIMiddleware` wraps the FastAPI (ASGI)
app so it runs under a WSGI server. Our endpoints are plain JSON
request/response (no websockets/streaming), which a2wsgi handles cleanly.

The PythonAnywhere WSGI config file should, BEFORE importing this module:
  - put this directory (backend/) on sys.path, and
  - set os.environ["DATABASE_URL"] and os.environ["DEVICE_TOKEN"]
then expose `application` from here. See DEPLOY.md → "PythonAnywhere".

uvicorn / Docker / Fly deploys ignore this file and keep using app.main:app.
"""

from a2wsgi import ASGIMiddleware

from app.main import app

# The name PythonAnywhere's WSGI server looks for by default.
application = ASGIMiddleware(app)
