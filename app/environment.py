"""Load local configuration without colliding with Python virtualenv folders."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_environment(env_file: str | Path | None = None) -> Path | None:
    """Load one local dotenv file while preserving real environment variables.

    ``.env.local`` is the project default because some Python workflows use a
    directory named ``.env`` for their virtual environment. An explicit
    ``DUKA_ENV_FILE`` fails closed when it does not name a regular file.
    """
    configured = env_file or os.environ.get("DUKA_ENV_FILE")
    if configured:
        path = Path(configured).expanduser()
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        if not path.is_file():
            raise RuntimeError(f"DUKA_ENV_FILE is not a file: {path}")
        load_dotenv(path, override=False)
        return path

    for path in (PROJECT_ROOT / ".env.local", PROJECT_ROOT / ".env"):
        if path.is_file():
            load_dotenv(path, override=False)
            return path
    return None
