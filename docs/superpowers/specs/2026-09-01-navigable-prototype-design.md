# Ledgr — Navigable Prototype Design

## Context

Ledgr is a B2B bank-reconciliation SaaS (upload bank statement + management-system statement, get a match/mismatch report; the bank statement is always the source of truth). This repo (`ledgr-tech/frontend`) is a Next.js 16 walking skeleton with a single placeholder page.

The institutional "protótipo navegável" milestone is due imminently, and no backend decisions exist yet (no `usuarios`/`empresas` schema, no auth solution, no raw-statement storage strategy). This spec covers a click-through prototype of the core happy path, built entirely against mocked data, that can later be wired to a real backend without restructuring.

A full product design already exists as a Claude Design project (`Ledgr.dc.html`, project id `0dc0af69-7934-4421-8e81-3656e5e894d5`) covering ~20 screens (landing, auth, dashboard, the reconciliation flow, monthly closing, settings, billing, automation rules, audit trail). That full surface is the target for the 7-sprint MVP phase, not for this prototype.

## Scope

**In scope for this prototype:**
1. Landing page (marketing)
2. Login (mocked — any credentials succeed)
3. Dashboard — empty state and populated state
4. Nova conciliação (upload bank statement + upload management-system statement)
5. Comparação direta (match/mismatch table) + transaction detail (as a dialog)
6. Fechamento (month closing) success state

**Out of scope (deferred to Sprint 1+):** onboarding, import-error states (unrecognized columns), column-mapping config, settings hub (histórico, equipe e acessos, conexões, avisos, assinatura/planos/faturas), automation rules, audit trail, print report.

## Architecture

Single Next.js App Router app (this repo), no separate repo for the landing page. Route groups separate concerns without affecting URLs:

```
app/
  (marketing)/
    page.tsx                    → "/"
  (auth)/
    login/page.tsx              → "/login"
  (app)/
    layout.tsx                  → shared authenticated shell (nav/sidebar), guards on the mock session
    dashboard/page.tsx          → "/dashboard"
    conciliacoes/
      nova/page.tsx             → "/conciliacoes/nova" (upload step)
      [id]/page.tsx             → "/conciliacoes/[id]" (comparação direta + fechamento states)
lib/
  auth.ts                       → mock session read/write (localStorage-backed)
  mock-data.ts                  → fixtures: empresa, extratos, lançamentos, matches
components/
  ...                           → shared UI pieces (Button, Card, Table, Dialog wrappers over the design system's CSS classes)
```

The transaction-detail view (e.g. "Boleto Aço Norte Bobinas") is a `.dialog` overlay opened from the comparison table, not its own route.

`(app)/layout.tsx` checks the mock session (via `lib/auth.ts`) client-side and redirects to `/login` if absent — this is a placeholder gate, not real auth, and is designed to be replaced once the backend team picks an auth solution.

## Design system integration

The Claude Design project's `_ds/classical-.../styles.css` is the source of truth for visual language: warm neutral palette (bg `#f3f2f2`, text `#201f1d`, accent `#b68235`), tonal ramps for neutral/accent colors, spacing scale, and ready-made component classes (`.btn`, `.card`, `.table`, `.nav`, `.dialog`, `.tag`, `.input`, `.seg`, `.radio`).

Plan:
- Port the token/component CSS into [app/globals.css](../../../app/globals.css), keeping `@import "tailwindcss";` at the top so Tailwind utilities (layout: flex/grid/gap) and the design system's component classes coexist.
- Replace the Geist font setup in [app/layout.tsx](../../../app/layout.tsx) with `next/font/google` loaders for Cormorant Garamond (headings) and Lora (body), wired to the same `--font-heading` / `--font-body` CSS variables the design system CSS expects — instead of the raw `@import url(fonts.googleapis.com...)` the source CSS uses, for better load performance.
- Update `app/layout.tsx` metadata (title/description) from the placeholder "Create Next App" values to Ledgr's.
- Pull exact markup/copy per screen from the Claude Design project (`Ledgr.dc.html`, fetched via `DesignSync get_file`) while implementing each screen, using the ported CSS classes.

## Data & auth mocking

No backend integration in this prototype. Two isolated modules keep the mock surface swappable later:

- `lib/mock-data.ts` — static fixtures: one `empresa`, a set of bank-statement lançamentos, a set of system-statement lançamentos, and a precomputed match/mismatch result (some matched, some only-on-bank, some only-on-system) so the comparison table has realistic variety without real file parsing. It also holds a small in-memory/localStorage-backed list of "conciliações concluídas" — empty on first load, so `/dashboard` renders its empty state — that gains one entry when the user finishes the fechamento step, so a second visit to `/dashboard` (or navigating back) shows the populated state. This makes the empty→populated transition part of the actual demo flow rather than two disconnected mocks.
- `lib/auth.ts` — `login(email, password)` always succeeds and writes a session flag to `localStorage`; `getSession()` / `logout()` read/clear it. No password validation, no real user records.
- The upload step (`/conciliacoes/nova`) accepts a file via the existing drag-drop UI pattern from the design but does not parse its contents — selecting any file and continuing advances to `/conciliacoes/[id]` where the mock comparison data from `mock-data.ts` is shown, regardless of what was uploaded.

This keeps the seam for Sprint 1 narrow: swapping `lib/auth.ts` for a real API-backed implementation and `lib/mock-data.ts` for real parsed statement data should not require changing page/component structure.

## Testing

- Switch [vitest.config.ts](../../../vitest.config.ts) from `environment: "node"` to `environment: "jsdom"`.
- Add `@testing-library/react` (and `@testing-library/jest-dom` if needed) as dev dependencies.
- One smoke test per route (renders without throwing, key heading text present) — no deep interaction testing yet, given the prototype's throwaway-mock nature and the timeline pressure. Existing [tests/placeholder.test.ts](../../../tests/placeholder.test.ts) can be removed once real tests exist.
- CI ([.github/workflows/ci.yml](../../../.github/workflows/ci.yml)) already runs `npm run lint` and `npm run test` on push/PR to `develop`/`main` — no CI changes needed.

## Out of scope / explicitly deferred

- Real authentication, real database schema, real file storage/parsing — blocked on backend decisions tracked in project memory (`ledgr_timeline_and_risks`).
- All settings-hub screens, automation rules, audit trail, billing, onboarding, and import-error states from the full Claude Design project.
- Getting a real bank statement sample to validate matching logic (external dependency, tracked separately).
