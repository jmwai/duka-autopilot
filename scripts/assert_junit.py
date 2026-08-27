#!/usr/bin/env python3
"""Assert release-level JUnit invariants without an extra test dependency."""
from __future__ import annotations

import argparse
import xml.etree.ElementTree as ET


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--max-skipped", type=int, default=0)
    args = parser.parse_args()
    root = ET.parse(args.path).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
    totals = {
        key: sum(int(suite.attrib.get(key, "0")) for suite in suites)
        for key in ("tests", "failures", "errors", "skipped")
    }
    if totals["failures"] or totals["errors"]:
        raise SystemExit(f"JUnit contains failures/errors: {totals}")
    if totals["skipped"] > args.max_skipped:
        raise SystemExit(
            f"JUnit skipped {totals['skipped']} tests; maximum is "
            f"{args.max_skipped}: {totals}")
    print(totals)


if __name__ == "__main__":
    main()
