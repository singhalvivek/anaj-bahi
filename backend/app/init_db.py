"""Create the SQLite file + tables. Idempotent. Run: `uv run python -m app.init_db`."""

from __future__ import annotations

from . import db as db_module

# Import models so their tables register on Base.metadata.
from . import models  # noqa: F401


def init_db() -> None:
    # Reference db_module.engine dynamically so tests can rebind it to a temp DB.
    db_module.Base.metadata.create_all(db_module.engine)


def main() -> None:
    init_db()
    print(f"Initialised database tables at: {db_module.engine.url}")


if __name__ == "__main__":
    main()
