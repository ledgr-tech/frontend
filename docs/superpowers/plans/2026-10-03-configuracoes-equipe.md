# Configurações: equipe, regras, segurança e dados — Implementation Plan

> **Não executar este plano como está (revisão de 08/10/2026).** Com a conta única no
> MVP e só a tolerância de data editável (decisões de 05 e 06/10, resumidas no topo da
> spec), as tarefas ficam assim:
>
> - **Tasks 1, 3, 5, 6 e 7** (papéis, o que cada papel vê, Dados e privacidade, Equipe,
>   `/convite`): fora do MVP, até depois de 28/10.
> - **Task 2** (quem sou eu): feita no ledgr-tech/frontend#101, sem o papel, como
>   `contaDaSessao` em `app/(auth)/acoes.ts`.
> - **Task 4** (a janela reorganizada): não feita. Conta continua com a senha;
>   Segurança só faria sentido com "Sair de todos os aparelhos" (#75).
> - **Task 8** (regras do motor): feita só com a tolerância de data, em
>   `app/(app)/configuracoes.tsx` (`ToleranciaEditavel`) e `carregarRegras`/
>   `salvarToleranciaDias` em `app/(app)/conciliacoes/acoes.ts`.
> - **Task 9** (as regras em cada rodada): fora; eram a tolerância de valor e a
>   semelhança.
> - **Task 10**: a documentação é esta revisão e a da spec.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pôr na janela de Configurações a Equipe (com a página `/convite`), as regras do motor editáveis, Segurança e Dados e privacidade, com três papéis, cada parte ligando sozinha quando o backend tiver a rota.

**Architecture:** O papel vem do `GET /me` e entra no contexto do `Shell`. Uma tabela só (`lib/papeis.ts`) diz o que cada papel pode, e `SoQuemPode` esconde o que ele não pode. A janela (`app/(app)/configuracoes.tsx`) fica com a moldura e a busca; as seções novas vão para `app/(app)/_configuracoes/`, com as Server Actions delas num `acoes.ts` próprio. Cada seção lê a própria rota e, com 404 ou 405, explica o que vai fazer, sem botão.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Route Handlers), NextAuth v5, React 19, Vitest + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-02-configuracoes-equipe-design.md`

## Global Constraints

- **Base da branch:** `feat/configuracoes-equipe` sai de `origin/develop` depois que o PR #93 (rodadas) entrar. Se ele ainda não entrou, sai de `origin/feat/historico-rodadas` e é rebaseada no `develop` quando o #93 entrar. A Task 9 depende do #93; as outras, não.
- **Onde fica o worktree:** dentro do worktree da sessão, em `<worktree-da-sessão>/.worktrees/configuracoes-equipe`. Fora dele, o hook bloqueia a edição. Copie o `.env.local` com `cp`, sem ler o arquivo.
- **Antes de cada commit:** `npm run test && npm run lint && npm run build`.
- **Mensagens de commit** terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Só dado real**, e nenhum controle que finja salvar o que o backend não guarda.
- **Backend:** `lib/backend.ts` é o único ponto de contato. As telas chegam a ele por Server Actions. Arquivo volta por Route Handler, com os bytes repassados sem decodificar.
- **Arquivos `"use server"`** exportam só funções async e tipos.
- **Estilo:**
  - Classes e tokens ficam em `app/globals.css`, no bloco `.cfg-*`. As classes novas usam o prefixo `cfg-`.
  - Nada de `style` inline que escolha fonte.
  - Ícone não passa `strokeWidth`.
  - Texto de 20px ou mais é título. O `guia-de-estilo.test.ts` cobra essas regras.
- **Formatação:** não rode o prettier no arquivo inteiro.
- **Escopo:** só o frontend. Nada de editar issue, cartão ou repositório do backend.
- **Textos fixados pela spec**, sem mudar uma vírgula:
  - "Seu papel não permite esta ação."
  - "Ainda não disponível: o servidor do Ledgr ainda não tem esta função."
  - "Só administradores convidam e mudam papéis."
  - "Só administradores mudam as regras."
  - "Ela perde o acesso em até 7 dias."
  - "A empresa precisa de pelo menos um administrador."
  - "Convite enviado para <e-mail>. O link vale por 7 dias."
  - "Esse e-mail já tem acesso à empresa."
  - "Esse e-mail já tem conta no Ledgr, em outra empresa."
  - "Este convite expirou ou já foi usado. Peça um novo a quem convidou."
  - "Regras salvas. Valem a partir da próxima conciliação; as que já rodaram continuam com as regras de quando rodaram."
  - "Descartar as mudanças nas regras?"
  - "Ajustar as regras chega quando o backend tiver a rota."
  - "As regras mudaram depois desta rodada. Elas valem na próxima."
  - "Você sai em todos os aparelhos, inclusive neste."
  - "Peça a um administrador."
  - "Apaga só o seu acesso. Os dados da empresa continuam."
  - "Se você for o único administrador, apaga também os dados da empresa: extratos, conciliações e histórico."
  - "Passe a administração para outra pessoa na Equipe antes de sair."

## Review Focus

1. **O `/me` manda um papel que o app não conhece** (`"dono"`, `null` ou `"Contador "`). O app trata como administrador, ou normaliza o texto, e nunca quebra nem trava a pessoa. O teste fica na Task 1.
2. **O e-mail da sessão chega com maiúsculas diferentes das do `/empresa/usuarios`.** A marca "você" continua na linha certa, e essa linha segue sem seletor e sem "Remover". O teste fica na Task 6.
3. **Valor em reais digitado do jeito brasileiro ou do outro** (`"0,05"`, `"1.000,50"`, `"0.05"`, `" 0,1 "`, `"abc"`, `""`). A leitura acerta o número ou devolve null, nunca um valor errado. O teste fica na Task 8.
4. **Esc com alteração pendente nas regras.** O Esc dispara o `cancel` nativo do `<dialog>`. A janela pergunta antes de fechar, em vez de perder o que foi digitado. O teste fica na Task 8.
5. **Link do convite sem token, ou efeito rodando duas vezes no StrictMode.** A página diz que o link está incompleto e não chama o backend. Na segunda passada, o fragmento já apagado não vira "sem token". O teste fica na Task 7.

---

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `lib/papeis.ts` (novo) | Os três papéis, as ações e `pode` |
| `app/(app)/papel.tsx` (novo) | Contexto do papel, `usePapel`, `SoQuemPode` |
| `app/(auth)/acoes.ts` | `quemSouEu` (no lugar de `razaoSocialDaEmpresa`), `encerrarSessoes`, `consultarConvite`, `aceitarConvite`, o 409 do `excluirConta` |
| `lib/demo.ts` | `ehContaDeDemonstracao`, que sai de dentro do `naConta` |
| `app/(app)/_configuracoes/comum.tsx` (novo) | O que hoje está solto em `configuracoes.tsx`: `Linha`, `Secao`, `Linhas`, `Segmentado`, `AcaoDaConta`, `Tecla`, `normalizar` |
| `app/(app)/_configuracoes/seguranca.tsx` (novo) | `SairDeTodos` |
| `app/(app)/_configuracoes/exportar-tudo.tsx` (novo) | Botão e nome do `.zip` |
| `app/api/empresa/exportacao/route.ts` (novo) | Repassa o `.zip` do backend |
| `app/(app)/_configuracoes/acoes.ts` (novo, `"use server"`) | Equipe e regras no backend |
| `app/(app)/_configuracoes/equipe.tsx` (novo) | A seção Equipe |
| `app/(auth)/convite/page.tsx` (novo) | A página de quem recebe o convite |
| `lib/regras.ts` (novo) | Tipos das regras, adaptador, leitura de reais, validação, texto da rodada |
| `app/(app)/_configuracoes/regras.tsx` (novo) | `useRegras` e a seção Conciliação |
| `app/(app)/configuracoes.tsx` | A moldura: ordem das seções, busca, pergunta ao fechar |

---

### Task 1: Os papéis

**Files:**
- Create: `lib/papeis.ts`
- Test: `lib/papeis.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Papel = "administrador" | "analista" | "contador";
  export type Acao = "decidir" | "conciliar" | "gerir_equipe" | "mudar_regras" | "assinatura" | "exportar_tudo";
  export const PAPEIS: Papel[]; // na ordem administrador, analista, contador
  export function paraPapel(valor: unknown): Papel;
  export function pode(papel: Papel, acao: Acao): boolean;
  export const ROTULO_DO_PAPEL: Record<Papel, string>; // "Administrador" | "Analista" | "Contador"
  export const O_QUE_PERMITE: Record<Papel, string>;   // minúsculo, sem ponto final
  export const RECUSA_DO_PAPEL = "Seu papel não permite esta ação.";
  ```

- [ ] **Step 1: Escreva o teste que falha**

```ts
describe("pode", () => {
  it.each([
    ["administrador", [true, true, true, true, true, true]],
    ["analista", [true, true, false, false, false, false]],
    ["contador", [true, false, false, false, false, false]],
  ] as const)("segue a tabela da spec para %s", (papel, esperado) => {
    const acoes = ["decidir", "conciliar", "gerir_equipe", "mudar_regras", "assinatura", "exportar_tudo"] as const;
    expect(acoes.map((acao) => pode(papel, acao))).toEqual(esperado);
  });
});

