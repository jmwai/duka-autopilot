#!/usr/bin/env bash
# Run the LLM evalsets and FAIL LOUDLY on regressions.
#
# `adk eval` 2.7.1 still exits 0 when a case fails, so this wrapper treats the
# printed pass/fail totals as the release contract. Detailed output is retained
# as evidence and each evalset starts from a freshly seeded database.
#
# Requires model credentials (Vertex ADC or GOOGLE_API_KEY). Keyless envs
# should run pytest only - CI gates this script behind a secret.
set -euo pipefail
cd "$(dirname "$0")/.."

export DUKA_DB="${DUKA_DB:-/tmp/duka-eval.db}"
output_dir="${EVAL_OUTPUT_DIR:-/tmp/duka-adk-eval}"
mkdir -p "$output_dir"

fail_total=0
passed_total=0
failed_case_total=0
results_json='[]'
for set_name in intake support safety; do
  case "$set_name" in
    intake) expected=6 ;;
    support) expected=10 ;;
    safety) expected=4 ;;
  esac
  python -m agents.seed --force
  echo "=== evalset: $set_name"
  log="$output_dir/eval-${set_name}.txt"
  set +e
  adk eval agents "evals/${set_name}.evalset.json" \
    --config_file_path "evals/${set_name}.config.json" \
    --print_detailed_results 2>&1 | tee "$log"
  cli_status=${PIPESTATUS[0]}
  set -e
  passed=$(awk '/Tests passed:/ {print $3}' "$log" | tail -1)
  failed=$(awk '/Tests failed:/ {print $3}' "$log" | tail -1)
  result_status="passed"
  if [[ "$cli_status" -ne 0 || -z "${passed:-}" || -z "${failed:-}" ]]; then
    echo "!! missing/invalid ADK summary for $set_name (cli=$cli_status)"
    fail_total=$((fail_total + 1))
    result_status="invalid_summary"
    record_passed=0
    record_failed=$expected
  elif [[ "$passed" -ne "$expected" || "$failed" -ne 0 ]]; then
    echo "!! $set_name expected $expected passed / 0 failed; got $passed / $failed"
    fail_total=$((fail_total + failed + (passed != expected ? 1 : 0)))
    result_status="failed"
    record_passed=$passed
    record_failed=$failed
  else
    echo "ok: $set_name passed all $expected cases"
    record_passed=$passed
    record_failed=$failed
  fi
  passed_total=$((passed_total + record_passed))
  failed_case_total=$((failed_case_total + record_failed))
  results_json=$(jq -c \
    --arg name "$set_name" \
    --arg status "$result_status" \
    --arg log "eval-${set_name}.txt" \
    --argjson expected "$expected" \
    --argjson passed "$record_passed" \
    --argjson failed "$record_failed" \
    --argjson cli_status "$cli_status" \
    '. + [{name:$name,status:$status,expected:$expected,passed:$passed,failed:$failed,cli_status:$cli_status,log:$log}]' \
    <<<"$results_json")
done

echo "=== total failed cases: $fail_total"
jq -n \
  --arg release_sha "${GITHUB_SHA:-local-uncommitted}" \
  --arg model "${GEMINI_MODEL:-gemini-3.7-flash}" \
  --arg model_location "${GOOGLE_CLOUD_LOCATION:-global}" \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson expected 20 \
  --argjson passed "$passed_total" \
  --argjson failed "$failed_case_total" \
  --argjson gate_failures "$fail_total" \
  --argjson results "$results_json" \
  '{release_sha:$release_sha,model:$model,model_location:$model_location,generated_at:$generated_at,expected:$expected,passed:$passed,failed:$failed,gate_failures:$gate_failures,success:($gate_failures == 0),evalsets:$results}' \
  >"$output_dir/eval-summary.json"
exit $((fail_total > 0 ? 1 : 0))
