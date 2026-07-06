# Anaj Bahi cloud sync/backup backend — FastAPI + SQLite.
# Deploys to Fly.io with the SQLite file on a persistent volume at /data.
FROM python:3.12-slim

# No .pyc files, unbuffered logs (so Fly captures stdout immediately).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Runtime deps only — pinned to match pyproject.toml. Kept explicit (rather than
# installing from pyproject) so the image builds without uv/build tooling.
RUN pip install --no-cache-dir \
    "fastapi>=0.115" \
    "uvicorn[standard]>=0.30" \
    "sqlalchemy>=2" \
    "pydantic-settings>=2"

# Application package.
COPY app ./app

# Fly routes public HTTPS to this internal port.
EXPOSE 8080

# Create the SQLite tables (idempotent) on the mounted volume, then serve.
# DATABASE_URL (sqlite:////data/anaj.db) + DEVICE_TOKEN come from fly.toml / secrets.
CMD ["sh", "-c", "python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port 8080"]
