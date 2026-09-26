@AGENTS.md

## Workflow

- Work on `develop`, never commit directly to `main`. Non-trivial feature work should happen in an isolated git worktree under `.worktrees/` (already gitignored) on its own branch, merged/PR'd back into `develop` when done.
- Before committing: `npm run test && npm run lint && npm run build`. Running `build` (not just `test`) matters — see the route-group typo note in `AGENTS.md`; it's the kind of bug tests alone won't catch.
- Real screen copy/data (landing page sections, product terminology, etc.) should come from the Claude Design export for this project, not be invented — check for the source file before writing placeholder text.

## Backend status

- **The upload → conciliation flow is real.** `lib/backend.ts` is the only place that talks to the FastAPI backend (`LEDGR_API_URL`), always server-side, always with a `Authorization: Bearer <jwt>` built from the session cookie. Screens reach it through Server Actions (`app/(app)/conciliacoes/acoes.ts`), never with `fetch` from the browser. The one exception is a file: the CSV export can't come back through a Server Action, so `app/api/conciliacoes/[id]/exportar/route.ts` is a Route Handler that calls `baixarDoBackend` and passes the bytes through untouched (decoding as text drops the UTF-8 BOM, and Excel then breaks the accents).
- **Session is NextAuth** (`auth.ts` at the root), with `jwt.encode`/`decode` replaced so the cookie *is* the HS256 token the backend validates — see `lib/token.ts` for the claim contract and `docs/superpowers/specs/2026-09-22-integracao-backend-design.md` for why.
- **Login and signup are real.** `authorize` calls `POST /login` (`lib/login.ts`) and the signup calls `POST /register` (`app/(auth)/acoes.ts`) — the two calls that go out without a Bearer (`publica: true`). The backend answers the same 401 for an unknown e-mail and a wrong password, on purpose; the login screen shows one message for both.
- **Still mocked, because the backend has no endpoint for it:** the list of uploaded-but-not-conciliated extratos, `/regras`, the subscription, and every write on a conciliation (close the month, accept the bank value). Screens showing backend data hide those write actions instead of pretending to save.
- `lib/mock-data.ts` still backs everything in the list above. When a real endpoint shows up, the swap point is named in a `ponytail:` comment next to the mock call.

## Decision history

- `docs/superpowers/specs/` — design specs (what was approved and why)
- `docs/superpowers/plans/` — implementation plans (task-by-task breakdown for executed work)