describe("paraPapel", () => {
  it("lê o papel do /me, ignorando caixa e espaço", () => {
    expect(paraPapel("analista")).toBe("analista");
    expect(paraPapel(" Contador ")).toBe("contador");
  });
  it("trata como administrador o que não conhece: sem o campo, nada muda", () => {
    expect(paraPapel(undefined)).toBe("administrador");
    expect(paraPapel(null)).toBe("administrador");
    expect(paraPapel("dono")).toBe("administrador");
  });
});

it("descreve cada papel com a frase do convite", () => {
  expect(O_QUE_PERMITE).toEqual({
    administrador: "tudo, inclusive equipe, regras e assinatura",
    analista: "sobe extratos, concilia, confere e justifica",
    contador: "vê tudo, exporta, confere e justifica",
  });
});
```

- [ ] **Step 2: Rode o teste e veja falhar**

Run: `npx vitest run lib/papeis.test.ts`
Expected: FAIL. O módulo `./papeis` ainda não existe.

- [ ] **Step 3: Implemente `lib/papeis.ts`** com a interface acima. `pode` lê uma tabela `Record<Papel, Acao[]>`. Coloque um comentário que aponte para a tabela de papéis da spec.

- [ ] **Step 4: Rode o teste e veja passar**

Run: `npx vitest run lib/papeis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/papeis.ts lib/papeis.test.ts
git commit -m "feat: os três papéis e o que cada um pode"
```

---

### Task 2: Quem sou eu e o papel na sessão

**Files:**
- Modify: `app/(auth)/acoes.ts`. O `razaoSocialDaEmpresa` sai e entra o `quemSouEu`.
- Create: `app/(app)/papel.tsx`
- Modify:
  - `app/(app)/layout.tsx`
  - `app/(app)/shell.tsx`
  - `app/(app)/menu-lateral.tsx`, que esconde o "Nova conciliação" (linha ~181) e recebe `eu` no lugar de `empresa`
- Test:
  - `app/(auth)/acoes.test.ts`: troca o bloco `razaoSocialDaEmpresa` (~371) por um bloco do `quemSouEu`.
  - `app/(app)/papel.test.tsx`
  - `app/(app)/shell.test.tsx`
  - `app/(app)/menu-lateral.test.tsx`
  - `app/(app)/layout.test.tsx`

**Interfaces:**
- Consumes: `Papel` e `paraPapel` (Task 1).
- Produces:
  ```ts
  // app/(auth)/acoes.ts
  export type MetodoLogin = "senha" | "google";
  export type Eu = { razaoSocial: string; cnpj: string; papel: Papel; metodosLogin: MetodoLogin[] };
  export async function quemSouEu(): Promise<Eu>;
  // app/(app)/papel.tsx ("use client")
  export const PapelDaSessao: React.Context<Papel>; // padrão "administrador"
  export function usePapel(): Papel;
  export function SoQuemPode({ acao, children }: { acao: Acao; children: ReactNode }): ReactNode;
  // Shell e MenuLateral
  Shell({ email, eu, children }: { email: string; eu: Eu; children: ReactNode })
  MenuLateral({ email, eu, onSair }: { email: string; eu: Eu; onSair: () => void })
  ```

- [ ] **Step 1: Escreva os testes que falham**

```ts
// acoes.test.ts
describe("quemSouEu", () => {
  beforeEach(() => cookiesExistentes.set("authjs.session-token", "jwt-da-sessao"));

  it("lê empresa, CNPJ, papel e métodos de entrada de GET /me", async () => {
    fetch.mockResolvedValue(Response.json({
      id: "u", empresa_id: "e", nome: "Ana", email: "a@b.com",
      razao_social: "Telha Certa Ltda", cnpj: "12345678000190", papel: "contador", metodos_login: ["senha", "google", "sms"],
    }));
    expect(await quemSouEu()).toEqual({
      razaoSocial: "Telha Certa Ltda", cnpj: "12345678000190", papel: "contador", metodosLogin: ["senha", "google"],
    });
  });

  it("sem a rota, nada muda: administrador, entrando por e-mail e senha", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "Not Found" }, { status: 404 }));
    expect(await quemSouEu()).toEqual({ razaoSocial: "", cnpj: "", papel: "administrador", metodosLogin: ["senha"] });
  });
});
```

```tsx
// papel.test.tsx
it("mostra o que o papel pode e esconde o que não pode", () => {
  render(
    <PapelDaSessao value="contador">
      <SoQuemPode acao="decidir"><span>conferir</span></SoQuemPode>
      <SoQuemPode acao="conciliar"><span>nova conciliação</span></SoQuemPode>
    </PapelDaSessao>,
  );
  expect(screen.getByText("conferir")).toBeInTheDocument();
  expect(screen.queryByText("nova conciliação")).not.toBeInTheDocument();
});
it("sem provedor, é administrador", () => {
  render(<SoQuemPode acao="gerir_equipe"><span>equipe</span></SoQuemPode>);
  expect(screen.getByText("equipe")).toBeInTheDocument();
});
```

```tsx
// shell.test.tsx: troca empresa="Telha Certa Ltda" por eu={EU}, com EU = { razaoSocial: "Telha Certa Ltda", cnpj: "", papel: "administrador", metodosLogin: ["senha"] }
it("tira o Nova conciliação do menu do contador", () => {
  render(<Shell email={EMAIL} eu={{ ...EU, papel: "contador" }}>x</Shell>);
  expect(screen.queryByRole("link", { name: /Nova conciliação/ })).not.toBeInTheDocument();
});
```

No `layout.test.tsx`, faça o mock de `../(auth)/acoes` devolver o `quemSouEu`. Passe `eu` para o mock do `Shell`, com um teste que confere `data-papel`.

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run "app/(auth)/acoes.test.ts" "app/(app)/papel.test.tsx" "app/(app)/shell.test.tsx" "app/(app)/layout.test.tsx" "app/(app)/menu-lateral.test.tsx"`
Expected: FAIL, porque o `quemSouEu` e o `papel.tsx` ainda não existem.

