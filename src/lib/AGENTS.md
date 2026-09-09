# Domain & Library Invariants

- **Canonical Domain Helpers**: Prefer canonical domain helpers in `src/lib/`; never implement divergent or competing utilities.

- **No Synthetic Operational Data**: Never invent business metadata, placeholder counts, or synthetic entities.

- **Canonical Date & Time**: Always use `src/lib/academic-calendar.ts` and Indochina Time (ICT, UTC+7) for academic dates.

- **Single Metric Definition**: Maintain exactly one mathematical and business definition per institutional metric.

- **Stateless Domain Logic**: Ensure utility functions remain pure, deterministic, and free of hidden side effects.
