#!/usr/bin/env bash
# Run the LLM evalsets and FAIL LOUDLY on regressions.
#
# `adk eval` (2.5.0) always exits 0, even when cases fail - so we parse the
# "Tests failed: N" summary lines ourselves. Also: --print_detailed_results
# crashes on rubric configs (camelCase key bug in cli_eval.py), so we don't
# use it here.
#
# Requires model credentials (Vertex ADC or GOOGLE_API_KEY). Keyless envs
# should run pytest only - CI gates this script behind a secret.
set -euo pipefail
cd "$(dirname "$0")/.."

export DUKA_DB="${DUKA_DB:-/tmp/duka-eval.db}"
python -c "from agents.seed import seed; seed(force=True)"

fail_total=0
for set_name in intake support; do
  echo "=== evalset: $set_name"
  out=$(adk eval agents "evals/${set_name}.evalset.json" \
        --config_file_path "evals/${set_name}.config.json" 2>&1 | tee /dev/stderr) || true
  failed=$(echo "$out" | awk '/Tests failed:/ {print $3}' | tail -1)
  if [[ -z "${failed:-}" ]]; then
    echo "!! could not find 'Tests failed:' summary for $set_name - treating as failure"
    fail_total=$((fail_total + 1))
  else
    fail_total=$((fail_total + failed))
  fi
done

echo "=== total failed cases: $fail_total"
exit $((fail_total > 0 ? 1 : 0))