- [ ] **Step 3: Implemente.**
  - `quemSouEu` usa `chamarBackend("/me")`. Qualquer falha devolve o padrão do teste.
  - `metodos_login` passa por um filtro para `"senha"` e `"google"`. Se a lista ficar vazia, vira `["senha"]`.
  - O `Shell` envolve tudo em `EmpresaDaSessao value={eu.razaoSocial}` e em `PapelDaSessao value={eu.papel}`.
  - No `MenuLateral`, o link "Nova conciliação" fica dentro de `<SoQuemPode acao="conciliar">`.
  - Remova o `razaoSocialDaEmpresa` e o teste dele.

- [ ] **Step 4: Rode e veja passar**

Run: o mesmo comando do Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/acoes.ts" "app/(auth)/acoes.test.ts" "app/(app)/papel.tsx" "app/(app)/papel.test.tsx" "app/(app)/layout.tsx" "app/(app)/layout.test.tsx" "app/(app)/shell.tsx" "app/(app)/shell.test.tsx" "app/(app)/menu-lateral.tsx" "app/(app)/menu-lateral.test.tsx"
git commit -m "feat: o papel vem do /me e entra no contexto da sessão"
```

---

### Task 3: O que cada papel vê fora da janela

**Files:**
- Modify:
  - Os links para `/conciliacoes/nova`, em `<SoQuemPode acao="conciliar">`:
    - `app/(app)/dashboard/page.tsx` (~107)
    - `app/(app)/extratos/page.tsx` (~55)
    - `app/(app)/fechamentos/page.tsx` (~81)
    - `app/(app)/fechamentos/mesa.tsx` (~363)
    - `app/(app)/historico/page.tsx` (~87)
    - `app/(app)/visao-geral/page.tsx` (~452)
    - `app/(app)/assistente/painel.tsx` (~74)
    - o botão do `Fechamento` em `app/(app)/conciliacoes/[id]/page.tsx` (~1000)
  - `app/(app)/conciliacoes/[id]/page.tsx` (~317): o `NovaVersao` também entra em `SoQuemPode acao="conciliar"`.
  - `app/(app)/conciliacoes/[id]/nova-versao.tsx` (~69): o 403 chama `router.refresh()`.
  - `app/(app)/conciliacoes/nova/page.tsx`: tela de recusa para o contador.
  - `app/(app)/assinatura/cancelar-assinatura.tsx`: botão em `SoQuemPode acao="assinatura"`.
  - `app/(app)/conciliacoes/acoes.ts` (~57, `traduzir`): o 403 vira `RECUSA_DO_PAPEL`.
- Test: os `page.test.tsx` de dashboard, visão geral e nova; `nova-versao.test.tsx`; `assinatura/page.test.tsx`; `conciliacoes/acoes.test.ts`.

**Interfaces:**
- Consumes: `SoQuemPode`, `PapelDaSessao` (Task 2); `RECUSA_DO_PAPEL` (Task 1).

- [ ] **Step 1: Escreva os testes que falham.** Nos testes de tela, renderize dentro de `<PapelDaSessao value="contador">`.

```tsx
// dashboard/page.test.tsx
it("doesn't offer the first upload to the accountant", async () => {
  com({ conciliacoes: [], emAndamento: null });
  render(<PapelDaSessao value="contador">{await DashboardPage()}</PapelDaSessao>);
  expect(screen.queryByRole("link", { name: "Fazer o primeiro upload" })).not.toBeInTheDocument();
});
// visao-geral/page.test.tsx: o mesmo, no estado sem conciliação
// nova/page.test.tsx
it("says the accountant's role can't upload, and leads back", () => {
  render(<PapelDaSessao value="contador"><NovaConciliacaoPage /></PapelDaSessao>);
  expect(screen.getByText("Seu papel não permite subir extratos. Peça a um administrador ou a um analista.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Voltar às conciliações" })).toHaveAttribute("href", "/dashboard");
  expect(screen.queryByLabelText(/Extrato do banco/)).not.toBeInTheDocument();
});
// nova-versao.test.tsx
it("re-reads the session when the backend refuses the role", async () => { /* enviarExtrato → { ok: false, status: 403, erro: "Seu papel não permite esta ação." } */
  // espera: o texto na tela e refresh chamado uma vez
});
// assinatura/page.test.tsx
it("hides the cancel button from who isn't an administrator", /* analista → sem "Cancelar assinatura" */);
// conciliacoes/acoes.test.ts
it("says the role can't when the backend answers 403", async () => {
  fetch.mockResolvedValue(Response.json({ detail: "Forbidden" }, { status: 403 }));
  expect(await enviarExtrato(new FormData())).toEqual({ ok: false, status: 403, erro: "Seu papel não permite esta ação." });
});
```

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run "app/(app)/dashboard" "app/(app)/visao-geral" "app/(app)/conciliacoes" "app/(app)/assinatura"`
Expected: FAIL nos testes novos. Os antigos continuam passando.

- [ ] **Step 3: Implemente os embrulhos listados em Files.**
  - A recusa da página `/conciliacoes/nova` usa `usePapel()` no começo do componente. Ela troca o conteúdo pelo parágrafo e pelo link, com as classes do estado vazio de hoje.

- [ ] **Step 4: Rode e veja passar.** Rode o mesmo comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A "app/(app)"
git commit -m "feat: o contador não vê subir extrato nem nova versão; 403 diz que o papel não permite"
```

---

### Task 4: A janela reorganizada, com Conta e Segurança

**Files:**
- Create:
  - `app/(app)/_configuracoes/comum.tsx`, que recebe o que sai de `configuracoes.tsx` (linhas 36–44, 52–78, 80–229 e 605–619) e o `normalizar` (~232).
  - `app/(app)/_configuracoes/seguranca.tsx`
- Modify:
  - `app/(app)/configuracoes.tsx`
  - `app/(app)/menu-lateral.tsx`, que passa `eu` à `Configuracoes`
  - `app/(auth)/acoes.ts`, com o `encerrarSessoes` novo
- Test: `app/(app)/configuracoes.test.tsx`, `app/(auth)/acoes.test.ts`

**Interfaces:**
- Consumes: `Eu` (Task 2); `ROTULO_DO_PAPEL` e `O_QUE_PERMITE` (Task 1); `formatarCnpj`, de `app/(auth)/cadastro/passos.ts`.
- Produces:
  ```ts
  // comum.tsx
  export type Linha = { titulo: string; descricao?: string; controle?: ReactNode };
  export type Secao = {
    id: string; nome: string; icone: LucideIcon; grupo: "Configurações" | "Ledgr";
    linhas: Linha[];
    /** O que não é linha de ajuste (listas, formulários), depois das linhas. */
    corpo?: ReactNode;
    /** Palavras que levam a busca ao `corpo`. */
    busca?: string;
  };
  export function Linhas(props: { linhas: Linha[] }): JSX.Element;
  export function Segmentado<T extends string>(props): JSX.Element;
  export function AcaoDaConta(props): JSX.Element; // a mesma de hoje
  export const SENHA_ATUAL: CampoDaConta;
  export function validarSenhaNova(valores: Record<string, string>): string | null;
  export function Tecla(props: { children: ReactNode }): JSX.Element;
  export function normalizar(texto: string): string;
  // configuracoes.tsx: nova prop
  Configuracoes({ aberta, onFechar, email, eu, onSair, onTema })
  // acoes.ts
  export async function encerrarSessoes(): Promise<ResultadoConta>; // POST /me/sessoes/encerrar, depois signOut({ redirectTo: "/login" })
  ```

- [ ] **Step 1: Escreva os testes que falham.** Ajuste antes os testes que já existem. O "Trocar senha" agora fica em `secao("Segurança")`. O `abrir()` passa a receber `eu={EU}`. O `vi.mock("../(auth)/acoes")` ganha o `encerrarSessoes`.

```tsx
it("orders the sections like the spec", () => {
  abrir();
  expect(within(screen.getByRole("navigation", { name: "Configurações" })).getAllByRole("button").map((b) => b.textContent))
    .toEqual(["Conta", "Aparência", "Conciliação", "Segurança", "Atalhos de teclado", "Privacidade"]);
  // Equipe entra na Task 6; Privacidade vira Dados e privacidade na Task 5
});

