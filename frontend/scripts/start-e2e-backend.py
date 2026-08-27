"""Start a deterministic local API for Playwright only."""
from __future__ import annotations

import os
import sys
from pathlib import Path


FRONTEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = FRONTEND_ROOT.parent
STATE_DIR = FRONTEND_ROOT / ".e2e"
STATE_DIR.mkdir(exist_ok=True)

os.environ["DUKA_ENV"] = "local"
os.environ["DUKA_STORE"] = "sqlite"
os.environ["DUKA_BUS"] = "local"
os.environ["DUKA_DB"] = str(STATE_DIR / "duka.db")
os.environ["RELEASE_SHA"] = "playwright-local"

os.chdir(REPO_ROOT)
sys.path.insert(0, str(REPO_ROOT))

from agents.seed import seed  # noqa: E402

seed(force=True)

import uvicorn  # noqa: E402

uvicorn.run("app.main:app", host="127.0.0.1", port=8100, workers=1)
