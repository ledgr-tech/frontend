# Empresa ativa na URL e seletor de empresa — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar a empresa ativa na URL (`/e/<empresa>/...`), mandá-la ao backend em `X-Ledgr-Empresa` e trocar de empresa por um seletor, sem que duas abas se misturem.

**Architecture:** As páginas do app passam a viver no segmento real `app/(app)/e/[empresa]/`. O `proxy.ts` lê o UUID do caminho e repassa `x-ledgr-empresa` ao pedido; `lib/backend.ts` o manda ao backend, então as 45 chamadas não mudam. Um módulo de rotas, um `<Link>`, um `useRoteador()` e um `redirecionarNoApp()` prefixam os caminhos; um teste-guarda impede links crus. URLs antigas redirecionam para a última empresa usada (cookie só de preferência).

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, `params` assíncrono), React 19, TypeScript, Vitest + Testing Library, NextAuth (cookie httpOnly), backend FastAPI (ADR-019).

**Spec:** `docs/superpowers/specs/2026-10-21-empresa-ativa-na-url-design.md`

## Global Constraints

- Prefixo da URL: `/e/<uuid>/<caminho>`; um esquema só, mesmo com uma empresa.
- Cabeçalho interno do proxy: `x-ledgr-empresa`; cabeçalho ao backend: `X-Ledgr-Empresa`. O proxy **sempre apaga** o `x-ledgr-empresa` de entrada e só o recria de um UUID válido no caminho.
- Cookie `ledgr-empresa-recente`: não httpOnly, `SameSite=Lax`, `Path=/`; só escolhe o destino do redirect, **nunca** vai ao backend.
- Telas da empresa (seções): `assinatura`, `conciliacoes`, `dashboard`, `extratos`, `fechamentos`, `historico`, `regras`, `visao-geral`. `/login`, `/cadastro`, `/ajuda`, `/plano`, `/termos`, `/privacidade`, `/aceitar-convite`, `/redefinir-senha` ficam fora do prefixo.
- Seletor escondido com 1 empresa; busca a partir de mais de 8 empresas.
- `GET /me` traz `empresas: [{ id, razao_social, cnpj }]`; `empresa_id` do `/me` é obsoleto e **nunca** vai no cabeçalho.
- `params` do Next 16 é `Promise`; ler a doc em `node_modules/next/dist/docs/` antes de usar uma API nova do Next (AGENTS.md).
- Antes de cada commit: `npm run test`, `npm run lint` e `npm run build`. Sem filtro, `test` e `lint` varrem pastas não rastreadas (`.claude/worktrees`, `.github/skills`): rodar só nos arquivos do repositório (`npx vitest run --exclude ".claude/**" --exclude ".worktrees/**" --exclude ".agents/**" --exclude ".commandcode/**" --exclude ".github/**" --exclude "node_modules/**"` e `npx eslint --no-warn-ignored app lib auth.ts proxy.ts tests types scripts`).
- Mensagens de commit em português; terminar com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nunca `rm` em massa.
- O trabalho acontece no worktree `.worktrees/empresa-na-url`, branch `feat/empresa-na-url` (parte de `feat/aprovacao-justificativas`).

## Review Focus

Entradas que a spec implica e nenhuma tarefa óbvia cobriria; cada uma tem o teste na tarefa dona:

1. **Cabeçalho `x-ledgr-empresa` forjado** num pedido a um caminho sem `/e/` deve ser descartado, não repassado (Task 5).
2. **UUID inválido ou ausente na URL** (`/e/abc/x`, `/e/<uuid>` sem resto) não vira cabeçalho e dá 404 no layout (Tasks 2, 5, 6).
3. **Redirect aberto no redirect das URLs antigas** (`//evil.com`, `..`, `%2f`, segmentos vazios) deve dar 404, nunca sair do site (Task 8).
4. **`?empresa=` do CSV** que não é UUID dá 404 e não chega ao backend (Task 10).
5. **Cookie de empresa recente malformado ou de empresa que sumiu**, e **backend sem `empresas` no `/me`** (versão anterior ao #133): o app continua entrando, pela primeira empresa ou pelo `empresaId` da sessão (Tasks 6, 8).

---

### Task 1: Mover as páginas para `app/(app)/e/[empresa]/` (só mudança de lugar)

**Files:**
- Move: tudo em `app/(app)/*` para `app/(app)/e/[empresa]/` (inclui `layout.tsx`, `shell.tsx`, `menu-lateral.tsx`, `conta.tsx`, `cabecalho.tsx` e todas as pastas de tela, com os testes).
- Modify: as referências **de fora** para dentro de `app/(app)/` (`app/(auth)/plano/escolher-plano.tsx`, `app/(marketing)/*` que importam telas do app, `app/tela-de-aviso.tsx`, `lib/rodadas.ts`, e qualquer outra que `grep -rn "app/(app)" app lib tests proxy.ts auth.ts` achar fora da árvore movida): trocar `app/(app)/` por `app/(app)/e/[empresa]/` nos caminhos de import.

**Interfaces:**
- Produces: a árvore `app/(app)/e/[empresa]/...` que todas as tasks seguintes citam. Imports relativos entre os arquivos movidos continuam iguais, porque tudo se move junto.

- [ ] **Step 1: Mover com `git mv`.** Criar `app/(app)/e/[empresa]/` e mover cada item de `app/(app)/` (menos a pasta `e`) com `git mv`, entre aspas por causa dos parênteses e colchetes.
- [ ] **Step 2: Corrigir as referências de fora.** Rodar `grep -rn "app/(app)" app lib tests proxy.ts auth.ts --include=*.ts --include=*.tsx | grep -v "^app/(app)/e/"` e trocar nos imports `app/(app)/` por `app/(app)/e/[empresa]/`. Nada além de caminhos de import muda neste commit.
- [ ] **Step 3: Verificar tipos e testes.** Run: `npx tsc --noEmit -p . 2>&1 | grep -v "PageProps\|LayoutProps"` — Expected: sem saída. Run o vitest filtrado (Global Constraints) — Expected: mesmo número de arquivos e testes de antes (102 arquivos), todos passando.
- [ ] **Step 4: Verificar o build e a tabela de rotas.** Run: `npm run build` — Expected: compila; a tabela lista `/e/[empresa]/visao-geral`, `/e/[empresa]/conciliacoes/[id]` e `/e/[empresa]/conciliacoes/[id]/[linha]` (a rota interceptada `@painel` continua ao lado de `[linha]`) e **não** lista mais `/visao-geral` etc. (as URLs antigas voltam na Task 8).
- [ ] **Step 5: Confirmar que o diff é só renomeação.** Run: `git diff --cached -M --stat | tail -3` — Expected: arquivos renomeados sem linhas de código alteradas, fora os imports do Step 2.
- [ ] **Step 6: Commit** — `refactor: move as páginas do app para app/(app)/e/[empresa] (só mudança de lugar)`.

---

### Task 2: `lib/rotas.ts` — as regras do prefixo, puras

**Files:**
- Create: `lib/rotas.ts`
- Test: `lib/rotas.test.ts`

**Interfaces:**
- Produces (tudo exportado de `lib/rotas.ts`):
  - `const SECOES: readonly string[]` — as 8 seções de Global Constraints.
  - `const COOKIE_DA_EMPRESA_RECENTE = "ledgr-empresa-recente"`.
  - `ehUuid(valor: string): boolean` — 8-4-4-4-12 hex, sem diferenciar maiúsculas.
  - `empresaDoCaminho(caminho: string): string | null` — o UUID de `/e/<uuid>` ou `/e/<uuid>/...` (com ou sem query); `null` se não houver prefixo ou o segmento não for UUID.
  - `caminhoSemEmpresa(caminho: string): string` — `/e/<uuid>` vira `/`; `/e/<uuid>/x?y=1` vira `/x?y=1`; o que não tem prefixo válido volta igual.
  - `ehDaEmpresa(caminho: string): boolean` — o caminho **sem prefixo** começa por uma seção.
  - `comEmpresa(empresa: string, caminho: string): string` — prefixa só se `ehDaEmpresa(caminho)`; **se o caminho já tem prefixo válido, volta igual** (idempotente); mantém query e hash.
  - `secaoDoCaminho(caminho: string): string | null`.
  - `destinoDaTroca(caminhoAtual: string, novaEmpresa: string): string` — mantém a tela se ela não tem id (`/visao-geral`, `/extratos`, `/dashboard`, `/fechamentos`, `/historico`, `/assinatura`, `/regras`, `/conciliacoes/nova`); senão vai à raiz da seção (`conciliacoes` → `/dashboard`, `fechamentos` → `/fechamentos`, as outras → `/<seção>`); descarta a query; seção desconhecida vai a `/visao-geral`. Sempre devolve `/e/<novaEmpresa>/...`.
  - `escolherEmpresa(empresas: { id: string }[], recente: string | undefined): string | null` — o `recente` se estiver na lista; senão a primeira; `null` se a lista for vazia.
  - `destinoDaUrlAntiga(secao: string, resto: string[] | undefined, busca: Record<string, string | string[] | undefined>, empresa: string): string | null` — monta `/e/<empresa>/<secao>/<resto...>?<busca>`; `null` se `secao` não for seção, ou se algum segmento de `resto` for vazio, `.`, `..` ou tiver `/`, `\`, `%` ou `:`.

- [ ] **Step 1: Write the failing test** em `lib/rotas.test.ts`, com asserções para cada função. Exemplos que fixam o comportamento (usar `const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20"` e `const B = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"`):

```ts
expect(empresaDoCaminho(`/e/${A}/fechamentos?mes=2026-09`)).toBe(A);
expect(empresaDoCaminho("/e/abc/fechamentos")).toBeNull();
expect(empresaDoCaminho("/fechamentos")).toBeNull();
expect(caminhoSemEmpresa(`/e/${A}`)).toBe("/");
expect(caminhoSemEmpresa(`/e/${A}/conciliacoes/x?sistema=y`)).toBe("/conciliacoes/x?sistema=y");
expect(caminhoSemEmpresa("/e/abc/x")).toBe("/e/abc/x");
expect(comEmpresa(A, "/fechamentos?mes=2026-09")).toBe(`/e/${A}/fechamentos?mes=2026-09`);
expect(comEmpresa(A, "/login")).toBe("/login");
expect(comEmpresa(A, "/ajuda/visao-geral")).toBe("/ajuda/visao-geral");
expect(comEmpresa(A, `/e/${B}/extratos`)).toBe(`/e/${B}/extratos`); // idempotente
expect(destinoDaTroca(`/e/${A}/fechamentos`, B)).toBe(`/e/${B}/fechamentos`);
expect(destinoDaTroca(`/e/${A}/conciliacoes/${A}?sistema=${A}`, B)).toBe(`/e/${B}/dashboard`);
expect(destinoDaTroca(`/e/${A}/conciliacoes/nova`, B)).toBe(`/e/${B}/conciliacoes/nova`);
expect(destinoDaTroca(`/e/${A}/fechamentos/2026-09/relatorio`, B)).toBe(`/e/${B}/fechamentos`);
expect(escolherEmpresa([{ id: A }, { id: B }], B)).toBe(B);
expect(escolherEmpresa([{ id: A }, { id: B }], "lixo")).toBe(A);
expect(escolherEmpresa([], B)).toBeNull();
expect(destinoDaUrlAntiga("fechamentos", undefined, { mes: "2026-09" }, A)).toBe(`/e/${A}/fechamentos?mes=2026-09`);
expect(destinoDaUrlAntiga("conciliacoes", ["nova"], {}, A)).toBe(`/e/${A}/conciliacoes/nova`);
// redirect aberto e travessia: tudo isto dá null
for (const resto of [[""], [".."], ["."], ["a/b"], ["%2f%2fevil.com"], ["\\evil"], ["http:"]]) {
  expect(destinoDaUrlAntiga("extratos", resto, {}, A)).toBeNull();
}
expect(destinoDaUrlAntiga("login", undefined, {}, A)).toBeNull();
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run lib/rotas.test.ts` — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement `lib/rotas.ts`** com as assinaturas acima. Uma regex para o prefixo (`^/e/(<uuid>)(?=/|\?|#|$)`); `URLSearchParams` para a query de `destinoDaUrlAntiga` (valor array vira chave repetida).
- [ ] **Step 4: Run test to verify it passes** — Run: `npx vitest run lib/rotas.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(rotas): regras puras do prefixo /e/<empresa>` (com `lib/rotas.ts` e `lib/rotas.test.ts`).

---

### Task 3: A empresa ativa no cliente: contexto, `<Link>` e `useRoteador()`

**Files:**
- Create: `lib/empresa-ativa.tsx`, `lib/link-do-app.tsx`, `lib/roteador.ts`, `lib/empresa-recente.ts`
- Test: `lib/empresa-ativa.test.tsx`, `lib/link-do-app.test.tsx`, `lib/roteador.test.tsx`

**Interfaces:**
- Consumes: `comEmpresa`, `COOKIE_DA_EMPRESA_RECENTE` de `lib/rotas.ts` (Task 2).
- Produces:
  - `lib/empresa-ativa.tsx` (`"use client"`): `type EmpresaDaConta = { id: string; razaoSocial: string; cnpj: string }`; `ProvedorDaEmpresa({ ativa, empresas, children }: { ativa: EmpresaDaConta; empresas: EmpresaDaConta[]; children: ReactNode })`; `useEmpresaAtiva(): EmpresaDaConta | null` (`null` fora do provedor); `useEmpresasDaConta(): EmpresaDaConta[]` (`[]` fora).
  - `lib/link-do-app.tsx` (`"use client"`): export default `LinkDoApp(props: ComponentProps<typeof Link>)` — igual ao `next/link`, mas com `href` string prefixado por `comEmpresa(ativa.id, href)` quando há empresa ativa; `href` objeto e uso fora do provedor passam sem mudança.
  - `lib/roteador.ts` (`"use client"`): `useRoteador(): { push(href: string): void; replace(href: string): void; refresh(): void; back(): void; prefetch(href: string): void }` — sobre `useRouter` de `next/navigation`; `push`, `replace` e `prefetch` passam o `href` por `comEmpresa` com a empresa ativa (sem provedor, sem prefixo).
  - `lib/empresa-recente.ts`: `gravarEmpresaRecente(id: string): void` — grava `document.cookie = "ledgr-empresa-recente=<id>; Path=/; Max-Age=31536000; SameSite=Lax"`; não faz nada se `id` não for UUID ou se não houver `document`.

- [ ] **Step 1: Write the failing tests.** `link-do-app.test.tsx`: dentro de `ProvedorDaEmpresa` com `ativa.id = A`, `<LinkDoApp href="/fechamentos">` renderiza `href="/e/<A>/fechamentos"`; `href="/login"` e `href="/ajuda/extratos"` ficam iguais; sem provedor, `href="/fechamentos"` fica igual. `roteador.test.tsx` (com `next/navigation` mockado): dentro do provedor, `push("/extratos")` chama o `push` do router com `/e/<A>/extratos`, `push("/login")` com `/login`, `push("/e/<B>/extratos")` com `/e/<B>/extratos` (não troca o prefixo); sem provedor, `push("/extratos")` fica `/extratos`. `empresa-ativa.test.tsx`: os dois hooks dentro e fora. Teste do cookie: `gravarEmpresaRecente(A)` deixa `document.cookie` com o valor; `gravarEmpresaRecente("lixo")` não grava.
- [ ] **Step 2: Run tests to verify they fail** — Run: `npx vitest run lib/empresa-ativa.test.tsx lib/link-do-app.test.tsx lib/roteador.test.tsx` — Expected: FAIL (módulos não existem).
- [ ] **Step 3: Implement** os quatro arquivos com as assinaturas acima. `LinkDoApp` envolve o `Link` do Next sem copiar suas props.
- [ ] **Step 4: Run tests to verify they pass** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(rotas): contexto da empresa ativa, Link e useRoteador que prefixam os caminhos`.

---

### Task 4: O servidor: `empresaDaRequisicao`, `caminhoDoApp`, `redirecionarNoApp`

**Files:**
- Create: `lib/rotas-servidor.ts`
- Test: `lib/rotas-servidor.test.ts`

**Interfaces:**
- Consumes: `ehUuid`, `comEmpresa` de `lib/rotas.ts`.
- Produces: `empresaDaRequisicao(): Promise<string | null>` — `headers().get("x-ledgr-empresa")` se for UUID, senão `null`; **também `null` fora de uma requisição** (a leitura de `headers()` lança: capturar, como `ipDoNavegador` em `lib/backend.ts`); `caminhoDoApp(caminho: string): Promise<string>` — `comEmpresa` com a empresa da requisição, ou o caminho igual se não houver; `redirecionarNoApp(caminho: string): Promise<never>` — `redirect(await caminhoDoApp(caminho))` de `next/navigation`.

- [ ] **Step 1: Write the failing test** (`next/headers` e `next/navigation` mockados): com o cabeçalho `x-ledgr-empresa: <A>`, `empresaDaRequisicao()` devolve `A` e `caminhoDoApp("/extratos")` devolve `/e/<A>/extratos`; com cabeçalho `lixo` ou ausente devolve `null` e o caminho igual; `headers()` lançando devolve `null`; `redirecionarNoApp("/fechamentos")` chama `redirect` com `/e/<A>/fechamentos`; `caminhoDoApp("/login")` fica `/login`.
- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run lib/rotas-servidor.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `lib/rotas-servidor.ts`.**
- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(rotas): a empresa da requisição no servidor e o redirect que a leva`.

---

### Task 5: O proxy repassa a empresa e o `chamarBackend` a manda ao backend

**Files:**
- Modify: `proxy.ts`, `lib/backend.ts`
- Test: `proxy.test.ts`, `lib/backend.test.ts`

**Interfaces:**
- Consumes: `empresaDoCaminho` (Task 2); `empresaDaRequisicao` (Task 4).
- Produces: o pedido que chega às páginas e Server Actions traz `x-ledgr-empresa` (só de um `/e/<uuid>/...`); `chamarBackend`/`baixarDoBackend` mandam `X-Ledgr-Empresa` quando há empresa. `Opcoes` ganha `empresa?: string` (vence o cabeçalho da requisição; a Task 10 o usa); `baixarDoBackend(caminho: string, opcoes?: { empresa?: string }): Promise<Response>`.

- [ ] **Step 1: Write the failing tests.** `proxy.test.ts` (o padrão do teste existente: ler `x-middleware-request-<nome>` e `x-middleware-override-headers` da resposta): (a) `new NextRequest("http://localhost/e/<A>/visao-geral")` → `x-middleware-request-x-ledgr-empresa` é `A`; (b) **spoof:** `new NextRequest("http://localhost/visao-geral", { headers: { "x-ledgr-empresa": A } })` → a resposta não traz `x-middleware-request-x-ledgr-empresa` e `x-middleware-override-headers` não o lista; (c) `/e/abc/visao-geral` e `/e/<A>` com o cabeçalho de fora → sem cabeçalho (UUID inválido não vira empresa; `/e/<A>` sem resto **vira** empresa `A`); (d) a CSP e o `x-nonce` continuam como antes. `lib/backend.test.ts` (mockando `headers()` como o resto do arquivo): com o cabeçalho `x-ledgr-empresa: <A>` na requisição, o `fetch` ao backend leva `X-Ledgr-Empresa: <A>`; sem ele, não leva; `opcoes.empresa = B` vence o da requisição; cabeçalho da requisição que não é UUID não é repassado; chamada `publica: true` nunca leva.
- [ ] **Step 2: Run tests to verify they fail** — Run: `npx vitest run proxy.test.ts lib/backend.test.ts` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement.** Em `proxy.ts`: depois de copiar os cabeçalhos do pedido, `cabecalhos.delete("x-ledgr-empresa")` e, se `empresaDoCaminho(request.nextUrl.pathname)` der um UUID, `cabecalhos.set("x-ledgr-empresa", <uuid>)`. Em `lib/backend.ts`: em `requisitar`, fora do ramo `publica`, `const empresa = init.empresa ?? (await empresaDaRequisicao())` e `cabecalhos.set("X-Ledgr-Empresa", empresa)` se houver; tirar `empresa` de `resto` antes do `fetch`.
- [ ] **Step 4: Run tests to verify they pass** — Run: `npx vitest run proxy.test.ts lib/backend.test.ts lib/rotas-servidor.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): o proxy repassa a empresa da URL e o chamarBackend a manda em X-Ledgr-Empresa`.

---

### Task 6: `contaDaSessao` traz as empresas e o layout de `e/[empresa]` as confere

**Files:**
- Modify: `app/(auth)/acoes.ts` (`ContaDaSessao`, `contaDaSessao`), `app/(app)/e/[empresa]/layout.tsx`, `app/(app)/e/[empresa]/shell.tsx` (props novas, sem o seletor ainda)
- Test: `app/(auth)/acoes.test.ts`, `app/(app)/e/[empresa]/layout.test.tsx`, `app/(app)/e/[empresa]/shell.test.tsx`

**Interfaces:**
- Consumes: `ehUuid` (Task 2); `ProvedorDaEmpresa`, `EmpresaDaConta` (Task 3).
- Produces: `ContaDaSessao.empresas: EmpresaDaConta[]` (de `eu.empresas` com `{ id, razao_social, cnpj }`; `[]` se o campo faltar, no fallback do erro também). `AppLayout({ children, params }: { children: ReactNode; params: Promise<{ empresa: string }> })`. `Shell` ganha as props `empresaAtiva: EmpresaDaConta`, `empresas: EmpresaDaConta[]`, `nomeDaConta: string`; a razão social da **empresa ativa** vai no `EmpresaDaSessao` e o `empresa` do menu (o cartão do usuário) passa a ser `nomeDaConta`.

- [ ] **Step 1: Write the failing tests.** `acoes.test.ts`: `/me` com `empresas` → `contaDaSessao().empresas` no formato camelCase; sem o campo → `[]`. `layout.test.tsx`: UUID inválido em `params` → `notFound` chamado; UUID que não está em `empresas` (lista não vazia) → `notFound`; **lista vazia** (backend sem `empresas` ou `/me` fora do ar) → aceita o UUID e passa `empresaAtiva = { id, razaoSocial: conta.empresa, cnpj: "" }`; UUID da lista → `Shell` recebe `empresaAtiva` certa, `empresas` e `nomeDaConta = conta.empresa`; sem sessão → `redirect("/login")`; `situacao: "sem_plano"` → `redirect("/plano")`. `shell.test.tsx`: as props novas.
- [ ] **Step 2: Run tests to verify they fail** — Run: `npx vitest run "app/(auth)/acoes.test.ts" "app/(app)/e/[empresa]/layout.test.tsx" "app/(app)/e/[empresa]/shell.test.tsx"` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement.** O layout lê `const { empresa } = await params`, valida, envolve `Shell` em `ProvedorDaEmpresa` e usa `notFound` de `next/navigation` (a guarda da Task 7 não o proíbe). Os testes existentes do layout passam `params: Promise.resolve({ empresa: A })`.
- [ ] **Step 4: Run tests to verify they pass** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(empresas): contaDaSessao traz as empresas e o layout confere a da URL`.

---

### Task 7: Todos os links, pushes e redirects passam pelos auxiliares (com teste-guarda)

**Files:**
- Create: `lib/rotas.guarda.test.ts`
- Modify: todo arquivo não-teste em `app/(app)/e/[empresa]/**` que o teste-guarda apontar; `app/(app)/e/[empresa]/tutorial/tutorial-da-rota.tsx`, `ajuda/menu-de-ajuda.tsx`, `ajuda/painel-de-ajuda.tsx`, `menu-lateral.tsx` (os 4 `usePathname`)

**Interfaces:**
- Consumes: `LinkDoApp` (Task 3), `useRoteador` (Task 3), `redirecionarNoApp` (Task 4), `caminhoSemEmpresa` (Task 2).
- Produces: nenhum arquivo da árvore importa `Link` de `next/link` nem `useRouter`/`redirect` de `next/navigation`, e nenhum usa `<a href>`, `window.open` ou `location` com literal para uma seção da empresa.

- [ ] **Step 1: Write the failing guard test** `lib/rotas.guarda.test.ts`: percorre `app/(app)/e/[empresa]` (módulo `fs`, recursivo), nos arquivos `.ts`/`.tsx` que não terminam em `.test.ts(x)`, e reúne os ofensores de quatro regras: (1) `from "next/link"`; (2) import de `useRouter` ou `redirect` de `"next/navigation"`; (3) `<a` com `href` literal ou template começando por `/<seção>` (qualquer seção); (4) `window.open(` ou `location.href =`/`location.assign(` com literal começando por `/<seção>`. Termina com `expect(ofensores).toEqual([])` e, na mensagem, lista `arquivo: regra`.
- [ ] **Step 2: Run it to verify it fails** — Run: `npx vitest run lib/rotas.guarda.test.ts` — Expected: FAIL listando os ofensores (cerca de 28 arquivos com `Link`, os `useRouter`, os `redirect`, e `fechamentos/mesa.tsx` com o `<a href>` do relatório em PDF).
- [ ] **Step 3: Aplicar a troca em cada ofensor.** `import Link from "next/link"` vira `import Link from "@/lib/link-do-app"`; `useRouter` de `next/navigation` vira `useRoteador` de `@/lib/roteador` (os métodos usados têm os mesmos nomes); `redirect("/x")` em código de servidor vira `await redirecionarNoApp("/x")` de `@/lib/rotas-servidor` (a função que chama precisa ser `async`); o `<a href=...relatorio?imprimir=1 target="_blank">` de `fechamentos/mesa.tsx` vira `<Link>` (`LinkDoApp`) com o mesmo `target` e `rel`. Um script descartável no scratchpad pode fazer as três primeiras trocas; **não é commitado**.
- [ ] **Step 4: Os 4 `usePathname`.** `telaDoCaminho(usePathname())` vira `telaDoCaminho(caminhoSemEmpresa(usePathname()))` nos três arquivos de tutorial e ajuda; em `menu-lateral.tsx`, o `caminho` usado para marcar o item ativo (`href` e `tambem`) vira `caminhoSemEmpresa(usePathname())`. Os `href` do menu continuam sem prefixo: o `LinkDoApp` os prefixa.
- [ ] **Step 5: Run the guard and the whole suite** — Run: `npx vitest run lib/rotas.guarda.test.ts` — Expected: PASS. Run o vitest filtrado completo — Expected: tudo passando; testes de telas que mockam `useRouter` de `next/navigation` seguem válidos (o `useRoteador` usa o mesmo mock; sem provedor não há prefixo). Ajustar só os testes que quebrarem.
- [ ] **Step 6: Commit** — `refactor: links, pushes e redirects do app passam pelos auxiliares da empresa ativa, com teste-guarda`.

---

### Task 8: URLs antigas redirecionam para a empresa certa

**Files:**
- Create: `app/(sem-empresa)/[secao]/[[...resto]]/page.tsx`, `app/(sem-empresa)/[secao]/[[...resto]]/page.test.tsx`
- Modify: `app/robots.ts` (e seu teste, se houver)

**Interfaces:**
- Consumes: `escolherEmpresa`, `destinoDaUrlAntiga`, `COOKIE_DA_EMPRESA_RECENTE` (Task 2); `contaDaSessao` (Task 6); `auth` de `@/auth`.
- Produces: `GET /visao-geral` (e qualquer seção, com resto e query) responde 307 para `/e/<empresa>/...`.

- [ ] **Step 1: Write the failing test** (`@/auth`, `contaDaSessao`, `next/headers` e `next/navigation` mockados): chamar `Page({ params: Promise.resolve({ secao, resto }), searchParams: Promise.resolve({...}) })`. (a) sem sessão → `redirect("/login")`; (b) com `empresas = [A, B]` e cookie `B` → redireciona para `/e/<B>/fechamentos?mes=2026-09`; (c) cookie `lixo` ou de empresa que não está na lista → usa `A`; (d) `empresas` vazio (backend sem o campo): usa o `empresaId` da sessão (`sessao.user.empresaId`) se for UUID, senão `notFound`; (e) **redirect aberto:** `resto` `[""]`, `[".."]`, `["%2f%2fevil.com"]`, `["a/b"]` e `secao` `"login"` → `notFound`, nunca `redirect`; (f) `conciliacoes/nova` e `conciliacoes/<id>` com `?sistema=` preservam a query.
- [ ] **Step 2: Run test to verify it fails** — Run: `npx vitest run "app/(sem-empresa)"` — Expected: FAIL.
- [ ] **Step 3: Implement** o Server Component (`export default async function`): sessão → `contaDaSessao()` → `cookies()` → `escolherEmpresa` → `destinoDaUrlAntiga` → `redirect`; `notFound()` quando o destino for `null`. Em `app/robots.ts`, acrescentar `"/e"` à lista de rotas barradas.
- [ ] **Step 4: Run test to verify it passes; run the build** — Run: `npx vitest run "app/(sem-empresa)"` — Expected: PASS. Run: `npm run build` — Expected: a tabela lista `/[secao]/[[...resto]]` ao lado das rotas fixas (`/login`, `/ajuda/...` etc. continuam com as suas: rota estática vence a dinâmica).
- [ ] **Step 5: Commit** — `feat(empresas): URLs antigas redirecionam para a última empresa usada`.

---

### Task 9: O seletor de empresa e os nomes nas telas

**Files:**
- Create: `app/(app)/e/[empresa]/seletor-de-empresa.tsx`, `app/(app)/e/[empresa]/seletor-de-empresa.test.tsx`
- Modify: `app/(app)/e/[empresa]/menu-lateral.tsx` (renderiza o seletor abaixo do logo), `app/(app)/e/[empresa]/conciliacoes/nova/page.tsx` (linha "Conciliando para"), `app/globals.css` (classes `.seletor-empresa*`, com os tokens do design system)
- Test: `menu-lateral.test.tsx`, `conciliacoes/nova/page.test.tsx`

**Interfaces:**
- Consumes: `useEmpresaAtiva`, `useEmpresasDaConta` (Task 3); `useRoteador` (Task 3); `destinoDaTroca` (Task 2); `gravarEmpresaRecente` (Task 3); `usePathname` de `next/navigation`.
- Produces: `SeletorDeEmpresa(): JSX.Element | null` — `null` com menos de 2 empresas.

- [ ] **Step 1: Write the failing tests.** `seletor-de-empresa.test.tsx` (dentro de `ProvedorDaEmpresa`, `usePathname` e o router mockados): com 1 empresa não renderiza nada; com 2, mostra um botão com a razão social e o CNPJ da ativa (`aria-haspopup="listbox"`); clicar abre uma lista com as duas (`role="option"`), a ativa com `aria-selected="true"`; escolher a outra, estando em `/e/<A>/fechamentos`, chama `push` com `/e/<B>/fechamentos` e grava o cookie; estando em `/e/<A>/conciliacoes/<id>` vai a `/e/<B>/dashboard`; Escape fecha; setas e Enter escolhem; com 8 empresas **não** há campo de busca e com 9 há (`getByLabelText("Buscar empresa")`) e ele filtra por razão social e CNPJ sem diferenciar maiúsculas. `menu-lateral.test.tsx`: o seletor aparece abaixo do logo com 2 empresas e não aparece com 1. `nova/page.test.tsx`: com 2 empresas a página mostra "Conciliando para <razão social da ativa>"; com 1, não.
- [ ] **Step 2: Run tests to verify they fail** — Run: `npx vitest run "app/(app)/e/[empresa]/seletor-de-empresa.test.tsx" "app/(app)/e/[empresa]/menu-lateral.test.tsx" "app/(app)/e/[empresa]/conciliacoes/nova"` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement `SeletorDeEmpresa`.** Botão + lista flutuante no padrão dos outros menus do app (`app/(app)/e/[empresa]/ajuda/menu-de-ajuda.tsx` é a referência de foco e Escape); CNPJ formatado `00.000.000/0000-00` (usar o formatador de CNPJ do projeto se existir; senão uma função local); barra recolhida mostra só as iniciais da razão social. Navega com `useRoteador().push(destinoDaTroca(usePathname(), id))` — o `comEmpresa` não troca um prefixo que já existe, então o destino chega como foi montado.
- [ ] **Step 4: Run tests to verify they pass, then check visually.** Run os mesmos testes — Expected: PASS. Run: `npm run build`; subir o app e conferir no navegador, com 2 empresas, o seletor expandido e recolhido, claro e escuro.
- [ ] **Step 5: Commit** — `feat(empresas): seletor de empresa no topo da barra lateral e o nome da empresa na Nova conciliação`.

---

### Task 10: O CSV leva a empresa

**Files:**
- Modify: `lib/caminhos.ts` (`caminhoDoCsv`), `app/(app)/e/[empresa]/conciliacoes/[id]/exportar-csv.tsx`, `app/api/conciliacoes/[id]/exportar/route.ts`
- Test: `lib/caminhos.test.ts`, `app/(app)/e/[empresa]/conciliacoes/[id]/exportar-csv.test.tsx`, `app/api/conciliacoes/[id]/exportar/route.test.ts`

**Interfaces:**
- Consumes: `baixarDoBackend(caminho, { empresa })` (Task 5); `ehUuid` (Task 2); `useEmpresaAtiva` (Task 3).
- Produces: `caminhoDoCsv(extratoBancoId: string, extratoSistemaId?: string, status?: string, empresa?: string): string` — acrescenta `empresa=<id>` à query quando passado.

- [ ] **Step 1: Write the failing tests.** `caminhos.test.ts`: com `empresa` a query leva `empresa=<A>` junto de `sistema` e `status`; sem, igual a hoje. `exportar-csv.test.tsx`: dentro de `ProvedorDaEmpresa` o `fetch` é chamado com um caminho que tem `empresa=<A>`. `route.test.ts`: `?empresa=<A>` chega a `baixarDoBackend` como `{ empresa: A }`; **`?empresa=lixo` responde 404 `{ erro: "Empresa não encontrada." }` sem chamar o backend**; sem `empresa` segue como hoje.
- [ ] **Step 2: Run tests to verify they fail** — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement** nos três arquivos; o handler valida o `empresa` com `ehUuid` antes de qualquer outra coisa.
- [ ] **Step 4: Run tests to verify they pass** — Run: `npx vitest run lib/caminhos.test.ts "app/(app)/e/[empresa]/conciliacoes/[id]/exportar-csv.test.tsx" "app/api/conciliacoes"` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(csv): a exportação leva a empresa ativa ao backend`.

---

### Task 11: Verificação real com duas abas, documentação e fechamento

**Files:**
- Modify: `CLAUDE.md` (parágrafo novo em "Backend status"), `docs/superpowers/specs/2026-10-21-empresa-ativa-na-url-design.md` (nenhuma mudança de conteúdo; só confirmar que continua certa)

**Interfaces:**
- Consumes: tudo acima.

- [ ] **Step 1: Subir o ambiente.** O backend local está em `:8000` (já com o #133). Crie uma segunda empresa na conta de teste por `POST /empresas` (corpo `{ "cnpj": "11444777000161", "razao_social": "Cliente Dois Ltda" }`, Bearer assinado com o segredo local, como nas verificações anteriores). Se a conta de teste estiver `sem_plano`, escolher um plano em `/plano` primeiro (só o banco local). `npm run build` e `next start` do worktree com `LEDGR_API_URL=http://localhost:8000` e `AUTH_TRUST_HOST=true`.
- [ ] **Step 2: Provar o isolamento.** Com Playwright, em **duas abas** do mesmo contexto: aba 1 em `/e/<A>/dashboard`, aba 2 em `/e/<B>/dashboard`. Enviar um par de CSVs de exemplo na aba 2 (empresa B) e conciliar. Confirmar: a conciliação aparece na empresa B e **não** na A; trocar de empresa pelo seletor na aba 1 não muda a aba 2; abrir uma linha da comparação abre o painel interceptado por cima da página; `/visao-geral` (URL antiga) redireciona para a última empresa usada; `/e/<uuid-de-outra-conta>/visao-geral` dá 404; o CSV baixa só da empresa certa. Capturar as telas (seletor, abas lado a lado).
- [ ] **Step 3: Documentar.** Em `CLAUDE.md`, um item novo: empresa na URL (`/e/<uuid>`), proxy que repassa `x-ledgr-empresa`, `lib/rotas*.ts`, teste-guarda, cookie `ledgr-empresa-recente` (só preferência), seletor, redirect das URLs antigas e o CSV com `?empresa=`; ajustar a frase do item "Team and invites" que diz que as empresas clientes não foram construídas (cadastro e avisos de limite seguem sendo a parte B).
- [ ] **Step 4: Verificação final** — Run o vitest filtrado completo, o eslint filtrado e `npm run build` — Expected: tudo passando e sem problemas.
- [ ] **Step 5: Commit** — `docs: empresa ativa na URL no CLAUDE.md`.