it("shows who you are in Conta: e-mail, empresa with CNPJ, and your role", async () => {
  const user = userEvent.setup();
  abrir({ eu: { ...EU, razaoSocial: "Telha Certa Ltda", cnpj: "12345678000190", papel: "analista" } });
  await user.click(secao("Conta"));
  expect(within(linhaDe("Empresa")).getByText("Telha Certa Ltda · CNPJ 12.345.678/0001-90")).toBeInTheDocument();
  expect(within(linhaDe("Seu papel")).getByText("Analista")).toBeInTheDocument();
  expect(within(linhaDe("Seu papel")).getByText("Sobe extratos, concilia, confere e justifica.")).toBeInTheDocument();
  expect(screen.queryByText("Senha", { selector: ".cfg-linha-titulo" })).not.toBeInTheDocument();
});

it("lists how you sign in, from /me", async () => {
  const user = userEvent.setup();
  abrir({ eu: { ...EU, metodosLogin: ["senha", "google"] } });
  await user.click(secao("Segurança"));
  expect(within(linhaDe("Como você entra")).getByText("E-mail e senha · Google")).toBeInTheDocument();
});

it("signs out of every device only after confirming", async () => {
  const user = userEvent.setup();
  abrir();
  await user.click(secao("Segurança"));
  await user.click(screen.getByRole("button", { name: "Sair de todos os aparelhos" }));
  expect(screen.getByText("Você sai em todos os aparelhos, inclusive neste.")).toBeInTheDocument();
  expect(encerrarSessoes).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sair de todos" }));
  expect(encerrarSessoes).toHaveBeenCalledTimes(1);
});

it("says it isn't available yet when the backend has no route", async () => {
  encerrarSessoes.mockResolvedValue({ ok: false, erro: "Ainda não disponível: o servidor do Ledgr ainda não tem esta função." });
  // confirme como acima; espera role="alert" com o texto
});
```

```ts
// acoes.test.ts
describe("encerrarSessoes", () => {
  it("pede ao backend para encerrar tudo e sai daqui também", async () => { /* fetch 204 → signOut chamado com { redirectTo: "/login" } */ });
  it("diz que ainda não existe quando a rota não subiu", async () => { /* 404 → { ok: false, erro: "Ainda não disponível…" } */ });
});
```

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run "app/(app)/configuracoes.test.tsx" "app/(auth)/acoes.test.ts"`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implemente.**
  - **Mudança de lugar:** mova o código para o `comum.tsx` sem mudar o comportamento.
  - **Conta:** tem "E-mail" (como hoje), "Empresa" e "Seu papel" (rótulo no controle, frase com a primeira letra maiúscula e ponto na descrição), "Sair desta conta" e, por enquanto, "Excluir conta".
    - "Empresa" mostra `razão social · CNPJ formatado`, só a parte que existir, e some quando as duas estão vazias.
  - **Segurança:** tem "Senha" (o `AcaoDaConta` de hoje), "Como você entra" e "Sessão".
    - "Como você entra" vira "E-mail e senha" e/ou "Google", separados por " · ".
    - "Sessão" mantém a descrição de hoje e ganha o controle `<SairDeTodos />`. Ao abrir, ele mostra o texto da confirmação e os botões "Sair de todos" e "Cancelar". Erro aparece com `MensagemErro`.
  - **Ordem das seções:** Conta, Aparência, Conciliação, Segurança, Atalhos de teclado e Privacidade no grupo "Configurações"; Sobre no grupo "Ledgr".
  - **Busca:** uma seção com `corpo` aparece inteira quando o termo está em `nome` ou em `busca`.

- [ ] **Step 4: Rode e veja passar.** Rode o comando do Step 2 e depois `npm run test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/_configuracoes" "app/(app)/configuracoes.tsx" "app/(app)/configuracoes.test.tsx" "app/(app)/menu-lateral.tsx" "app/(auth)/acoes.ts" "app/(auth)/acoes.test.ts" app/globals.css
git commit -m "feat: Configurações com Conta de quem você é e Segurança com sair de todos os aparelhos"
```

---

### Task 5: Dados e privacidade

**Files:**
- Create:
  - `app/api/empresa/exportacao/route.ts`
  - `app/api/empresa/exportacao/route.test.ts`
  - `app/(app)/_configuracoes/exportar-tudo.tsx`
  - `app/(app)/_configuracoes/exportar-tudo.test.tsx`
- Modify:
  - `app/(app)/configuracoes.tsx`: a seção "privacidade" vira "dados"; o "Excluir conta" sai da Conta.
  - `app/(auth)/acoes.ts`: no `excluirConta`, o 409 vira a frase fixa.
- Test: `app/(app)/configuracoes.test.tsx`, `app/(auth)/acoes.test.ts`

**Interfaces:**
- Consumes: `pode(papel, "exportar_tudo")` (Task 1); `baixarDoBackend` e `ErroBackend` (`lib/backend.ts`); `salvar` (`app/(app)/conciliacoes/[id]/exportar-csv.tsx`).
- Produces:
  ```ts
  // route.ts
  export async function GET(): Promise<Response>;
  // exportar-tudo.tsx
  export function nomeDaExportacao(cnpj: string, agora: Date): string; // "ledgr-12345678000190-2026-10-03.zip"; sem CNPJ, "ledgr-dados-2026-10-03.zip"
  export function ExportarTudo({ cnpj }: { cnpj: string }): JSX.Element;
  ```

- [ ] **Step 1: Escreva os testes que falham.** Copie o padrão de `app/api/conciliacoes/[id]/exportar/route.test.ts`.

```ts
// route.test.ts
it("passes the zip through untouched, with its name", /* backend 200 application/zip + Content-Disposition → mesmos bytes e cabeçalhos, Cache-Control no-store */);
it.each([
  [401, 401, "Sua sessão expirou. Entre de novo para continuar."],
  [403, 403, "Seu papel não permite esta ação."],
  [404, 404, "Ainda não disponível: o servidor do Ledgr ainda não tem esta função."],
  [405, 404, "Ainda não disponível: o servidor do Ledgr ainda não tem esta função."],
  [500, 502, "Não foi possível gerar o arquivo agora. Tente de novo em instantes."],
])("backend %i → %i com { erro }", /* ... */);
```

```ts
// exportar-tudo.test.tsx
it("names the file by CNPJ digits and the day in Brasília", () => {
  // 03/10 às 01h em UTC ainda é 02/10 em Brasília
  expect(nomeDaExportacao("12.345.678/0001-90", new Date("2026-10-03T01:00:00Z"))).toBe("ledgr-12345678000190-2026-10-02.zip");
  expect(nomeDaExportacao("", new Date("2026-10-03T15:00:00Z"))).toBe("ledgr-dados-2026-10-03.zip");
});
it("says it is preparing, then saves; shows the server's reason when it fails", /* fetch mock; botão "Exportar todos os dados" → "Preparando o arquivo…" → salvar chamado; 404 → alert com o erro */);
```

```tsx
// configuracoes.test.tsx
it("lets only the administrator export everything", async () => {
  // eu.papel "analista" → secao("Dados e privacidade") → linhaDe("Exportar todos os dados") tem "Peça a um administrador." e nenhum botão
});
it("explains account deletion by role, at the end of Dados e privacidade", async () => {
  // analista → linhaDe("Excluir conta") contém "Apaga só o seu acesso. Os dados da empresa continuam."
  // administrador → contém "Se você for o único administrador, apaga também os dados da empresa: extratos, conciliações e histórico."
  // o link "Pedir por e-mail" continua com o mailto de hoje
  // a última linha da seção é "Excluir conta"; a Conta não tem mais "Excluir conta"
});
it("links the privacy policy", /* link "Política de privacidade" → /privacidade */);
// e o teste de ordem da Task 4 troca "Privacidade" por "Dados e privacidade"
```

