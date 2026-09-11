#!/usr/bin/env python3
from pathlib import Path

p = Path('tests/executor/workflow-executor.test.ts')
text = p.read_text()
old = """  assert.deepEqual(
    selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'low', changedFiles: ['src/ui/a.tsx'] },
      { id: 's2', risk: 'low', changedFiles: ['src/ui/b.tsx'] },
    ]),
    ['contracts', 'regression']
  );

  assert.deepEqual(
    selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'critical', changedFiles: ['src/server/auth/session.ts'] },
    ]),
    ['contracts', 'authorization', 'semantics', 'regression']
  );"""
new = """  assert.equal(
    Array.from(selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'low', changedFiles: ['src/ui/a.tsx'] },
      { id: 's2', risk: 'low', changedFiles: ['src/ui/b.tsx'] },
    ])).join(','),
    'contracts,regression'
  );

  assert.equal(
    Array.from(selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'critical', changedFiles: ['src/server/auth/session.ts'] },
    ])).join(','),
    'contracts,authorization,semantics,regression'
  );"""
if old not in text:
    raise SystemExit('adaptive review test block not found')
p.write_text(text.replace(old, new, 1))
