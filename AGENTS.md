<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ledgr stack notes

- **Design system:** tokens (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`) and component classes (`.btn`, `.card`, `.table`, `.dialog`, `.tag`, `.input`, `.nav`) live in `app/globals.css`, ported from the Claude Design "Classical" system. Reuse these instead of inventing new inline styles or Tailwind utility patterns for the same thing.
- **Fonts:** Inter for body and UI (`--font-body`, `--font-heading`); Cormorant Garamond as `--font-display` for landing accents only; Newsreader (variable, with the `opsz` axis) as `--font-titulo` for every title from ~20px up inside the app shell (`h1`–`h3`, big figures — see the "Tipografia do app" block in `globals.css`), with lining figures. All loaded via `next/font/google` in `app/layout.tsx`. Don't reintroduce the default Geist fonts.
- **Route groups:** `(marketing)`, `(auth)`, `(app)` split the public site, login, and the authenticated shell without affecting URLs. A typo in a route-group folder name (e.g. `(app/)` instead of `(app)`) creates a silently-broken route that unit tests won't catch (they import the page component directly) — always run `npm run build` after adding or moving a route and check the printed route table.