```ts
// acoes.test.ts
it("asks to hand over the administration when the backend refuses with 409", async () => {
  fetch.mockResolvedValue(Response.json({ detail: "Único administrador." }, { status: 409 }));
  expect(await excluirConta("s3nha")).toEqual({ ok: false, erro: "Passe a administração para outra pessoa na Equipe antes de sair." });
});
```

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run app/api/empresa "app/(app)/_configuracoes" "app/(app)/configuracoes.test.tsx" "app/(auth)/acoes.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implemente.**
  - **A rota:** chama `baixarDoBackend("/empresa/exportacao")` e repassa `Content-Type`, `Content-Disposition` e `Cache-Control`. A data do nome usa `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`.
  - **A seção "Dados e privacidade"** (id `dados`, ícone `ShieldCheck`, grupo "Configurações", logo depois de "Atalhos de teclado") tem, nesta ordem:
    1. "Exportar todos os dados"
    2. "Sessão protegida" e "Explicações por IA", com os textos de hoje
    3. "Política de privacidade", com um link que fecha a janela
    4. "Excluir conta", com o texto conforme o papel e, depois dele, a frase de hoje sobre o pedido por e-mail
  - **No `excluirConta`:** trate o 409 antes do `mensagemDaConta`.
  - **Os `ponytail:` de hoje** sobre `DELETE /me` vão junto com a linha.
  - **Um `ponytail:` novo** na exportação e no "Excluir conta": quando cada rota existir, o trecho "Por enquanto, os pedidos são feitos por e-mail" da `/privacidade` muda junto (spec, Dados e privacidade, item 4).

- [ ] **Step 4: Rode e veja passar.** Rode o comando do Step 2 e depois `npm run test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/empresa "app/(app)/_configuracoes" "app/(app)/configuracoes.tsx" "app/(app)/configuracoes.test.tsx" "app/(auth)/acoes.ts" "app/(auth)/acoes.test.ts" app/globals.css
git commit -m "feat: Dados e privacidade com exportar tudo e excluir conta pelo papel"
```

---

### Task 6: Equipe

**Files:**
- Modify: `lib/demo.ts` e `app/(auth)/acoes.ts`. O `naConta` passa a usar `ehContaDeDemonstracao`.
- Create:
  - `app/(app)/_configuracoes/acoes.ts`
  - `app/(app)/_configuracoes/acoes.test.ts`
  - `app/(app)/_configuracoes/equipe.tsx`
  - `app/(app)/_configuracoes/equipe.test.tsx`
- Modify: `app/(app)/configuracoes.tsx`, para a seção "equipe" (ícone `UsersRound`) entrar logo depois de Conta.
- Test: os novos, mais `lib/demo.test.ts`, criado se ainda não existir.

**Interfaces:**
- Consumes: `Resultado` e `Falha` (tipos de `app/(app)/conciliacoes/acoes.ts`); `Papel`, `paraPapel`, `pode`, `ROTULO_DO_PAPEL`, `O_QUE_PERMITE` e `RECUSA_DO_PAPEL` (Task 1); `EMAIL_VALIDO` e `MENSAGEM_EMAIL_INCOMPLETO` (`app/(auth)/_compartilhado/validacao.ts`); `pareceUuid` (`lib/adaptadores.ts`).
- Produces:
  ```ts
  // lib/demo.ts
  export function ehContaDeDemonstracao(email: string): boolean; // compara com LEDGR_CONTA_TESTE_EMAIL, sem caixa nem espaço
  // _configuracoes/acoes.ts ("use server")
  export type Pessoa = { id: string; nome: string; email: string; papel: Papel };
  export type Convite = { id: string; email: string; papel: Papel; criadoEm: string; expiraEm: string };
  export type Equipe = { pessoas: Pessoa[]; convites: Convite[] };
  export async function carregarEquipe(): Promise<Resultado<Equipe>>;            // GET /empresa/usuarios
  export async function convidar(email: string, papel: Papel): Promise<Resultado<Convite>>; // POST /empresa/convites
  export async function cancelarConvite(id: string): Promise<Resultado<null>>;    // DELETE /empresa/convites/{id}
  export async function mudarPapel(id: string, papel: Papel): Promise<Resultado<Pessoa>>; // PATCH /empresa/usuarios/{id}
  export async function removerPessoa(id: string): Promise<Resultado<null>>;      // DELETE /empresa/usuarios/{id}
  // _configuracoes/equipe.tsx
  export function SecaoEquipe({ emailDaSessao, razaoSocial }: { emailDaSessao: string; razaoSocial: string }): JSX.Element;
  ```
  Regras das actions:
  - **Id que não parece UUID:** a action devolve `{ ok: false, status: 404, erro: "Pessoa não encontrada." }` sem chamar o backend.
  - **Escrita pela conta de demonstração:** devolve `{ ok: false, status: 400, erro: "A conta de demonstração não pode ser alterada." }`.
  - **Erros do backend:** 401 vira o mesmo texto do `traduzir`, 403 vira `RECUSA_DO_PAPEL`, e 409 e 422 trazem o `detail`.
  - **No `mudarPapel` e no `removerPessoa`:** o 409 vira "A empresa precisa de pelo menos um administrador."
  - **429:** vira "Muitas tentativas. Espere um minuto e tente de novo."
  - **Rede caída ou 5xx numa escrita:** vira "Não foi possível salvar agora. Tente de novo em instantes."

- [ ] **Step 1: Escreva os testes que falham**

```ts
// _configuracoes/acoes.test.ts (mesmo esqueleto de mocks de app/(auth)/acoes.test.ts)
it("adapts the team from GET /empresa/usuarios", /* usuarios + convites com criado_em/expira_em → Equipe */);
it("invites with e-mail and role", /* POST /empresa/convites corpo { email: "joao@empresa.com.br", papel: "analista" } — e-mail em minúsculas e sem espaço */);
it("passes the backend's 409 on invite as it comes", /* detail "Esse e-mail já tem acesso à empresa." */);
it("says the company needs an administrator on the 409 of role change and removal");
it("refuses writes from the demo account without calling the backend");
it("doesn't put an id that isn't a UUID in the backend path");
```

```tsx
// equipe.test.tsx — actions simuladas
it("marks your own line, case aside, with no role selector and no remove", async () => {
  // emailDaSessao "Ana@TelhaCerta.com.br"; pessoa email "ana@telhacerta.com.br" → a linha tem "você", sem combobox e sem botão "Remover"
});
it("changes another person's role on the spot, and puts it back if the backend refuses", async () => {
  // combobox "Papel de Marina Costa" → "contador"; mudarPapel chamado com (id, "contador")
  // segundo caso: { ok:false, status:409, erro:"A empresa precisa de pelo menos um administrador." } → valor volta, role="alert" com o texto
});
it("removes only after confirming in the line", async () => {
  // "Remover" → texto "Remover Marina Costa? Ela perde o acesso em até 7 dias." → botão "Remover" da confirmação → removerPessoa(id); a linha some
});
it("invites with a role and says the link lasts 7 days", async () => {
  // formulário "Convidar pessoa": e-mail inválido → MENSAGEM_EMAIL_INCOMPLETO, sem chamar convidar
  // "joao@empresa.com.br" + radio "Contador" → convidar("joao@empresa.com.br","contador"); status "Convite enviado para joao@empresa.com.br. O link vale por 7 dias."; o convite aparece em "Convites pendentes"
  // cada radio mostra a frase de O_QUE_PERMITE
});
it("cancels a pending invite", /* botão "Cancelar o convite de joao@empresa.com.br" → cancelarConvite(id); some da lista */);
it("shows the lists without controls to whoever isn't an administrator", /* PapelDaSessao "analista": sem combobox, sem "Remover", sem formulário; texto "Só administradores convidam e mudam papéis." */);
it("explains what the section will do when the backend has no route", /* carregarEquipe → { ok:false, status:404 } → "Aqui você vai convidar a sua equipe e o seu contador, cada um com o próprio acesso. Ainda não está disponível." e nenhum botão */);
it("offers to try again when loading fails", /* status 500 → "Não foi possível carregar agora." + botão "Tentar de novo" chama carregarEquipe de novo */);
it("re-reads the session when the backend says the role can't", /* qualquer ação → status 403 → router.refresh() chamado */);
```

