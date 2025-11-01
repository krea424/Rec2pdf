# ExecPlans — UI/UX

When a request involves multi-file UI/UX redesign, design systems, or navigation refactors, do **not** code immediately.
Instead, create an **ExecPlan** following `.agent/PLANS.md`, then implement milestone by milestone.

Rules:
- For small atomic UI changes (copy tweak, one CSS variable), code directly.
- For anything impacting IA (information architecture), navigation, design tokens, layout system, or component library: **use an ExecPlan**.
- Each milestone must include: concrete edits, acceptance criteria, demo commands/URLs, and a small screenshot note (what to expect visually).
- Keep `.agent/ExecPlan_*.md` updated: Progress, Surprises & Discoveries, Decision Log, Outcomes.

Shorthand:
- “Use an ExecPlan” ⇒ create/update `.agent/ExecPlan_<topic>.md` from `.agent/PLANS.md`.
