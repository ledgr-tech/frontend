@AGENTS.md

## Workflow

- Work on `develop`, never commit directly to `main`. Non-trivial feature work should happen in an isolated git worktree under `.worktrees/` (already gitignored) on its own branch, merged/PR'd back into `develop` when done.
- Before committing: `npm run test && npm run lint && npm run build`. Running `build` (not just `test`) matters — see the route-group typo note in `AGENTS.md`; it's the kind of bug tests alone won't catch.
- Real screen copy/data (landing page sections, product terminology, etc.) should come from the Claude Design export for this project, not be invented — check for the source file before writing placeholder text.

## Backend status

- No real backend yet. `lib/auth.ts` and `lib/mock-data.ts` are localStorage-backed mocks standing in for it, deliberately isolated behind function signatures a real API could later replace. They're currently synchronous — swapping in real async calls will need those call sites updated (they already model loading states, so this should be mechanical, not a redesign).

## Decision history

- `docs/superpowers/specs/` — design specs (what was approved and why)
- `docs/superpowers/plans/` — implementation plans (task-by-task breakdown for executed work)
