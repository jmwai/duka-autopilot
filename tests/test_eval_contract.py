"""ADK evalsets remain schema-valid and aligned with the release wrapper."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess

from google.adk.evaluation.eval_config import EvalConfig
from google.adk.evaluation.eval_set import EvalSet


def test_release_eval_contract_is_schema_valid_and_complete():
    root = Path(__file__).resolve().parent.parent
    expected = {"intake": 6, "support": 10, "safety": 4}
    all_ids: set[str] = set()

    for name, count in expected.items():
        eval_path = root / f"evals/{name}.evalset.json"
        config_path = root / f"evals/{name}.config.json"
        eval_set = EvalSet.model_validate_json(eval_path.read_text())
        config_text = config_path.read_text()
        EvalConfig.model_validate_json(config_text)
        raw_config = json.loads(config_text)

        assert eval_set.eval_set_id == name
        assert len(eval_set.eval_cases) == count
        for case in eval_set.eval_cases:
            assert case.eval_id not in all_ids
            all_ids.add(case.eval_id)
            assert case.session_input is not None
            assert case.session_input.app_name == "agents"
            assert case.session_input.state["actor_role"] == "customer"
        for criterion in raw_config["criteria"].values():
            options = criterion["judgeModelOptions"]
            assert options == {
                "judgeModel": "gemini-3.7-flash",
                "numSamples": 3,
            }

    wrapper = (root / "scripts/run_evals.sh").read_text()
    workflow = (root / ".github/workflows/model-eval.yml").read_text()
    for name, count in expected.items():
        assert f"{name}) expected={count}" in wrapper
        assert f"eval-{name}.txt" in workflow
    assert 'expected 20' in wrapper
    assert 'eval-summary.json' in wrapper
    assert 'eval-summary.json' in workflow

    manifest_expr = next(
        line for line in workflow.splitlines() if "evalsets:" in line)
    manifest_names = json.loads(
        "[" + manifest_expr.split("evalsets:[", 1)[1].split("]", 1)[0] + "]")
    assert manifest_names == list(expected)


def _run_fake_eval_wrapper(tmp_path: Path, safety_failure: bool):
    root = Path(__file__).resolve().parent.parent
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    python = fake_bin / "python"
    python.write_text("#!/bin/sh\nexit 0\n")
    python.chmod(0o755)
    adk = fake_bin / "adk"
    adk.write_text(
        "#!/bin/sh\n"
        "case \"$*\" in\n"
        "  *intake*) passed=6; failed=0 ;;\n"
        "  *support*) passed=10; failed=0 ;;\n"
        "  *safety*)\n"
        "    if [ \"${DUKA_FAKE_SAFETY_FAIL:-0}\" = 1 ]; then\n"
        "      passed=3; failed=1\n"
        "    else\n"
        "      passed=4; failed=0\n"
        "    fi ;;\n"
        "esac\n"
        "echo \"Tests passed: $passed\"\n"
        "echo \"Tests failed: $failed\"\n"
        "exit 0\n"
    )
    adk.chmod(0o755)
    output_dir = tmp_path / "evidence"
    env = {
        **os.environ,
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "EVAL_OUTPUT_DIR": str(output_dir),
        "DUKA_DB": str(tmp_path / "eval.db"),
        "GITHUB_SHA": "a" * 40,
        "DUKA_FAKE_SAFETY_FAIL": "1" if safety_failure else "0",
    }
    result = subprocess.run(
        ["bash", "scripts/run_evals.sh"], cwd=root, env=env,
        text=True, capture_output=True, check=False,
    )
    summary = json.loads((output_dir / "eval-summary.json").read_text())
    return result, summary


def test_eval_wrapper_emits_machine_readable_success(tmp_path):
    result, summary = _run_fake_eval_wrapper(tmp_path, safety_failure=False)
    assert result.returncode == 0
    assert summary["success"] is True
    assert (summary["expected"], summary["passed"], summary["failed"]) == (
        20, 20, 0)
    assert [item["name"] for item in summary["evalsets"]] == [
        "intake", "support", "safety"]


def test_eval_wrapper_fails_closed_even_when_adk_exits_zero(tmp_path):
    result, summary = _run_fake_eval_wrapper(tmp_path, safety_failure=True)
    assert result.returncode == 1
    assert summary["success"] is False
    assert summary["passed"] == 19
    assert summary["failed"] == 1
    assert summary["gate_failures"] > 0
