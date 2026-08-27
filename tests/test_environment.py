from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import environment
from app.environment import load_environment


def test_explicit_environment_file_loads_without_overwriting_process_values(
        tmp_path, monkeypatch):
    path = tmp_path / "duka.env"
    path.write_text("DUKA_TEST_FROM_FILE=loaded\nDUKA_TEST_PRECEDENCE=file\n")
    monkeypatch.setenv("DUKA_TEST_PRECEDENCE", "process")

    assert load_environment(path) == path
    assert os.environ["DUKA_TEST_FROM_FILE"] == "loaded"
    assert os.environ["DUKA_TEST_PRECEDENCE"] == "process"
    monkeypatch.delenv("DUKA_TEST_FROM_FILE")


def test_explicit_environment_path_must_be_a_regular_file(tmp_path):
    with pytest.raises(RuntimeError, match="DUKA_ENV_FILE is not a file"):
        load_environment(tmp_path)


def test_default_loader_ignores_dot_env_virtualenv_directory(
        tmp_path, monkeypatch):
    (tmp_path / ".env").mkdir()
    (tmp_path / ".env" / "pyvenv.cfg").write_text("home = python\n")
    local = tmp_path / ".env.local"
    local.write_text("DUKA_TEST_VIRTUALENV_COLLISION=avoided\n")
    monkeypatch.setattr(environment, "PROJECT_ROOT", tmp_path)
    monkeypatch.delenv("DUKA_ENV_FILE", raising=False)

    assert load_environment() == local
    assert os.environ["DUKA_TEST_VIRTUALENV_COLLISION"] == "avoided"
    monkeypatch.delenv("DUKA_TEST_VIRTUALENV_COLLISION")
