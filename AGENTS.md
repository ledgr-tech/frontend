<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ledgr stack notes

- **Design system:** tokens (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`) and component classes (`.btn`, `.card`, `.table`, `.dialog`, `.tag`, `.input`, `.nav`) live in `app/globals.css`, ported from the Claude Design "Classical" system. Reuse these instead of inventing new inline styles or Tailwind utility patterns for the same thing.
- **Fonts:** headings use Cormorant Garamond, body text uses Lora, both loaded via `next/font/google` in `app/layout.tsx` (CSS variables `--font-heading-family` / `--font-body-family`, mapped to `--font-heading` / `--font-body` in `globals.css`). Don't reintroduce the default Geist fonts.
- **Route groups:** `(marketing)`, `(auth)`, `(app)` split the public site, login, and the authenticated shell without affecting URLs. A typo in a route-group folder name (e.g. `(app/)` instead of `(app)`) creates a silently-broken route that unit tests won't catch (they import the page component directly) — always run `npm run build` after adding or moving a route and check the printed route table.