```tsx
// configuracoes.test.tsx
it("finds the team by searching for a word of it", /* busca "convite" → heading "Equipe" */);
// e o teste de ordem da Task 4 passa à ordem final:
// ["Conta", "Equipe", "Aparência", "Conciliação", "Segurança", "Atalhos de teclado", "Dados e privacidade"]
```

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run "app/(app)/_configuracoes" lib/demo.test.ts "app/(app)/configuracoes.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implemente.**
  - **Carga:** `SecaoEquipe` carrega na montagem, com os estados `carregando | ausente | falhou | pronta`. 404 e 405 contam como ausente.
  - **Datas dos convites:** "enviado em dd/mm, vale até dd/mm", no fuso de São Paulo.
  - **Abertura:** "Quem tem acesso à {razaoSocial || "sua empresa"}. Cada pessoa entra com o próprio e-mail e senha."
  - **Na janela:** a seção tem `linhas: []`, `corpo: <SecaoEquipe … />` e `busca: "pessoas convite convidar papel administrador analista contador remover"`.
  - **Comentário `ponytail:`:** cite a #69 e a #75 (sobre o "em até 7 dias").

- [ ] **Step 4: Rode e veja passar.** Rode o comando do Step 2 e depois `npm run test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/demo.ts lib/demo.test.ts "app/(auth)/acoes.ts" "app/(app)/_configuracoes" "app/(app)/configuracoes.tsx" "app/(app)/configuracoes.test.tsx" app/globals.css
git commit -m "feat: a seção Equipe, com convites, papéis e remoção"
```

---

### Task 7: A página `/convite`

**Files:**
- Modify: `app/(auth)/acoes.ts`
- Create: `app/(auth)/convite/page.tsx`, `app/(auth)/convite/page.test.tsx`
- Test: `app/(auth)/acoes.test.ts`

**Interfaces:**
- Consumes: `Papel`, `paraPapel` e `ROTULO_DO_PAPEL` (Task 1); `entrar`; `CampoTexto`, `MensagemErro` e `MolduraAuth` (`app/(auth)/_compartilhado`).
- Produces:
  ```ts
  export type ConviteConsultado = { razaoSocial: string; email: string; papel: Papel };
  export async function consultarConvite(token: string):
    Promise<{ ok: true; convite: ConviteConsultado } | { ok: false; erro: "invalido" | "muitas_tentativas" | "falha" }>;
  // POST /convites/consultar { token }, publica. 400, 404, 410 e 422 viram "invalido".
  export async function aceitarConvite(token: string, email: string, nome: string, senha: string):
    Promise<{ ok: true; entrou: boolean } | { ok: false; erro: "invalido" | "senha_invalida" | "muitas_tentativas" | "falha" }>;
  // POST /convites/aceitar { token, nome, senha }, publica. Depois, entrar(email, senha, true), como o cadastro.
  ```

- [ ] **Step 1: Escreva os testes que falham**

```ts
// acoes.test.ts
it("consulta o convite sem Bearer e com o token no corpo", /* fetch: URL .../convites/consultar, sem Authorization, corpo { token } */);
it.each([400, 404, 410, 422])("convite %i é inválido", /* → { ok:false, erro:"invalido" } */);
it("aceita e já entra, como o cadastro", /* 201 → signIn com email/senha → { ok:true, entrou:true } */);
it("422 da senha é senha_invalida", /* campos ["senha"] */);
```

```tsx
// convite/page.test.tsx: o mesmo esqueleto de redefinir-senha/page.test.tsx
it("says the link is incomplete and calls nothing without a token", /* hash vazio → "Este link está incompleto." e consultarConvite não chamado */);
it("reads the token once and clears it from the address bar", /* hash "#token=abc" → replaceState chamado; o efeito rodando 2× (StrictMode) chama consultarConvite uma vez só */);
it("says an expired or used invite before asking anything", /* consultar → invalido → "Este convite expirou ou já foi usado. Peça um novo a quem convidou." e nenhum campo */);
it("shows where the person is joining, and the invited e-mail without editing", /* "Você foi convidado para a Telha Certa Ltda como Analista." e "joao@empresa.com.br" fora de input */);
it("checks name and password like the signup, then joins and goes into the app", /* nome vazio → "Diga o seu nome."; senha curta → "A senha precisa ter pelo menos 8 caracteres."; confirmação diferente → "A confirmação não bate com a senha."; ok → aceitarConvite("abc","joao@…","João","s3nha-boa"), router.push("/visao-geral") */);
it("goes to the login when the account was created but the session didn't open", /* entrou:false → router.push("/login") */);
```

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run "app/(auth)/acoes.test.ts" "app/(auth)/convite"`
Expected: FAIL.

- [ ] **Step 3: Implemente a página,** com as etapas `lendo | sem_token | consultando | invalido | formulario | enviando`.
  - Siga a `redefinir-senha/page.tsx`: `tokenLido` em `useRef`, `history.replaceState` e as mesmas regras de senha.
  - Botão: "Criar acesso e entrar". Rótulo da moldura: "Convite".
  - Sem token: título "Este link está incompleto.", texto "Abra o link direto do e-mail, sem cortar nenhuma parte." e link "Ir para o login".
  - Rode `npm run build` e confira `/convite` na tabela de rotas impressa.

- [ ] **Step 4: Rode e veja passar.** Rode o comando do Step 2 e depois `npm run build`. Expected: PASS, com `/convite` listada.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/acoes.ts" "app/(auth)/acoes.test.ts" "app/(auth)/convite"
git commit -m "feat: página /convite para quem recebe o convite criar o acesso"
```

---

### Task 8: As regras do motor na janela

**Files:**
- Create:
  - `lib/regras.ts`
  - `lib/regras.test.ts`
  - `app/(app)/_configuracoes/regras.tsx`
  - `app/(app)/_configuracoes/regras.test.tsx`
- Modify:
  - `app/(app)/_configuracoes/acoes.ts` (e o teste dele)
  - `app/(app)/configuracoes.tsx`: a seção "conciliacao" passa a usar `useRegras`; a pergunta ao fechar entra no `onCancel`, no botão de fechar e no clique no fundo.
- Test: os novos, mais `app/(app)/configuracoes.test.tsx`

