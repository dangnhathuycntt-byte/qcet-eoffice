# S-PERF — Baseline vs Candidate (§28 Q5)

- Baseline: `baseline` @ 2026-09-13T03:46:22.364Z (5 runs/cell)
- Candidate: `candidate` @ 2026-09-13T03:55:08.732Z (5 runs/cell)
- p75 semantics: lab p75 across 5 runs (NOT field p75). See METHODOLOGY.md.
- Candidate provenance: Candidate is a same-checkout re-run of baseline: S-PERF changes no application code, so deltas are measurement variance, not a code effect.
- Same checkout: true (recorded gitSha equality).
- Noise policy: INP <8ms, CLS <0.01, paint <max(10ms, 5% baseline) are labelled `noise` (run-to-run variance, not signal).

| route | viewport | metric | baseline p75 | candidate p75 | delta | % | verdict |
|---|---|---|---|---|---|---|---|
| home | desktop | LCP | 268 | 344 | 76 | 28.4 | variance-same-checkout |
| home | desktop | CLS | 0.011 | 0.011 | 0 | 0 | noise |
| home | desktop | TTFB | 110.1 | 121.7 | 11.6 | 10.5 | within-headroom |
| home | desktop | FCP | 248 | 280 | 32 | 12.9 | within-headroom |
| tasks-table | desktop | LCP | 3296 | 3312 | 16 | 0.5 | noise |
| tasks-table | desktop | INP | 72 | 72 | 0 | 0 | noise |
| tasks-table | desktop | CLS | 0.062 | 0.062 | 0 | 0 | noise |
| tasks-table | desktop | TTFB | 112.2 | 108 | -4.2 | -3.7 | noise |
| tasks-table | desktop | FCP | 256 | 252 | -4 | -1.6 | noise |
| tasks-kanban | desktop | LCP | 720 | 848 | 128 | 17.8 | within-headroom |
| tasks-kanban | desktop | CLS | 0.102 | 0.062 | -0.04 | -39.2 | improved/stable |
| tasks-kanban | desktop | TTFB | 100.9 | 112.8 | 11.9 | 11.8 | within-headroom |
| tasks-kanban | desktop | FCP | 252 | 284 | 32 | 12.7 | within-headroom |
| tasks-detail | desktop | LCP | 832 | 876 | 44 | 5.3 | within-headroom |
| tasks-detail | desktop | CLS | 0.063 | 0.063 | 0 | 0 | noise |
| tasks-detail | desktop | TTFB | 106.8 | 114.4 | 7.6 | 7.1 | noise |
| tasks-detail | desktop | FCP | 240 | 308 | 68 | 28.3 | variance-same-checkout |
| tasks-open-detail | desktop | LCP | 3196 | 3216 | 20 | 0.6 | noise |
| tasks-open-detail | desktop | INP | 152 | 160 | 8 | 5.3 | within-headroom |
| tasks-open-detail | desktop | CLS | 0.062 | 0.062 | 0 | 0 | noise |
| tasks-open-detail | desktop | TTFB | 30.6 | 48.1 | 17.5 | 57.2 | variance-same-checkout |
| tasks-open-detail | desktop | FCP | 256 | 220 | -36 | -14.1 | improved/stable |
| tasks-search | desktop | LCP | 3188 | 3196 | 8 | 0.3 | noise |
| tasks-search | desktop | INP | 72 | 80 | 8 | 11.1 | within-headroom |
| tasks-search | desktop | CLS | 0.062 | 0.062 | 0 | 0 | noise |
| tasks-search | desktop | TTFB | 28.7 | 34.2 | 5.5 | 19.2 | noise |
| tasks-search | desktop | FCP | 192 | 196 | 4 | 2.1 | noise |
| tasks-bulk | desktop | LCP | 3188 | 3276 | 88 | 2.8 | noise |
| tasks-bulk | desktop | INP | 32 | 32 | 0 | 0 | noise |
| tasks-bulk | desktop | CLS | 0.062 | 0.062 | 0 | 0 | noise |
| tasks-bulk | desktop | TTFB | 40.6 | 104.7 | 64.1 | 157.9 | variance-same-checkout |
| tasks-bulk | desktop | FCP | 216 | 232 | 16 | 7.4 | within-headroom |
| calendar | desktop | LCP | 232 | 236 | 4 | 1.7 | noise |
| calendar | desktop | INP | 120 | 136 | 16 | 13.3 | within-headroom |
| calendar | desktop | CLS | 0.001 | 0.001 | 0 | 0 | noise |
| calendar | desktop | TTFB | 7.3 | 8 | 0.7 | 9.6 | noise |
| calendar | desktop | FCP | 116 | 108 | -8 | -6.9 | noise |
| notifications | desktop | LCP | 256 | 268 | 12 | 4.7 | noise |
| notifications | desktop | CLS | 0.001 | 0.001 | 0 | 0 | noise |
| notifications | desktop | TTFB | 7.9 | 8.2 | 0.3 | 3.8 | noise |
| notifications | desktop | FCP | 140 | 144 | 4 | 2.9 | noise |
| documents | desktop | LCP | 136 | 168 | 32 | 23.5 | within-headroom |
| documents | desktop | CLS | 0.002 | 0.002 | 0 | 0 | noise |
| documents | desktop | TTFB | 7.5 | 7.9 | 0.4 | 5.3 | noise |
| documents | desktop | FCP | 136 | 168 | 32 | 23.5 | within-headroom |
| org | desktop | LCP | 300 | 292 | -8 | -2.7 | noise |
| org | desktop | CLS | 0.001 | 0.001 | 0 | 0 | noise |
| org | desktop | TTFB | 8 | 8.5 | 0.5 | 6.3 | noise |
| org | desktop | FCP | 132 | 108 | -24 | -18.2 | improved/stable |
| command-search | desktop | LCP | 324 | 328 | 4 | 1.2 | noise |
| command-search | desktop | INP | 136 | 128 | -8 | -5.9 | improved/stable |
| command-search | desktop | CLS | 0.011 | 0.011 | 0 | 0 | noise |
| command-search | desktop | TTFB | 113.2 | 113.8 | 0.6 | 0.5 | noise |
| command-search | desktop | FCP | 288 | 288 | 0 | 0 | noise |
| home | mobile | LCP | 324 | 316 | -8 | -2.5 | noise |
| home | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| home | mobile | TTFB | 121.1 | 114.7 | -6.4 | -5.3 | noise |
| home | mobile | FCP | 256 | 260 | 4 | 1.6 | noise |
| tasks-table | mobile | LCP | 3172 | 3152 | -20 | -0.6 | noise |
| tasks-table | mobile | INP | 56 | 56 | 0 | 0 | noise |
| tasks-table | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| tasks-table | mobile | TTFB | 95.2 | 84.2 | -11 | -11.6 | improved/stable |
| tasks-table | mobile | FCP | 244 | 240 | -4 | -1.6 | noise |
| tasks-kanban | mobile | LCP | 692 | 680 | -12 | -1.7 | noise |
| tasks-kanban | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| tasks-kanban | mobile | TTFB | 131.4 | 97.2 | -34.2 | -26 | improved/stable |
| tasks-kanban | mobile | FCP | 272 | 256 | -16 | -5.9 | improved/stable |
| tasks-detail | mobile | LCP | 768 | 776 | 8 | 1 | noise |
| tasks-detail | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| tasks-detail | mobile | TTFB | 105.4 | 102.9 | -2.5 | -2.4 | noise |
| tasks-detail | mobile | FCP | 296 | 296 | 0 | 0 | noise |
| tasks-open-detail | mobile | LCP | 3164 | 3172 | 8 | 0.3 | noise |
| tasks-open-detail | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| tasks-open-detail | mobile | TTFB | 36.5 | 40.6 | 4.1 | 11.2 | noise |
| tasks-open-detail | mobile | FCP | 156 | 184 | 28 | 17.9 | within-headroom |
| tasks-search | mobile | LCP | 3160 | 3168 | 8 | 0.3 | noise |
| tasks-search | mobile | INP | 56 | 56 | 0 | 0 | noise |
| tasks-search | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| tasks-search | mobile | TTFB | 30.8 | 33.3 | 2.5 | 8.1 | noise |
| tasks-search | mobile | FCP | 148 | 156 | 8 | 5.4 | noise |
| tasks-bulk | mobile | LCP | 3164 | 3156 | -8 | -0.3 | noise |
| tasks-bulk | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| tasks-bulk | mobile | TTFB | 99.3 | 33.4 | -65.9 | -66.4 | improved/stable |
| tasks-bulk | mobile | FCP | 244 | 152 | -92 | -37.7 | improved/stable |
| calendar | mobile | LCP | 588 | 620 | 32 | 5.4 | within-headroom |
| calendar | mobile | INP | 144 | 152 | 8 | 5.6 | within-headroom |
| calendar | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| calendar | mobile | TTFB | 7.6 | 8.1 | 0.5 | 6.6 | noise |
| calendar | mobile | FCP | 132 | 136 | 4 | 3 | noise |
| notifications | mobile | LCP | 124 | 124 | 0 | 0 | noise |
| notifications | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| notifications | mobile | TTFB | 7.6 | 7 | -0.6 | -7.9 | noise |
| notifications | mobile | FCP | 124 | 124 | 0 | 0 | noise |
| documents | mobile | LCP | 140 | 132 | -8 | -5.7 | noise |
| documents | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| documents | mobile | TTFB | 8 | 7.5 | -0.5 | -6.3 | noise |
| documents | mobile | FCP | 140 | 132 | -8 | -5.7 | noise |
| org | mobile | LCP | 156 | 160 | 4 | 2.6 | noise |
| org | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| org | mobile | TTFB | 8.7 | 8.8 | 0.1 | 1.1 | noise |
| org | mobile | FCP | 156 | 160 | 4 | 2.6 | noise |
| command-search | mobile | LCP | 336 | 320 | -16 | -4.8 | noise |
| command-search | mobile | CLS | 0 | 0 | 0 | n/a | noise |
| command-search | mobile | TTFB | 120.4 | 127.9 | 7.5 | 6.2 | noise |
| command-search | mobile | FCP | 268 | 268 | 0 | 0 | noise |

Regressions (>25% slower, outside the noise band, DIFFERENT checkout): 0
Same-checkout variance rows (>25% but no code change): 4
Noise-band rows (variance, not signal): 77
