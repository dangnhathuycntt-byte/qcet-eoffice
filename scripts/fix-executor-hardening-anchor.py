#!/usr/bin/env python3
from pathlib import Path

p = Path('scripts/apply-executor-hardening-v15.py')
text = p.read_text()
old = "  // ===========================================================================\\n  // DEPENDENCY-READY DAG SCHEDULER"
new = "  // ---------------------------------------------------------------------------\\n  // CREATE BLOCKED RESULT"
if old not in text:
    raise SystemExit('temporary patch anchor not found')
p.write_text(text.replace(old, new, 1))