**Interfaces:**
- Consumes: `pode(papel, "mudar_regras")` (Task 1); `Resultado` e `Falha`; `ehContaDeDemonstracao` (Task 6); `toleranciaDaUltimaConciliacao` (`app/(app)/conciliacoes/acoes.ts`).
- Produces:
  ```ts
  // lib/regras.ts
  export type Regras = { toleranciaDias: number; toleranciaValor: number; similaridadeMinima: number; atualizadoPor: string | null; atualizadoEm: string | null };
  export type RegrasAPI = { tolerancia_dias: number; tolerancia_valor: string | number; similaridade_minima: string | number; atualizado_por?: string | null; atualizado_em?: string | null };
  export type CampoDeRegra = "toleranciaDias" | "toleranciaValor" | "similaridadeMinima";
  export type Rascunho = Record<CampoDeRegra, string>;            // o que está digitado
  export function adaptarRegras(api: RegrasAPI): Regras;
  export function lerReais(texto: string): number | null;
  export function rascunhoDe(regras: Regras): Rascunho;           // { "2", "0,05", "80" }
  export function validarRascunho(r: Rascunho): Partial<Record<CampoDeRegra, string>>;
  export function alteracoes(salvas: Regras, r: Rascunho): number;
  // _configuracoes/acoes.ts
  export type ResultadoRegras = { ok: true; dados: Regras } | (Falha & { campos?: CampoDeRegra[] });
  export async function carregarRegras(): Promise<Resultado<Regras>>; // GET /empresa/configuracoes
  export async function salvarRegras(regras: Pick<Regras, CampoDeRegra>): Promise<ResultadoRegras>;
  // PUT /empresa/configuracoes { tolerancia_dias, tolerancia_valor: "0.05", similaridade_minima }
  // _configuracoes/regras.tsx
  export function useRegras(aberta: boolean): EstadoDasRegras; // { estado, rascunho, setCampo, descartar, salvar, pendentes, erros, aviso }
  export function SecaoRegras(props: { regras: EstadoDasRegras }): JSX.Element;
  ```

- [ ] **Step 1: Escreva os testes que falham**

```ts
// lib/regras.test.ts
it.each([
  ["0,05", 0.05], ["1.000,50", 1000.5], ["0.05", 0.05], [" 0,1 ", 0.1], ["12", 12],
  ["abc", null], ["", null], ["1,2,3", null],
])("lerReais(%j) = %j", (texto, valor) => expect(lerReais(texto)).toBe(valor));

it("validates only the obvious; the backend decides the real limits", () => {
  expect(validarRascunho({ toleranciaDias: "-1", toleranciaValor: "0,05", similaridadeMinima: "80" }))
    .toEqual({ toleranciaDias: "Use um número de dias, a partir de 0." });
  expect(validarRascunho({ toleranciaDias: "2", toleranciaValor: "-0,01", similaridadeMinima: "101" }))
    .toEqual({ toleranciaValor: "Use um valor em reais, a partir de R$ 0,00.", similaridadeMinima: "Use uma porcentagem de 0 a 100." });
});
it("counts what changed against what is saved", () => {
  const salvas = adaptarRegras({ tolerancia_dias: 2, tolerancia_valor: "0.00", similaridade_minima: 80 });
  expect(alteracoes(salvas, { ...rascunhoDe(salvas), toleranciaDias: "3" })).toBe(1);
  expect(alteracoes(salvas, { ...rascunhoDe(salvas), toleranciaValor: "0" })).toBe(0); // "0" e "0,00" são o mesmo valor
});
```

```ts
// _configuracoes/acoes.test.ts
it("saves the rules with the value in reais as decimal text", /* PUT corpo { tolerancia_dias: 3, tolerancia_valor: "0.05", similaridade_minima: 80 } */);
it("brings the 422 fields back with the backend's reason", /* 422 com loc ["body","tolerancia_valor"] → campos ["toleranciaValor"] */);
it("refuses the demo account", /* sem chamar o backend */);
```

```tsx
// regras.test.tsx: SecaoRegras com um useRegras de verdade e as actions simuladas
it("edits, counts the pending change and saves with the confirmation", async () => {
  // carregarRegras → 2 dias, 0,00, 80, atualizadoPor "Marina Costa", atualizadoEm "2026-09-28T13:00:00Z"
  // o rodapé diz "Última mudança por Marina Costa em 28/09"
  // botão "+" de "Tolerância de data" → campo 3, rodapé "1 alteração não salva", "Salvar regras" habilitado
  // "Salvar regras" → salvarRegras({ toleranciaDias: 3, toleranciaValor: 0, similaridadeMinima: 80 }); status com o texto fixo de "Regras salvas…"
});
it("discards back to the saved values", /* digita, "Descartar" → valores salvos, "Salvar regras" desabilitado */);
it("shows the backend's 422 under the field", /* salvar → { ok:false, status:422, erro:"Até R$ 10,00.", campos:["toleranciaValor"] } → texto sob o campo "Tolerância de valor" */);
it("shows the values without controls to whoever isn't an administrator", /* analista → sem inputs; "Só administradores mudam as regras." */);
it("falls back to the last conciliation's date tolerance when the route doesn't exist", /* carregarRegras 404 → "2 dias" lido de toleranciaDaUltimaConciliacao + "Ajustar as regras chega quando o backend tiver a rota." e nenhum input */);
it("keeps the source of truth and the AI note", /* "Fonte da verdade" / "Extrato do banco" e "Explicações por IA" presentes nos dois estados */);
```

```tsx
// configuracoes.test.tsx
it("asks before closing with a pending change, from the X and from Esc", async () => {
  // altera a tolerância; clique em "Fechar configurações" → alertdialog "Descartar as mudanças nas regras?"; onFechar não chamado
  // "Continuar editando" → some a pergunta, o valor digitado continua
  // fireEvent(dialog, new Event("cancel", { cancelable: true })) → a pergunta volta e o evento foi cancelado (defaultPrevented)
  // "Descartar" → onFechar chamado
});
it("keeps the typed rules when switching sections", /* altera, vai a "Aparência", volta a "Conciliação" → o valor continua */);
```

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run lib/regras.test.ts "app/(app)/_configuracoes" "app/(app)/configuracoes.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implemente.**
  - **Onde fica o estado:** `useRegras` é chamado na `Configuracoes`, para o rascunho sobreviver à troca de seção. A seção recebe o estado pronto.
  - **Os três campos:**
    - Data: `input type="number"` com botões "−" e "+" (`aria-label` "Diminuir a tolerância de data" e "Aumentar a tolerância de data") e o sufixo "dias".
    - Valor: `input inputMode="decimal"` com o prefixo "R$".
    - Semelhança: `input type="number"` com o sufixo "%".
  - **Rótulos e descrições** exatamente como na spec, seção Conciliação, item 1.
  - **Rodapé:**
    - Contagem: "N alteração não salva" ou "N alterações não salvas".
    - Autoria, quando o backend mandar: "Última mudança por X em dd/mm".
    - Botões "Descartar" e "Salvar regras".
  - **A pergunta ao fechar** é um `div role="alertdialog"` dentro de `.cfg-conteudo`, com os botões "Descartar" e "Continuar editando".
  - **403 ao salvar:** mostra `RECUSA_DO_PAPEL` e chama `router.refresh()`, como a Equipe.
  - **Comentário `ponytail:`** no `carregarRegras`, citando a #22.

- [ ] **Step 4: Rode e veja passar.** Rode o comando do Step 2 e depois `npm run test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/regras.ts lib/regras.test.ts "app/(app)/_configuracoes" "app/(app)/configuracoes.tsx" "app/(app)/configuracoes.test.tsx" app/globals.css
git commit -m "feat: regras do motor editáveis pelo administrador, valendo para as próximas conciliações"
```

---

### Task 9: As regras em cada rodada (depende do PR #93)

**Files:**
- Modify:
  - `lib/adaptadores.ts` (~213–310): `tolerancia_valor?` e `similaridade_minima?` no `ExecucaoAPI`; `toleranciaValor?` e `similaridadeMinima?` (opcionais) no `Execucao`.
  - `lib/regras.ts`: `RegrasDaRodada`, `textoDasRegras` e `regrasMudaram`.
  - `app/(app)/conciliacoes/acoes.ts` (~171 e ~234): `RodadaVista.regras?`.
  - `app/(app)/conciliacoes/[id]/page.tsx` (~339): a faixa da rodada.
  - `app/(app)/historico/por-conciliacao.tsx`: as colunas do `csvDoHistorico`.
  - `app/(app)/conciliacoes/[id]/cartao-lancamento.tsx`: `toleranciaDaLinha` e a prop `tolerancia` do `ConteudoCartao`.
  - `app/(app)/dashboard/resumo.ts` (~15): o rótulo longo do `match_tolerancia`.
