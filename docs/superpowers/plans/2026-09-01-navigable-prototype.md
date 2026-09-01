# Ledgr Navigable Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a click-through Next.js prototype of Ledgr's core reconciliation loop — landing → login → dashboard → upload two statements → comparação direta with a transaction-detail dialog → fechamento — entirely against mocked data/auth, matching the visual language of the approved Claude Design project.

**Architecture:** Single Next.js App Router app (this repo), route groups `(marketing)` / `(auth)` / `(app)` splitting the public site, the login screen, and the authenticated shell without affecting URLs. All product data lives in two small client-side modules (`lib/auth.ts`, `lib/mock-data.ts`) backed by `localStorage`, so no backend call exists anywhere in this pass.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind CSS 4 (`@import "tailwindcss";`) layered with a ported plain-CSS design system ("Classical") for tokens and component classes (`.btn`, `.card`, `.table`, `.dialog`, `.field`, `.tag`), Vitest + `@testing-library/react` (jsdom) for tests.

**Spec:** [docs/superpowers/specs/2026-09-01-navigable-prototype-design.md](../specs/2026-09-01-navigable-prototype-design.md)

## Global Constraints

- No backend integration anywhere in this pass — auth and all reconciliation data are mocked in `lib/auth.ts` / `lib/mock-data.ts`. Real auth/schema/storage are blocked on backend decisions (see spec's Context section).
- All UI copy is Portuguese (pt-BR), matching the approved Claude Design project's tone and wording.
- Visual language: colors/spacing/typography from the design system ported into `app/globals.css` (background `#f3f2f2`, text `#201f1d`, accent `#b68235`); headings in Cormorant Garamond, body in Lora, both loaded via `next/font/google`.
- Mascot/medal illustration assets from the Claude Design project are **not** included in this pass — the project's `DesignSync` tool caps file reads at 256 KiB and every mascot PNG exceeds that, so they can't be fetched reliably. Screens are built text/layout-only where the design shows a mascot. If illustrations are wanted later, the user needs to export `assets/` from the Claude Design project (`https://claude.ai/design/p/0dc0af69-7934-4421-8e81-3656e5e894d5`) into `public/assets/` manually, and that becomes a follow-up task.
- Route groups: `(marketing)` public, `(auth)` for `/login`, `(app)` for the authenticated shell (guarded client-side by a mock session check, not real auth).
- New client-side modules and components use Portuguese identifiers where they name domain concepts (`conciliacao`, `linhas`, `fecharConciliacao`), matching the product's own vocabulary — this mirrors how the team and the design already talk about the product.
- Every UI task's automated check is a Vitest + Testing Library render/interaction test; every UI task's manual check is opening the page in the dev server and confirming it visually, per the project's UI-verification requirement.

---

## Task 1: Test environment — jsdom + Testing Library

**Files:**
- Modify: `vitest.config.ts`
- Modify: `package.json` (add devDependencies)
- Create: `tests/setup.ts`
- Create: `tests/smoke.test.tsx`
- Delete: `tests/placeholder.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working jsdom + Testing Library test environment every later task's tests rely on. `tests/setup.ts` registers jest-dom matchers globally, so later test files don't need to import it themselves.

- [ ] **Step 1: Install the test dependencies**

Run:
```bash
npm install -D @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25
```

- [ ] **Step 2: Write the failing smoke test**

Create `tests/smoke.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test environment", () => {
  it("renders a component into jsdom and can query it", () => {
    render(<p>ambiente de teste ok</p>);
    expect(screen.getByText("ambiente de teste ok")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test -- tests/smoke.test.tsx`
Expected: FAIL — `environment: "node"` has no DOM, so `render`/`screen` blow up (`document is not defined` or similar), and `toBeInTheDocument` isn't a known matcher yet.

- [ ] **Step 4: Switch the test environment to jsdom and register jest-dom**

Create `tests/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Replace `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 5: Run it again to verify it passes, then remove the old placeholder test**

Run: `npm run test -- tests/smoke.test.tsx`
Expected: PASS

Delete `tests/placeholder.test.ts` (its only job — keeping CI green before real tests existed — is now done by `tests/smoke.test.tsx` and everything after it).

Run: `npm run test`
Expected: PASS (1 test file, 1 test)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests/setup.ts tests/smoke.test.tsx
git rm tests/placeholder.test.ts
git commit -m "test: switch vitest to jsdom and add Testing Library"
```

---

## Task 2: Design system port — fonts, colors, component classes

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: CSS custom properties (`--color-bg`, `--color-text`, `--color-accent`, `--color-accent-700`, `--color-divider`, `--color-surface`, `--color-neutral-900`, `--ledgr-tinta`, `--font-heading`, `--font-body`, `--space-*`, `--radius-*`, `--shadow-*`) and component classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-block`, `.field`, `.input`, `.card`, `.tag`, `.tag-accent`, `.tag-outline`, `.table`, `.nav`, `.nav-brand`, `.dialog-backdrop`, `.dialog`, `.dialog-title`, `.dialog-body`, `.dialog-actions`) that every later UI task relies on.

This task has no unit-testable logic (it's tokens and CSS) — its test cycle is a build check plus a manual visual check, which is the correct verification for a pure styling change.

- [ ] **Step 1: Confirm the current build passes before touching styles**

Run: `npm run build`
Expected: PASS (baseline, so any failure after this task is attributable to this change)

- [ ] **Step 2: Replace the fonts and metadata in the root layout**

Replace `app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-heading-family",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const lora = Lora({
  variable: "--font-body-family",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Ledgr",
  description:
    "Concilie o extrato do banco com o extrato do seu sistema de gestão em minutos, sem planilha no meio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${cormorantGaramond.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Port the design system tokens and component classes**

Replace `app/globals.css`:
```css
@import "tailwindcss";

:root {
  --color-bg: #f3f2f2;
  --color-surface: #eae9e9;
  --color-text: #201f1d;
  --color-accent: #b68235;
  --color-accent-2: #ac803e;
  --color-divider: color-mix(in srgb, #201f1d 16%, transparent);
  --ledgr-tinta: #f3f2f2;

  --color-neutral-100: #f8f4f4;
  --color-neutral-200: #eae7e7;
  --color-neutral-300: #d7d3d3;
  --color-neutral-400: #bab6b6;
  --color-neutral-500: #9b9797;
  --color-neutral-600: #7d7979;
  --color-neutral-700: #605d5d;
  --color-neutral-800: #444141;
  --color-neutral-900: #2d2b2b;

  --color-accent-100: #fff3e4;
  --color-accent-200: #ffe3bf;
  --color-accent-300: #facb8d;
  --color-accent-400: #e1ad66;
  --color-accent-500: #c28d41;
  --color-accent-600: #a06f24;
  --color-accent-700: #7d5411;
  --color-accent-800: #5a3b0a;
  --color-accent-900: #3a270d;

  --font-heading: var(--font-heading-family), system-ui, sans-serif;
  --font-heading-weight: 600;
  --font-body: var(--font-body-family), system-ui, sans-serif;

  --space-1: 4.6px;
  --space-2: 9.2px;
  --space-3: 13.8px;
  --space-4: 18.4px;
  --space-6: 27.6px;
  --space-8: 36.8px;

  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 7px;

  --shadow-sm: 0 1px 2px color-mix(in srgb, #2d2b2b 14%, transparent);
  --shadow-md: 0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent);
  --shadow-lg: 0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent);
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
  font-weight: 400;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  line-height: 1.12;
  letter-spacing: -0.015em;
  margin: 0 0 var(--space-2);
}
h1 { font-size: 42px; }
h2 { font-size: 32px; }
h3 { font-size: 25px; }
h4 { font-size: 20px; }
h5 { font-size: 16px; }
h6 { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; }
p { margin: 0 0 var(--space-3); }
a { color: var(--color-accent); text-underline-offset: 3px; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

.hr {
  height: 1px; border: 0; margin: var(--space-4) 0;
  background: var(--color-divider);
}

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  cursor: pointer; text-decoration: none;
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 14px; line-height: 1.2; color: var(--color-text);
  background: transparent; border: 1px solid transparent;
  padding: var(--space-2) calc(var(--space-3) * 1.2);
  border-radius: var(--radius-md);
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { color: var(--color-accent); border-color: var(--color-accent); }
.btn-primary:hover { background: color-mix(in srgb, var(--color-accent) 12%, transparent); }
.btn-secondary { border-color: var(--color-divider); }
.btn-secondary:hover { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.btn-ghost { color: var(--color-accent); padding-inline: var(--space-1); }
.btn-ghost:hover { background: color-mix(in srgb, var(--color-accent) 10%, transparent); }
.btn-block { width: 100%; margin-top: var(--space-2); }

.field > label {
  display: block; font-size: 12px; margin-bottom: 5px;
  color: color-mix(in srgb, var(--color-text) 70%, transparent);
}
.input {
  width: 100%; min-height: 36px; padding: 6px 10px; font: inherit;
  font-size: 14px; color: var(--color-text); caret-color: var(--color-accent);
  background: transparent;
  border: 1px solid var(--color-divider); border-radius: var(--radius-md);
}
.input:hover { border-color: color-mix(in srgb, var(--color-text) 45%, transparent); }
.input:focus-visible { border-color: var(--color-accent); outline-offset: 0; }

.card {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--space-3); border-radius: var(--radius-md); background: transparent; border: 1px solid var(--color-divider);
}

.tag {
  display: inline-flex; align-items: center; font-size: 11px;
  letter-spacing: 0.02em; padding: 3px 10px;
  border-radius: calc(var(--radius-md) * 0.75);
}
.tag-accent { background: var(--color-accent-100); color: var(--color-accent-800); }
.tag-outline { border: 1px solid var(--color-accent); color: var(--color-accent); }

.nav {
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-divider);
}
.nav-brand {
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 18px; margin-right: auto;
}
.nav a { color: inherit; text-decoration: none; font-size: 14px; }
.nav a:hover { color: var(--color-accent); }

.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th {
  text-align: left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
  color: color-mix(in srgb, var(--color-text) 60%, transparent);
  padding: var(--space-2); border-bottom: 1px solid var(--color-divider);
}
.table td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-divider);
}
.table tbody tr:hover { background: color-mix(in srgb, var(--color-text) 4%, transparent); }

.dialog-backdrop {
  position: fixed; inset: 0; display: grid; place-items: center;
  padding: var(--space-4); z-index: 100;
  background: color-mix(in srgb, var(--color-neutral-900) 50%, transparent);
}
.dialog {
  width: min(560px, 100%); display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4); border-radius: var(--radius-lg);
  background: var(--color-surface); box-shadow: var(--shadow-lg); border: 1px solid var(--color-divider);
}
.dialog-title {
  font-family: var(--font-heading); font-weight: var(--font-heading-weight);
  font-size: 20px;
}
.dialog-body { font-size: 14px; opacity: 0.85; }
.dialog-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }
```

- [ ] **Step 4: Verify the build still passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000` in a browser. Expected: the existing "Ledgr / Em construção." placeholder now renders in the serif heading font on the warm off-white background — confirms the tokens and fonts are wired correctly before any real screen is built on top of them.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: port Ledgr design system tokens and fonts"
```

---

## Task 3: Landing page

**Files:**
- Modify: `app/(marketing)/page.tsx`
- Create: `app/(marketing)/page.test.tsx`

**Interfaces:**
- Consumes: `.btn`/`.btn-primary` classes and color tokens from Task 2. Links to `/login` (built in Task 5) — the link itself doesn't require that route to exist yet to pass its own test.
- Produces: nothing later tasks import (leaf page).

- [ ] **Step 1: Write the failing test**

Create `app/(marketing)/page.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

describe("LandingPage", () => {
  it("shows the hero headline and a link into the product", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { name: "Pare de conciliar extrato à mão." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conciliar meu primeiro extrato" })
    ).toHaveAttribute("href", "/login");
  });

  it("states the golden rule and the pricing model", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("O extrato do banco é sempre a fonte da verdade.")
    ).toBeInTheDocument();
    expect(screen.getByText("Preço fechado, por volume.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "app/(marketing)/page.test.tsx"`
Expected: FAIL — current `page.tsx` only renders "Ledgr" / "Em construção.".

- [ ] **Step 3: Implement the landing page**

Replace `app/(marketing)/page.tsx`:
```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "84px 24px 72px",
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-accent-700)",
          }}
        >
          Cap. I · O fechamento do mês
        </span>
        <h1 style={{ margin: "24px 0", fontSize: 56, fontWeight: 400, lineHeight: 1.05 }}>
          Pare de conciliar extrato à mão.
        </h1>
        <p style={{ margin: "0 0 34px", fontSize: 17.5, lineHeight: 1.72, maxWidth: "44ch" }}>
          Suba o extrato do banco e o extrato do seu sistema de gestão. Em minutos você recebe o
          relatório do que bate e do que não bate — lançamento por lançamento, sem planilha no
          meio.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <Link
            href="/login"
            className="btn btn-primary"
            style={{ fontSize: 15.5, padding: "13px 24px" }}
          >
            Conciliar meu primeiro extrato
          </Link>
          <span
            style={{
              fontSize: 14,
              color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
            }}
          >
            OFX ou CSV · sem cartão de crédito
          </span>
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px" }}>
          <div
            style={{
              border: "1px solid var(--color-accent)",
              borderRadius: "var(--radius-md)",
              padding: "42px 46px",
            }}
          >
            <h6 style={{ margin: "0 0 10px", color: "var(--color-accent-700)" }}>
              Regra de ouro
            </h6>
            <h2 style={{ margin: "0 0 12px", fontSize: 34, fontWeight: 400 }}>
              O extrato do banco é sempre a fonte da verdade.
            </h2>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75, maxWidth: "68ch" }}>
              Toda divergência é reportada na mesma direção: o sistema diverge do banco, nunca o
              contrário. Isso encerra a discussão sobre qual número vale e deixa claro o que
              precisa ser corrigido no seu sistema de gestão.
            </p>
          </div>
        </div>
      </section>

      <section
        style={{
          borderTop: "1px solid var(--color-divider)",
          background: "var(--color-neutral-900)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "84px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-accent-300)",
            }}
          >
            Cap. IV · Começar
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 400,
              maxWidth: "26ch",
              color: "var(--ledgr-tinta)",
            }}
          >
            Preço fechado, por volume.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 16.5,
              lineHeight: 1.72,
              maxWidth: "52ch",
              color: "var(--color-neutral-300)",
            }}
          >
            Você paga pelo tanto de lançamento que conferir no mês. Sem fidelidade, sem taxa de
            implantação, sem cobrar por usuário.
          </p>
          <Link
            href="/login"
            className="btn btn-primary"
            style={{
              fontSize: 15.5,
              padding: "13px 24px",
              borderColor: "var(--color-accent-400)",
              color: "var(--color-accent-300)",
            }}
          >
            Subir meus extratos
          </Link>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npm run test -- "app/(marketing)/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000`. Expected: hero, golden-rule callout, and dark pricing section render with the serif headings and warm palette from Task 2.

- [ ] **Step 6: Commit**

```bash
git add "app/(marketing)/page.tsx" "app/(marketing)/page.test.tsx"
git commit -m "feat: build Ledgr landing page"
```

---

## Task 4: Mock data & auth libraries

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/auth.test.ts`
- Create: `lib/mock-data.ts`
- Create: `lib/mock-data.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later screen task):
  - `lib/auth.ts`: `login(email: string): Session`, `getSession(): Session | null`, `logout(): void`, `type Session = { email: string }`.
  - `lib/mock-data.ts`: `EMPRESA_MOCK: string`, `type StatusLinha = "batido" | "divergencia_valor" | "somente_banco" | "somente_sistema"`, `type EventoHistorico = { quando: string; evento: string }`, `type LinhaComparacao = { id: string; descricao: string; data: string; valorBanco: number | null; valorSistema: number | null; status: StatusLinha; explicacao: string | null; historico: EventoHistorico[] }`, `type Conciliacao = { id: string; mes: string; status: "em_andamento" | "fechada"; linhas: LinhaComparacao[] }`, `listarConciliacoes(): Conciliacao[]`, `criarConciliacao(): Conciliacao`, `buscarConciliacao(id: string): Conciliacao | null`, `fecharConciliacao(id: string): Conciliacao | null`, `formatarMoeda(valor: number): string`.

- [ ] **Step 1: Write the failing auth tests**

Create `lib/auth.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { login, getSession, logout } from "./auth";

describe("auth mock", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no session exists", () => {
    expect(getSession()).toBeNull();
  });

  it("stores a session on login and returns it from getSession", () => {
    login("financeiro@telhacerta.com.br");
    expect(getSession()).toEqual({ email: "financeiro@telhacerta.com.br" });
  });

  it("clears the session on logout", () => {
    login("financeiro@telhacerta.com.br");
    logout();
    expect(getSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/auth.test.ts`
Expected: FAIL — `./auth` doesn't exist yet.

- [ ] **Step 3: Implement `lib/auth.ts`**

```ts
const SESSION_KEY = "ledgr_session";

export type Session = {
  email: string;
};

export function login(email: string): Session {
  const session: Session = { email };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing mock-data tests**

Create `lib/mock-data.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  criarConciliacao,
  listarConciliacoes,
  buscarConciliacao,
  fecharConciliacao,
  formatarMoeda,
} from "./mock-data";

describe("mock-data store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with no conciliações", () => {
    expect(listarConciliacoes()).toEqual([]);
  });

  it("creates a conciliação em_andamento with mock lines", () => {
    const conciliacao = criarConciliacao();
    expect(conciliacao.status).toBe("em_andamento");
    expect(conciliacao.linhas.length).toBeGreaterThan(0);
    expect(listarConciliacoes()).toHaveLength(1);
  });

  it("finds a conciliação by id, or null if it doesn't exist", () => {
    const criada = criarConciliacao();
    expect(buscarConciliacao(criada.id)?.id).toBe(criada.id);
    expect(buscarConciliacao("id-inexistente")).toBeNull();
  });

  it("closes a conciliação, changing its status to fechada", () => {
    const criada = criarConciliacao();
    const fechada = fecharConciliacao(criada.id);
    expect(fechada?.status).toBe("fechada");
    expect(buscarConciliacao(criada.id)?.status).toBe("fechada");
  });

  it("formats currency values in pt-BR", () => {
    const formatado = formatarMoeda(12640);
    expect(formatado).toContain("R$");
    expect(formatado).toContain("12.640,00");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test -- lib/mock-data.test.ts`
Expected: FAIL — `./mock-data` doesn't exist yet.

- [ ] **Step 7: Implement `lib/mock-data.ts`**

```ts
export type StatusLinha =
  | "batido"
  | "divergencia_valor"
  | "somente_banco"
  | "somente_sistema";

export type EventoHistorico = {
  quando: string;
  evento: string;
};

export type LinhaComparacao = {
  id: string;
  descricao: string;
  data: string;
  valorBanco: number | null;
  valorSistema: number | null;
  status: StatusLinha;
  explicacao: string | null;
  historico: EventoHistorico[];
};

export type Conciliacao = {
  id: string;
  mes: string;
  status: "em_andamento" | "fechada";
  linhas: LinhaComparacao[];
};

export const EMPRESA_MOCK = "Telha Certa";

const STORAGE_KEY = "ledgr_conciliacoes";

function linhasMock(): LinhaComparacao[] {
  return [
    {
      id: "lc-1",
      descricao: "Pagamento Distribuidora Vale Verde",
      data: "02/09",
      valorBanco: 7300,
      valorSistema: 7300,
      status: "batido",
      explicacao: null,
      historico: [
        { quando: "01/09", evento: "Lançado no sistema de gestão" },
        { quando: "02/09", evento: "Compensado no banco" },
      ],
    },
    {
      id: "lc-2",
      descricao: "Boleto Aço Norte Bobinas",
      data: "04/09",
      valorBanco: 12640,
      valorSistema: 12604,
      status: "divergencia_valor",
      explicacao:
        "O boleto foi emitido em R$ 12.604,00 e pago com acréscimo de R$ 36,00. O banco registrou o valor pago; o sistema guardou o valor da emissão. Aceitar o valor do banco corrige o lançamento e classifica a diferença como despesa financeira.",
      historico: [
        { quando: "01/09", evento: "Boleto emitido no sistema de gestão" },
        { quando: "04/09", evento: "Pago no banco com juros de dois dias de atraso" },
      ],
    },
    {
      id: "lc-3",
      descricao: "Transferência recebida — cliente Metalúrgica Bom Retiro",
      data: "05/09",
      valorBanco: 4180,
      valorSistema: null,
      status: "somente_banco",
      explicacao: null,
      historico: [
        { quando: "05/09", evento: "Recebido no banco, sem lançamento correspondente no sistema" },
      ],
    },
    {
      id: "lc-4",
      descricao: "Nota Fiscal 4821 — Serviços de TI",
      data: "08/09",
      valorBanco: null,
      valorSistema: 2150,
      status: "somente_sistema",
      explicacao: null,
      historico: [
        { quando: "08/09", evento: "Lançado no sistema, ainda não debitado no banco" },
      ],
    },
    {
      id: "lc-5",
      descricao: "Folha de pagamento — setembro",
      data: "05/09",
      valorBanco: 48200,
      valorSistema: 48200,
      status: "batido",
      explicacao: null,
      historico: [
        { quando: "03/09", evento: "Lançado no sistema de gestão" },
        { quando: "05/09", evento: "Debitado no banco" },
      ],
    },
  ];
}

function novaConciliacao(): Conciliacao {
  return {
    id: `conc-${Date.now()}`,
    mes: "Setembro 2026",
    status: "em_andamento",
    linhas: linhasMock(),
  };
}

function lerConciliacoes(): Conciliacao[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Conciliacao[]) : [];
}

function salvarConciliacoes(lista: Conciliacao[]): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  }
}

export function listarConciliacoes(): Conciliacao[] {
  return lerConciliacoes();
}

export function criarConciliacao(): Conciliacao {
  const conciliacao = novaConciliacao();
  const lista = lerConciliacoes();
  lista.unshift(conciliacao);
  salvarConciliacoes(lista);
  return conciliacao;
}

export function buscarConciliacao(id: string): Conciliacao | null {
  return lerConciliacoes().find((conciliacao) => conciliacao.id === id) ?? null;
}

export function fecharConciliacao(id: string): Conciliacao | null {
  const lista = lerConciliacoes();
  const index = lista.findIndex((conciliacao) => conciliacao.id === id);
  if (index === -1) return null;
  const atualizada: Conciliacao = { ...lista[index], status: "fechada" };
  lista[index] = atualizada;
  salvarConciliacoes(lista);
  return atualizada;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test -- lib/mock-data.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts lib/mock-data.ts lib/mock-data.test.ts
git commit -m "feat: add mocked auth and reconciliation data store"
```

---

## Task 5: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/page.test.tsx`

**Interfaces:**
- Consumes: `login(email: string): Session` from `lib/auth.ts` (Task 4). `useRouter` from `next/navigation`.
- Produces: the `/login` route that Task 6's layout guard redirects to, and that Task 3's landing page links to.

- [ ] **Step 1: Write the failing test**

Create `app/(auth)/login/page.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const login = vi.fn();
vi.mock("@/lib/auth", () => ({
  login: (email: string) => login(email),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    login.mockClear();
  });

  it("shows the welcome-back heading and the email/password fields", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Bem-vinda de volta." })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("logs in and redirects to the dashboard on submit", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "financeiro@telhacerta.com.br");
    await user.type(screen.getByLabelText("Senha"), "qualquercoisa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(login).toHaveBeenCalledWith("financeiro@telhacerta.com.br");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "app/(auth)/login/page.test.tsx"`
Expected: FAIL — `./page` doesn't exist yet.

- [ ] **Step 3: Implement the login page**

Create `app/(auth)/login/page.tsx`:
```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login(email);
    router.push("/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={entrar}
        style={{ width: "100%", maxWidth: 424, display: "flex", flexDirection: "column", gap: 16 }}
      >
        <h1 style={{ margin: "0 0 14px", fontSize: 40, fontWeight: 400 }}>Bem-vinda de volta.</h1>
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            placeholder="financeiro@telhacerta.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-senha">Senha</label>
          <input
            id="login-senha"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" style={{ fontSize: 15.5 }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- "app/(auth)/login/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000/login`, submit the form with any email/password. Expected: it navigates to `/dashboard` (which will 404 until Task 7 — that's expected at this point in the plan).

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/login/page.tsx" "app/(auth)/login/page.test.tsx"
git commit -m "feat: build mocked login page"
```

---

## Task 6: Authenticated app shell — layout guard + nav

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/layout.test.tsx`

**Interfaces:**
- Consumes: `getSession(): Session | null` and `logout(): void` from `lib/auth.ts` (Task 4).
- Produces: the shell every page under `(app)` (Tasks 7-9) renders inside. Redirects to `/login` when there's no mock session.

- [ ] **Step 1: Write the failing test**

Create `app/(app)/layout.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AppLayout from "./layout";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
  logout: vi.fn(),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    replace.mockClear();
    getSession.mockReset();
  });

  it("redirects to /login when there's no session", () => {
    getSession.mockReturnValue(null);
    render(<AppLayout>conteúdo</AppLayout>);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renders children when a session exists", () => {
    getSession.mockReturnValue({ email: "financeiro@telhacerta.com.br" });
    render(<AppLayout>conteúdo autenticado</AppLayout>);
    expect(screen.getByText("conteúdo autenticado")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "app/(app)/layout.test.tsx"`
Expected: FAIL — `./layout` doesn't exist yet.

- [ ] **Step 3: Implement the layout guard**

Create `app/(app)/layout.tsx`:
```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, logout } from "@/lib/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }
    setAutorizado(true);
  }, [router]);

  if (!autorizado) {
    return null;
  }

  function sair() {
    logout();
    router.replace("/login");
  }

  return (
    <div>
      <nav className="nav">
        <Link href="/dashboard" className="nav-brand" style={{ textDecoration: "none", color: "inherit" }}>
          Ledgr
        </Link>
        <Link href="/dashboard">Dashboard</Link>
        <button type="button" className="btn btn-ghost" onClick={sair}>
          Sair
        </button>
      </nav>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(16px, 3.5vw, 40px)" }}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- "app/(app)/layout.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(app)/layout.test.tsx"
git commit -m "feat: add authenticated app shell with mock session guard"
```

---

## Task 7: Dashboard (empty and populated states)

**Files:**
- Create: `app/(app)/dashboard/page.tsx`
- Create: `app/(app)/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `EMPRESA_MOCK`, `listarConciliacoes(): Conciliacao[]`, `formatarMoeda` from `lib/mock-data.ts` (Task 4).
- Produces: the `/dashboard` route that `(app)/layout.tsx` (Task 6) wraps, and that Task 5's login and Task 8/9 redirect to.

- [ ] **Step 1: Write the failing test**

Create `app/(app)/dashboard/page.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

const listarConciliacoes = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  EMPRESA_MOCK: "Telha Certa",
  listarConciliacoes: () => listarConciliacoes(),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    listarConciliacoes.mockReset();
  });

  it("shows the empty state when there are no conciliações", async () => {
    listarConciliacoes.mockReturnValue([]);
    render(<DashboardPage />);
    expect(await screen.findByText("Nenhum extrato por aqui ainda.")).toBeInTheDocument();
  });

  it("shows recent conciliações when at least one exists", async () => {
    listarConciliacoes.mockReturnValue([
      { id: "conc-1", mes: "Setembro 2026", status: "fechada", linhas: [] },
    ]);
    render(<DashboardPage />);
    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.getByText("Setembro 2026")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "app/(app)/dashboard/page.test.tsx"`
Expected: FAIL — `./page` doesn't exist yet.

- [ ] **Step 3: Implement the dashboard page**

Create `app/(app)/dashboard/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EMPRESA_MOCK, listarConciliacoes, type Conciliacao } from "@/lib/mock-data";

export default function DashboardPage() {
  const [conciliacoes, setConciliacoes] = useState<Conciliacao[] | null>(null);

  useEffect(() => {
    setConciliacoes(listarConciliacoes());
  }, []);

  if (conciliacoes === null) {
    return null;
  }

  return (
    <div>
      <div
        style={{
          borderBottom: "1px solid var(--color-divider)",
          padding: "24px 0",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>{EMPRESA_MOCK}</h1>
          <span
            style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}
          >
            Competência setembro/2026
          </span>
        </div>
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Novo extrato
        </Link>
      </div>

      {conciliacoes.length === 0 ? (
        <div
          style={{
            padding: "76px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400, maxWidth: "24ch" }}>
            Nenhum extrato por aqui ainda.
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, maxWidth: "48ch" }}>
            Suba o extrato do banco e o extrato do sistema de gestão. A primeira conciliação fica
            pronta em poucos minutos.
          </p>
          <Link
            href="/conciliacoes/nova"
            className="btn btn-primary"
            style={{ fontSize: 15, padding: "12px 22px" }}
          >
            Fazer o primeiro upload
          </Link>
        </div>
      ) : (
        <div style={{ padding: "32px 0 56px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>
            Conciliações recentes
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Status</th>
                <th style={{ width: 110 }}>Lançamentos</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {conciliacoes.map((conciliacao) => (
                <tr key={conciliacao.id}>
                  <td>{conciliacao.mes}</td>
                  <td>
                    <span
                      className={conciliacao.status === "fechada" ? "tag tag-accent" : "tag tag-outline"}
                    >
                      {conciliacao.status === "fechada" ? "Fechada" : "Em andamento"}
                    </span>
                  </td>
                  <td>{conciliacao.linhas.length}</td>
                  <td>
                    <Link href={`/conciliacoes/${conciliacao.id}`} className="btn btn-secondary">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- "app/(app)/dashboard/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/dashboard/page.tsx" "app/(app)/dashboard/page.test.tsx"
git commit -m "feat: build dashboard with empty and populated states"
```

---

## Task 8: Nova conciliação — upload step

**Files:**
- Create: `app/(app)/conciliacoes/nova/page.tsx`
- Create: `app/(app)/conciliacoes/nova/page.test.tsx`

**Interfaces:**
- Consumes: `criarConciliacao(): Conciliacao` from `lib/mock-data.ts` (Task 4). `useRouter` from `next/navigation`.
- Produces: the `/conciliacoes/nova` route linked from Task 7's dashboard, which pushes to `/conciliacoes/[id]` (Task 9) on submit.

- [ ] **Step 1: Write the failing test**

Create `app/(app)/conciliacoes/nova/page.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NovaConciliacaoPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const criarConciliacao = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  criarConciliacao: () => criarConciliacao(),
}));

function arquivo(nome: string) {
  return new File(["conteudo"], nome, { type: "text/csv" });
}

describe("NovaConciliacaoPage", () => {
  beforeEach(() => {
    push.mockClear();
    criarConciliacao.mockReset();
    criarConciliacao.mockReturnValue({ id: "conc-123", mes: "Setembro 2026", status: "em_andamento", linhas: [] });
  });

  it("disables the submit button until both files are selected", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);

    const botao = screen.getByRole("button", { name: "Conciliar extratos" });
    expect(botao).toBeDisabled();

    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
    expect(botao).toBeDisabled();

    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    expect(botao).toBeEnabled();
  });

  it("creates a conciliação and navigates to it on submit", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);

    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));

    expect(criarConciliacao).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/conciliacoes/conc-123");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "app/(app)/conciliacoes/nova/page.test.tsx"`
Expected: FAIL — `./page` doesn't exist yet.

- [ ] **Step 3: Implement the upload page**

Create `app/(app)/conciliacoes/nova/page.tsx`:
```tsx
"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { criarConciliacao } from "@/lib/mock-data";

export default function NovaConciliacaoPage() {
  const router = useRouter();
  const [arquivoBanco, setArquivoBanco] = useState<File | null>(null);
  const [arquivoSistema, setArquivoSistema] = useState<File | null>(null);

  function selecionarBanco(event: ChangeEvent<HTMLInputElement>) {
    setArquivoBanco(event.target.files?.[0] ?? null);
  }

  function selecionarSistema(event: ChangeEvent<HTMLInputElement>) {
    setArquivoSistema(event.target.files?.[0] ?? null);
  }

  function conciliar() {
    const conciliacao = criarConciliacao();
    router.push(`/conciliacoes/${conciliacao.id}`);
  }

  const podeConciliar = arquivoBanco !== null && arquivoSistema !== null;

  return (
    <div style={{ padding: "36px 0 64px", maxWidth: 1040 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Nova conciliação</h1>
      <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
        Setembro/2026
      </span>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 20,
          margin: "24px 0",
        }}
      >
        <label
          className="card"
          style={{ cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do banco
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            {arquivoBanco ? arquivoBanco.name : "OFX ou CSV do banco"}
          </span>
          <input
            aria-label="Extrato do banco"
            type="file"
            accept=".ofx,.csv"
            onChange={selecionarBanco}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </label>
        <label
          className="card"
          style={{ cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do sistema de gestão
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            {arquivoSistema ? arquivoSistema.name : "CSV exportado do seu sistema"}
          </span>
          <input
            aria-label="Extrato do sistema de gestão"
            type="file"
            accept=".csv"
            onChange={selecionarSistema}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </label>
      </div>

      <div className="card" style={{ borderColor: "var(--color-accent)", marginBottom: 28 }}>
        <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>Regra de ouro</h6>
        <p style={{ margin: 0, fontSize: 14 }}>
          O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como
          &ldquo;o sistema diverge do banco&rdquo; — se o valor no seu sistema estiver diferente,
          é ele que precisa de ajuste.
        </p>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!podeConciliar}
        onClick={conciliar}
        style={{ fontSize: 15, padding: "12px 22px" }}
      >
        Conciliar extratos
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- "app/(app)/conciliacoes/nova/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/conciliacoes/nova/page.tsx" "app/(app)/conciliacoes/nova/page.test.tsx"
git commit -m "feat: build statement upload step for a new conciliação"
```

---

## Task 9: Comparação direta + transaction dialog + fechamento

**Files:**
- Create: `app/(app)/conciliacoes/[id]/page.tsx`
- Create: `app/(app)/conciliacoes/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `buscarConciliacao`, `fecharConciliacao`, `formatarMoeda`, `type Conciliacao`, `type LinhaComparacao` from `lib/mock-data.ts` (Task 4). `useParams`, `useRouter` from `next/navigation`.
- Produces: the `/conciliacoes/[id]` route linked from Task 7's dashboard and pushed to from Task 8's upload step. This is the last task — nothing later depends on it.

- [ ] **Step 1: Write the failing test**

Create `app/(app)/conciliacoes/[id]/page.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Conciliacao } from "@/lib/mock-data";
import ConciliacaoPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "conc-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

const buscarConciliacao = vi.fn();
const fecharConciliacao = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  buscarConciliacao: (id: string) => buscarConciliacao(id),
  fecharConciliacao: (id: string) => fecharConciliacao(id),
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

const conciliacaoEmAndamento: Conciliacao = {
  id: "conc-1",
  mes: "Setembro 2026",
  status: "em_andamento",
  linhas: [
    {
      id: "lc-1",
      descricao: "Boleto Aço Norte Bobinas",
      data: "04/09",
      valorBanco: 12640,
      valorSistema: 12604,
      status: "divergencia_valor",
      explicacao: "Juros de dois dias de atraso não lançados no sistema.",
      historico: [{ quando: "04/09", evento: "Pago no banco com juros de atraso" }],
    },
  ],
};

describe("ConciliacaoPage", () => {
  beforeEach(() => {
    buscarConciliacao.mockReset();
    fecharConciliacao.mockReset();
  });

  it("lists comparison rows for a conciliação em andamento", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);
    expect(await screen.findByText("Comparação direta")).toBeInTheDocument();
    expect(screen.getByText("Boleto Aço Norte Bobinas")).toBeInTheDocument();
  });

  it("opens the transaction dialog with its explanation when a row is clicked", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    await user.click(await screen.findByText("Boleto Aço Norte Bobinas"));
    expect(
      screen.getByText("Juros de dois dias de atraso não lançados no sistema.")
    ).toBeInTheDocument();
  });

  it("shows the fechamento success view when the conciliação is fechada", async () => {
    buscarConciliacao.mockReturnValue({ ...conciliacaoEmAndamento, status: "fechada" });
    render(<ConciliacaoPage />);
    expect(
      await screen.findByText("Setembro 2026 fechou sem divergência pendente.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "app/(app)/conciliacoes/[id]/page.test.tsx"`
Expected: FAIL — `./page` doesn't exist yet.

- [ ] **Step 3: Implement the conciliação detail page**

Create `app/(app)/conciliacoes/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  buscarConciliacao,
  fecharConciliacao,
  formatarMoeda,
  type Conciliacao,
  type LinhaComparacao,
} from "@/lib/mock-data";

const ROTULO_STATUS: Record<LinhaComparacao["status"], string> = {
  batido: "Batido",
  divergencia_valor: "Divergência de valor",
  somente_banco: "Só no banco",
  somente_sistema: "Só no sistema",
};

export default function ConciliacaoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [conciliacao, setConciliacao] = useState<Conciliacao | null | undefined>(undefined);
  const [linhaAberta, setLinhaAberta] = useState<LinhaComparacao | null>(null);

  useEffect(() => {
    setConciliacao(buscarConciliacao(params.id));
  }, [params.id]);

  if (conciliacao === undefined) {
    return null;
  }

  if (conciliacao === null) {
    return (
      <div style={{ padding: "48px 0" }}>
        <p>Conciliação não encontrada.</p>
      </div>
    );
  }

  function fechar() {
    const atualizada = fecharConciliacao(conciliacao!.id);
    if (atualizada) setConciliacao(atualizada);
  }

  if (conciliacao.status === "fechada") {
    return (
      <Fechamento
        conciliacao={conciliacao}
        onNovaConciliacao={() => router.push("/conciliacoes/nova")}
      />
    );
  }

  return (
    <div style={{ padding: "28px 0 72px", display: "flex", flexDirection: "column", gap: 22 }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600 }}>Comparação direta</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th style={{ textAlign: "right" }}>Banco</th>
            <th style={{ textAlign: "right" }}>Sistema</th>
            <th style={{ textAlign: "right" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {conciliacao.linhas.map((linha) => (
            <tr key={linha.id} onClick={() => setLinhaAberta(linha)} style={{ cursor: "pointer" }}>
              <td>{linha.data}</td>
              <td>{linha.descricao}</td>
              <td style={{ textAlign: "right" }}>
                {linha.valorBanco !== null ? formatarMoeda(linha.valorBanco) : "—"}
              </td>
              <td style={{ textAlign: "right" }}>
                {linha.valorSistema !== null ? formatarMoeda(linha.valorSistema) : "—"}
              </td>
              <td style={{ textAlign: "right" }}>
                <span className={linha.status === "batido" ? "tag tag-accent" : "tag tag-outline"}>
                  {ROTULO_STATUS[linha.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button type="button" className="btn btn-primary" onClick={fechar}>
          Fechar mês
        </button>
      </div>

      {linhaAberta && (
        <div className="dialog-backdrop" onClick={() => setLinhaAberta(null)}>
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <span className="dialog-title">{linhaAberta.descricao}</span>
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Extrato do banco</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600 }}>
                  {linhaAberta.valorBanco !== null ? formatarMoeda(linhaAberta.valorBanco) : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Extrato do sistema</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600 }}>
                  {linhaAberta.valorSistema !== null ? formatarMoeda(linhaAberta.valorSistema) : "—"}
                </div>
              </div>
            </div>
            {linhaAberta.explicacao && <p className="dialog-body">{linhaAberta.explicacao}</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                </tr>
              </thead>
              <tbody>
                {linhaAberta.historico.map((evento) => (
                  <tr key={`${evento.quando}-${evento.evento}`}>
                    <td>{evento.quando}</td>
                    <td>{evento.evento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setLinhaAberta(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fechamento({
  conciliacao,
  onNovaConciliacao,
}: {
  conciliacao: Conciliacao;
  onNovaConciliacao: () => void;
}) {
  const total = conciliacao.linhas.length;
  const batidos = conciliacao.linhas.filter((linha) => linha.status === "batido").length;
  const pendentes = total - batidos;

  return (
    <div style={{ padding: "44px 0 64px", maxWidth: 1000, display: "flex", flexDirection: "column", gap: 34 }}>
      <div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-accent-700)",
            marginBottom: 14,
          }}
        >
          Mês conciliado
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: 42, fontWeight: 400 }}>
          {pendentes === 0
            ? `${conciliacao.mes} fechou sem divergência pendente.`
            : `${conciliacao.mes} fechado com ${pendentes} ${pendentes === 1 ? "item revisado" : "itens revisados"}.`}
        </h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          borderTop: "1px solid var(--color-divider)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>Lançamentos</span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{total}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>
            Batidos automaticamente
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{batidos}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>
            Revisados manualmente
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{pendentes}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNovaConciliacao}
          style={{ fontSize: 15, padding: "12px 22px" }}
        >
          Começar o próximo mês
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- "app/(app)/conciliacoes/[id]/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Manual end-to-end check**

Run: `npm run dev`. Walk the whole loop in the browser: `/` → "Conciliar meu primeiro extrato" → `/login` → submit → `/dashboard` (empty state) → "Fazer o primeiro upload" → `/conciliacoes/nova` → select any two files → "Conciliar extratos" → `/conciliacoes/[id]` showing the comparison table → click "Boleto Aço Norte Bobinas" → dialog shows the divergence explanation and history → close it → "Fechar mês" → fechamento success view → "Começar o próximo mês" → back to `/conciliacoes/nova` → and separately, going back to `/dashboard` now shows the closed conciliação under "Conciliações recentes".

- [ ] **Step 6: Run the full test suite and lint**

Run: `npm run test && npm run lint`
Expected: all tests PASS, lint clean.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/conciliacoes/[id]/page.tsx" "app/(app)/conciliacoes/[id]/page.test.tsx"
git commit -m "feat: build comparação direta, transaction dialog and fechamento"
```

---

## Self-Review Notes

- **Spec coverage:** Landing (Task 3), login (Task 5), dashboard empty/populated (Task 7), nova conciliação upload (Task 8), comparação direta + dialog + fechamento (Task 9), mock auth/data (Task 4), jsdom/Testing Library (Task 1), design system port (Task 2) — every in-scope item from the spec has a task. Out-of-scope items (onboarding, import errors, settings hub, etc.) are intentionally absent, matching the spec.
- **Placeholder scan:** no TBD/TODO; every step has real, runnable code and real Portuguese copy sourced from the approved Claude Design project.
- **Type consistency:** `Conciliacao`, `LinhaComparacao`, `StatusLinha`, `EventoHistorico` are defined once in Task 4 and reused with identical shapes in Tasks 7-9; function names (`listarConciliacoes`, `criarConciliacao`, `buscarConciliacao`, `fecharConciliacao`, `formatarMoeda`, `login`, `getSession`, `logout`) are consistent everywhere they're consumed.
- **Next.js 16 specifics checked against `node_modules/next/dist/docs`:** dynamic route params in a Client Component use the `useParams()` hook (Task 9), not the Server-Component `params` Promise — confirmed against `use-params.md`. `cacheComponents` (which would force a Suspense boundary around `useParams`) is off by default and not enabled anywhere in this plan, per `cacheComponents.md`.

Plan complete and saved to `docs/superpowers/plans/2026-09-01-navigable-prototype.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