- Test:
  - `lib/regras.test.ts`
  - `lib/adaptadores.test.ts`
  - `app/(app)/conciliacoes/[id]/page.test.tsx`
  - `app/(app)/historico/por-conciliacao.test.ts`
  - `app/(app)/conciliacoes/[id]/cartao-lancamento.test.tsx`

**Interfaces:**
- Consumes: `Regras`, `lerReais` e `carregarRegras` (Task 8).
- Produces:
  ```ts
  export type RegrasDaRodada = { toleranciaDias: number; toleranciaValor?: number; similaridadeMinima?: number };
  export function textoDasRegras(r: RegrasDaRodada): string;
  // "Regras desta rodada: data até 2 dias · valor exato · descrição 80%"
  // 0 dias → "data no mesmo dia"; 1 → "data até 1 dia"; valor 0 → "valor exato"; 0,05 → "valor até R$ 0,05"
  // o campo que não veio fica de fora
  export function regrasMudaram(daRodada: RegrasDaRodada, atuais: Regras): boolean; // compara só os campos que a rodada tem
  export function toleranciaDaLinha(linha: LinhaComparacao): string | null;
  // só no match_tolerancia; "Data 05/09 no sistema, 04/09 no banco" e/ou "Valor R$ 0,03 diferente", juntos por " · "
  ```

- [ ] **Step 1: Escreva os testes que falham**

```ts
// lib/regras.test.ts
it("writes the rules of a round with what came", () => {
  expect(textoDasRegras({ toleranciaDias: 2, toleranciaValor: 0, similaridadeMinima: 80 })).toBe("Regras desta rodada: data até 2 dias · valor exato · descrição 80%");
  expect(textoDasRegras({ toleranciaDias: 0 })).toBe("Regras desta rodada: data no mesmo dia");
  expect(textoDasRegras({ toleranciaDias: 1, toleranciaValor: 0.05 })).toBe("Regras desta rodada: data até 1 dia · valor até R$ 0,05");
});
it("compares only the fields the round has", () => {
  const atuais = { toleranciaDias: 3, toleranciaValor: 0, similaridadeMinima: 80, atualizadoPor: null, atualizadoEm: null };
  expect(regrasMudaram({ toleranciaDias: 3 }, atuais)).toBe(false);
  expect(regrasMudaram({ toleranciaDias: 2 }, atuais)).toBe(true);
});
```

```tsx
// conciliacoes/[id]/page.test.tsx
it("says which rules the round ran with", /* rodada com regras { toleranciaDias: 2 } → "Regras desta rodada: data até 2 dias", inclusive numa conciliação de uma rodada só */);
it("warns on the latest round when the rules changed after it", /* carregarRegras → 3 dias; rodada 2 de 2 com 2 dias → "As regras mudaram depois desta rodada. Elas valem na próxima." */);
it("doesn't warn on an older round, nor when the rules route doesn't exist", /* rodada 1 de 2 → sem aviso; carregarRegras 404 → sem aviso */);
// historico/por-conciliacao.test.ts
it("adds the value tolerance and similarity columns only when the backend sends them", /* sem os campos → cabeçalho de hoje; com toleranciaValor 0.05 e similaridadeMinima 80 → "...;Tolerância (dias);Tolerância de valor;Semelhança;Situação" e células "0,05" e "80" */);
// cartao-lancamento.test.tsx
it("says which tolerance a tolerance match used", /* match_tolerancia, valorBanco -100, valorSistema -100.03, data "04/09", dataSistema "04/09" → dt "Dentro da tolerância" dd "Valor R$ 0,03 diferente" */);
it("names a date tolerance too", /* data "04/09", dataSistema "05/09", valores iguais → "Data 05/09 no sistema, 04/09 no banco" */);
// lib/adaptadores.test.ts
it("reads the round's value tolerance and similarity when they come", /* tolerancia_valor "0.05" → 0.05; ausentes → undefined */);
```

- [ ] **Step 2: Rode os testes e veja falhar**

Run: `npx vitest run lib/regras.test.ts lib/adaptadores.test.ts "app/(app)/conciliacoes" "app/(app)/historico"`
Expected: FAIL.

- [ ] **Step 3: Implemente.**
  - **Quando a faixa aparece:** sempre que houver `rodada`.
  - **Dentro da faixa:**
    - A linha das regras fica em `<p className="rodada-regras">`.
    - O aviso aparece só quando `rodada.numero === rodada.total` e `regrasMudaram`.
    - A comparação chama `carregarRegras()` uma vez, num `useEffect`, só com `real && rodada`. Uma falha só significa "sem aviso".
  - **Rótulo longo do `match_tolerancia`:** passa a ser "Match por tolerância (data ou valor)". Ajuste os testes que citam o texto antigo (`grep -rn "Match por tolerância de data"`).

- [ ] **Step 4: Rode e veja passar.** Rode o comando do Step 2 e depois `npm run test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A lib "app/(app)"
git commit -m "feat: a comparação diz com que regras a rodada rodou e avisa quando mudaram"
```

---

### Task 10: Documentação e verificação no navegador

**Files:**
- Modify: `CLAUDE.md` (seção "Backend status")
- Fora do repositório: o backend de demonstração, no scratchpad da sessão, nunca commitado.

- [ ] **Step 1: Atualize o `CLAUDE.md`.** Acrescente uma linha em "Backend status" com:
  - os três papéis vindos do `/me` (sem o campo, administrador), o `lib/papeis.ts` e o `SoQuemPode`;
  - as rotas das Configurações e o que cada seção faz sem elas;
  - o `/convite`;
  - a exportação pelo Route Handler `app/api/empresa/exportacao`.

  Tire de "Still mocked" o que mudou e mantenha o "Hidden until the backend has the route" coerente.

- [ ] **Step 2: Prepare o backend de demonstração (fora do repositório).** Ele deve atender:
  - `GET /me`, com o `papel` vindo da variável `PAPEL`, mais `cnpj` e `metodos_login`;
  - `GET /empresa/usuarios`, com três pessoas e um convite;
  - `POST` e `DELETE` dos convites;
  - `PATCH` e `DELETE` das pessoas, com 409 se sobrar zero administradores;
  - `GET` e `PUT /empresa/configuracoes`, guardando em memória;
  - `tolerancia_valor` e `similaridade_minima` nos itens de `/execucoes`;
  - `POST /me/sessoes/encerrar` (204);
  - `GET /empresa/exportacao`, devolvendo um `.zip` pequeno;
  - `POST /convites/consultar` e `POST /convites/aceitar`.

- [ ] **Step 3: Verifique no navegador** com `PAPEL` igual a `administrador`, `analista` e `contador`, a 1440px e a 375px, no tema claro e no escuro. Confira:
  - a ordem das seções;
  - a Conta;
  - a Equipe: convidar, mudar papel, remover e o 409;
  - as regras: salvar, a pergunta ao fechar e o Esc;
  - a Segurança;
  - a exportação baixando o `.zip` com o nome certo;
  - o `/convite#token=…`: entra no app e o fragmento some;
  - a faixa "Regras desta rodada" e o aviso;
  - no contador, a falta do "Nova conciliação" e do "Enviar nova versão".

  Rode `read_console_messages` sem erro novo e tire screenshots para o PR.

- [ ] **Step 4: Rode a suíte completa**

Run: `npm run test && npm run lint && npm run build`
Expected: tudo passa, e `/convite` e `/api/empresa/exportacao` aparecem na tabela de rotas.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: papéis e Configurações no status do backend"
```
