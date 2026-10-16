# Equipe e convites — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o administrador convida, cancela convite e remove pessoas em Configurações › Equipe, e o convidado cria a conta em `/aceitar-convite`, com senha ou com Google.

**Architecture:** tudo passa por Server Actions sobre `chamarBackend` (`lib/backend.ts`), como o resto do app. A seção Equipe vira linhas da janela de Configurações (o mesmo `Linha` que as outras seções usam, então a busca da janela acha tudo), montadas por um hook em `app/(app)/equipe/`. A página de aceite é um Server Component que lê a sessão e o `?google=` e entrega a um formulário cliente; o aceite com Google é um desvio no `aoVoltarDoGoogle`, guiado por um cookie httpOnly.

**Tech Stack:** Next 16 (App Router, Server Actions), NextAuth v5, React 19, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-16-equipe-e-convites-design.md` (os textos de tela estão lá; este plano os repete só onde um teste os cobra).

## Global Constraints

- Branch `feat/equipe-convites`, worktree `.worktrees/equipe-convites`, base `develop`. Commits pequenos, um por tarefa, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O navegador nunca chama o backend: só Server Actions e `chamarBackend`. Rotas sem login (`/convites/*`) vão com `publica: true`.
- Token do convite: só no fragmento (`#token=`), no corpo das chamadas e no cookie httpOnly. Nunca em query string, `console`, nem estado que vá para o servidor fora do corpo.
- Cookie `ledgr-convite-google`: `httpOnly`, `sameSite: "lax"`, `secure` em produção, `path: "/"`, `maxAge` 3600, como o `ledgr-cadastro-google`.
- Datas na tela: `dd/mm/aaaa` no fuso `America/Sao_Paulo`.
- Reusar classes do `globals.css` (`.btn`, `.btn-secondary`, `.cfg-*`, `.tag`, `.input`) e os componentes de `app/(auth)/_compartilhado/`. Nada de estilo novo inventado se houver classe para isso.
- Sem trava por plano. O botão do Google só com `googleLigado()`.
- Antes de cada commit da tarefa: os testes do arquivo tocado passam. Antes do PR: `npm run test && npm run lint && npm run build`.

## Review Focus

1. **E-mail com espaço ou maiúscula no convite** ("  Ana@Empresa.com ") — sai aparado; a mensagem de sucesso mostra o e-mail que o backend devolveu. Teste na Tarefa 2.
2. **Clique duplo em "Enviar convite", "Cancelar" ou "Remover"** — o botão trava enquanto a ação roda; o backend recebe uma chamada. Teste na Tarefa 4.
3. **Link do convite aberto duas vezes, ou recarregado depois de lido** — o fragmento já foi apagado, então a segunda leitura vê "sem token": a página guarda o token na memória antes de apagar e não volta para "expirou" num re-render. Teste na Tarefa 6.
4. **Volta do Google sem o cookie** (passou de 1 hora, outro navegador) com `?google=email_diferente` — mostra a tela de convite inválido, nunca um formulário sem convite. Teste na Tarefa 7.
5. **Pessoa removida com a janela aberta** — qualquer ação dela recebe 401 e vai para `/login`, sem mensagem de erro presa na tela. Teste na Tarefa 4.

---

### Task 1: Tipos e adaptadores da equipe e do convite

**Files:**
- Modify: `lib/adaptadores.ts` (fim do arquivo)
- Test: `lib/adaptadores.test.ts`

**Interfaces:**
- Produces:
  - `type PessoaAPI = { id: string; nome: string; email: string; administrador: boolean; criado_em: string }`
  - `type Pessoa = { id: string; nome: string; email: string; administrador: boolean }`
  - `type ConviteAPI = { id: string; email: string; criado_em: string; expira_em: string }`
  - `type Convite = { id: string; email: string; enviadoEm: string; valeAte: string }` (datas já em `dd/mm/aaaa`)
  - `type ConsultaConviteAPI = { email: string; razao_social: string; expira_em: string }`
  - `type ConsultaConvite = { email: string; razaoSocial: string; valeAte: string }`
  - `formatarDia(iso: string): string`, `adaptarPessoa(api: PessoaAPI): Pessoa`, `adaptarConvite(api: ConviteAPI): Convite`, `adaptarConsultaConvite(api: ConsultaConviteAPI): ConsultaConvite`

- [ ] **Step 1: Escrever os testes**

```ts
describe("equipe e convites", () => {
  it("formata o dia em dd/mm/aaaa no fuso de Brasília", () => {
    expect(formatarDia("2026-10-23T02:30:00Z")).toBe("22/10/2026"); // 23h30 em Brasília
    expect(formatarDia("2026-10-23T15:00:00+00:00")).toBe("23/10/2026");
  });
  it("adapta convite e consulta com as datas formatadas", () => {
    expect(adaptarConvite({ id: "c1", email: "ana@x.com", criado_em: "2026-10-16T12:00:00Z", expira_em: "2026-10-23T12:00:00Z" }))
      .toEqual({ id: "c1", email: "ana@x.com", enviadoEm: "16/10/2026", valeAte: "23/10/2026" });
    expect(adaptarConsultaConvite({ email: "ana@x.com", razao_social: "Padaria Ltda", expira_em: "2026-10-23T12:00:00Z" }))
      .toEqual({ email: "ana@x.com", razaoSocial: "Padaria Ltda", valeAte: "23/10/2026" });
  });
  it("adapta a pessoa sem o criado_em", () => {
    expect(adaptarPessoa({ id: "u1", nome: "Ana", email: "ana@x.com", administrador: true, criado_em: "2026-10-01T00:00:00Z" }))
      .toEqual({ id: "u1", nome: "Ana", email: "ana@x.com", administrador: true });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/adaptadores.test.ts` → FAIL (`formatarDia` não existe).
- [ ] **Step 3: Implementar** — `formatarDia` com `Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" })`; os adaptadores só renomeiam e formatam.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.
- [ ] **Step 5: Commit** — `feat(equipe): tipos e adaptadores de pessoa e convite`.

### Task 2: `Retry-After` no erro do backend e as ações da equipe

**Files:**
- Modify: `lib/backend.ts` (`ErroBackend`, `erroDaResposta`)
- Create: `app/(app)/equipe/acoes.ts`
- Test: `lib/backend.test.ts`, `app/(app)/equipe/acoes.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Pessoa`, `Convite`, adaptadores); `Resultado<T>`, `Falha` de `app/(app)/conciliacoes/acoes.ts`.
- Produces:
  - `ErroBackend` ganha `readonly segundosParaTentar?: number` (5º parâmetro do construtor), preenchido por `erroDaResposta` a partir do cabeçalho `Retry-After` quando é inteiro positivo.
  - `type Equipe = { pessoas: Pessoa[]; convites: Convite[] | null }` (`null` para quem não é administrador: não chama `/empresa/convites`)
  - `carregarEquipe(administrador: boolean): Promise<Resultado<Equipe>>`
  - `convidar(email: string): Promise<Resultado<Convite>>`
  - `cancelarConvite(id: string): Promise<Resultado<null>>`
  - `removerPessoa(id: string): Promise<Resultado<null>>`

- [ ] **Step 1: Escrever os testes**

`lib/backend.test.ts`, no padrão do arquivo (fetch mockado):
```ts
it("guarda o Retry-After do 429 em segundos", async () => {
  // resposta 429, headers { "Retry-After": "120" }, corpo { detail: "Limite..." }
  await expect(chamarBackend("/empresa/convites", { method: "POST", corpo: {} }))
    .rejects.toMatchObject({ status: 429, segundosParaTentar: 120 });
});
```

`app/(app)/equipe/acoes.test.ts`, com `vi.mock("@/lib/backend")` mantendo o `ErroBackend` real:
```ts
it("quem não é administrador não lê os convites", async () => {
  chamarBackend.mockResolvedValueOnce({ itens: [pessoaApi] });
  expect(await carregarEquipe(false)).toEqual({ ok: true, dados: { pessoas: [pessoa], convites: null } });
  expect(chamarBackend).toHaveBeenCalledTimes(1);
  expect(chamarBackend).toHaveBeenCalledWith("/empresa/usuarios");
});
it("o administrador lê pessoas e convites", async () => { /* duas chamadas, convites adaptados */ });
it("apara o e-mail antes de convidar", async () => {
  await convidar("  Ana@Empresa.com ");
  expect(chamarBackend).toHaveBeenCalledWith("/empresa/convites", { method: "POST", corpo: { email: "Ana@Empresa.com" } });
});
it.each([
  [409, undefined, "Este e-mail já tem conta no Ledgr."],
  [429, 120, "Limite de convites por hora atingido. Tente de novo em 2 minutos."],
  [429, 61, "Limite de convites por hora atingido. Tente de novo em 2 minutos."],
  [429, undefined, "Limite de convites por hora atingido. Tente de novo mais tarde."],
  [503, undefined, "O envio de convites está indisponível no momento."],
  [403, undefined, "Só o administrador pode fazer isso."],
  [401, undefined, "Sua sessão expirou. Entre de novo para continuar."],
])("convidar com %i vira o texto certo", async (status, segundos, texto) => {
  chamarBackend.mockRejectedValueOnce(new ErroBackend(status, "x", [], {}, segundos));
  expect(await convidar("ana@x.com")).toEqual({ ok: false, status, erro: texto });
});
it("cancelar e remover chamam DELETE com o id", async () => { /* /empresa/convites/c1 e /empresa/usuarios/u1 */ });
it("404 ao carregar a equipe chega como status 404", async () => { /* a seção usa isso para "ainda não está disponível" */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/backend.test.ts "app/(app)/equipe/acoes.test.ts"` → FAIL.
- [ ] **Step 3: Implementar** — `"use server"` no topo de `acoes.ts`. Um `traduzirEquipe(erro): Falha` local cobre 401, 403, 409, 429 (minutos = `Math.ceil(segundos / 60)`, "1 minuto" no singular), 503, e cai no texto do backend no resto; erro que não é `ErroBackend` vira status 0 "Não foi possível falar com o servidor.". `carregarEquipe` faz as duas leituras com `Promise.all` quando é administrador. Os ids vão em `encodeURIComponent`.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.
- [ ] **Step 5: Commit** — `feat(equipe): ações de convidar, cancelar e remover`.

### Task 3: `administrador` da conta até a janela de Configurações

**Files:**
- Modify: `app/(auth)/acoes.ts` (`ContaDaSessao`, `contaDaSessao`)
- Modify: `app/(app)/layout.tsx`, `app/(app)/shell.tsx`, `app/(app)/menu-lateral.tsx`, `app/(app)/configuracoes.tsx` (só as props)
- Test: `app/(auth)/acoes.test.ts`, `app/(app)/shell.test.tsx` (ou o teste que já confere `temSenha` chegando à janela)

**Interfaces:**
- Produces: `ContaDaSessao.administrador: boolean` — `eu.administrador !== false` (sem o campo, ou com o `/me` fora do ar, `true`). Prop `administrador: boolean` em `Shell`, `MenuLateral` e `Configuracoes`, ao lado de `temSenha`, pelo mesmo caminho.

- [ ] **Step 1: Escrever os testes**

```ts
it("lê o administrador do /me e assume administrador sem o campo", async () => {
  chamarBackend.mockResolvedValueOnce({ ...me, administrador: false });
  expect((await contaDaSessao()).administrador).toBe(false);
  chamarBackend.mockResolvedValueOnce({ ...me }); // sem o campo
  expect((await contaDaSessao()).administrador).toBe(true);
});
```
E no teste do shell/menu que já passa `temSenha`: passar `administrador={false}` e conferir que chega a `Configuracoes` (mesma técnica que o teste existente usa).

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(auth)/acoes.test.ts" "app/(app)/shell.test.tsx"` → FAIL.
- [ ] **Step 3: Implementar** — campo no tipo, leitura no `contaDaSessao` (e `true` no `catch`), e a prop repassada nos quatro arquivos. Trocar o comentário "Sem `papel`, porque o MVP tem conta única" pelo que vale agora.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando, e `npx tsc --noEmit` sem erro.
- [ ] **Step 5: Commit** — `feat(equipe): administrador do /me chega às Configurações`.

### Task 4: A seção Equipe em Configurações

**Files:**
- Create: `app/(app)/equipe/secao-equipe.tsx`
- Modify: `app/(app)/configuracoes.tsx` (seção nova entre `conta` e `aparencia`)
- Test: `app/(app)/equipe/secao-equipe.test.tsx`, `app/(app)/configuracoes.test.tsx`

**Interfaces:**
- Consumes: Task 2 (ações, `Equipe`), Task 3 (`administrador`), `EmpresaDaSessao` de `app/(app)/cabecalho.tsx`, `ErroBackend` não (só `Resultado`).
- Produces: `useLinhasDaEquipe({ aberta, administrador, email }: { aberta: boolean; administrador: boolean; email: string }): { titulo: string; descricao?: string; controle?: ReactNode }[]` — o mesmo formato de `Linha` de `configuracoes.tsx`, que monta `{ id: "equipe", nome: "Equipe", icone: Users, grupo: "Configurações", linhas }`. `email` é o da sessão, para marcar "você".

As linhas, nesta ordem:
1. "Quem tem acesso" — descrição "Quem tem acesso à <empresa>. Cada pessoa entra com o próprio e-mail." (empresa de `useContext(EmpresaDaSessao)`).
2. Uma linha por pessoa: título = nome, descrição = e-mail, controle = `.tag` "Administrador" e/ou "você", e para o administrador logado, nas outras pessoas não administradoras, o botão "Remover" com a confirmação na própria linha (texto da spec, botões "Remover" e "Cancelar").
3. Só administrador: "Convidar pessoa" com `input type="email"` (rótulo "E-mail da pessoa"), validado com `EMAIL_VALIDO`/`MENSAGEM_EMAIL_INCOMPLETO` de `app/(auth)/_compartilhado/validacao.ts`, e "Enviar convite". O retorno aparece embaixo, em `role="status"` (sucesso) ou `role="alert"` (erro).
4. Só administrador e com convites: "Convites pendentes" seguido de uma linha por convite (título = e-mail, descrição = "Enviado em <enviadoEm> · vale até <valeAte>", controle = "Cancelar").
5. Quem não é administrador: linha "Só o administrador convida e remove pessoas."

Estados: carrega quando `aberta` vira true pela primeira vez (como `carregarRegras`); "Carregando a equipe…"; 404 → "A equipe ainda não está disponível."; outra falha → "Não foi possível carregar agora." e "Tentar de novo"; qualquer 401 → `router.push("/login")`; 403 numa ação → mostra "Só o administrador pode fazer isso." e carrega a equipe de novo.

- [ ] **Step 1: Escrever os testes** (`secao-equipe.test.tsx`, renderizando um componente de teste que lista as linhas do hook; ações mockadas com `vi.mock("./acoes")`)

```ts
it("o administrador vê convidar, pendentes, cancelar e remover", async () => {
  // carregarEquipe → 2 pessoas (o admin, logado, e Bia) e 1 convite
  expect(await screen.findByText("Bia")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument(); // só um: o da Bia
  expect(screen.getByText("você")).toBeInTheDocument();
  expect(screen.getByLabelText("E-mail da pessoa")).toBeInTheDocument();
  expect(screen.getByText("Enviado em 16/10/2026 · vale até 23/10/2026")).toBeInTheDocument();
});
it("quem não é administrador vê só a lista e a frase", async () => { /* sem Remover, sem campo, frase presente; carregarEquipe chamado com false */ });
it("confirma a remoção na própria linha e tira a pessoa da lista", async () => {
  // clica Remover → aparece "Bia perde o acesso na hora. As decisões que registrou continuam no histórico com o nome dela."
  // clica Remover de novo → removerPessoa("u2") uma vez; "Bia" some
});
it("trava os botões enquanto a ação roda", async () => {
  // removerPessoa pendente (promise não resolvida): dois cliques no Remover da confirmação → 1 chamada; botão disabled
  // idem "Enviar convite"
});
it("convidar põe o convite no topo e mostra o retorno", async () => {
  // convidar resolve { ok: true, dados: { id: "c2", email: "ana@x.com", enviadoEm: "16/10/2026", valeAte: "23/10/2026" } }
  // status: "Convite enviado para ana@x.com. O link vale até 23/10/2026." e o campo vazio
});
it("mostra o erro do convite e mantém o e-mail digitado", async () => { /* 409 → alert com o texto da ação */ });
it("e-mail incompleto não chama a ação", async () => { /* "ana@" → MENSAGEM_EMAIL_INCOMPLETO, convidar não chamado */ });
it("404 ao carregar diz que ainda não está disponível", async () => {});
it("falha ao carregar oferece Tentar de novo, que carrega outra vez", async () => {});
it("403 numa ação avisa e carrega a equipe de novo", async () => { /* removerPessoa → { ok:false, status:403, erro:"Só o administrador pode fazer isso." } → alert e carregarEquipe chamado 2 vezes */ });
it("401 em qualquer ação vai para o login", async () => { /* removerPessoa → { ok:false, status:401 } → push("/login") e nenhum alert */ });
```

Em `configuracoes.test.tsx`: a seção "Equipe" aparece no menu da janela entre "Conta" e "Aparência", e procurar "convid" acha a linha "Convidar pessoa".

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(app)/equipe" "app/(app)/configuracoes.test.tsx"` → FAIL.
- [ ] **Step 3: Implementar** — o hook guarda `Equipe | "carregando" | "sem-rota" | "falhou"`, uma `acaoEmCurso: string | null` (id da linha ou "convidar") para travar botões, e `confirmando: string | null` (id da pessoa). Subcomponentes pequenos no mesmo arquivo (`ConvidarPessoa`, `RemoverPessoa`) quando a linha precisa de estado próprio. Ícone `Users` de `lucide-react`.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.
- [ ] **Step 5: Commit** — `feat(equipe): seção Equipe em Configurações`.

### Task 5: Ações públicas do convite

**Files:**
- Modify: `app/(auth)/acoes.ts`
- Test: `app/(auth)/acoes.test.ts`

**Interfaces:**
- Consumes: Task 1 (`ConsultaConvite`, `adaptarConsultaConvite`); `entrar` (mesmo arquivo).
- Produces:
  - `type ResultadoConsultaConvite = { ok: true; convite: ConsultaConvite } | { ok: false; erro: "convite_invalido" | "muitas_tentativas" | "falha" }`
  - `consultarConvite(token: string): Promise<ResultadoConsultaConvite>` — `POST /convites/consultar`, `publica: true`; 400/422 → `convite_invalido`.
  - `type ResultadoAceite = { ok: true; entrou: boolean } | { ok: false; erro: "convite_invalido" | "email_cadastrado" | "senha_invalida" | "muitas_tentativas" | "falha" }`
  - `aceitarConvite(token: string, email: string, nome: string, senha: string): Promise<ResultadoAceite>` — `POST /convites/aceitar` com `{ token, nome, senha }`, depois `entrar(email, senha, true)`; `entrou` é o `ok` dele. 400 → `convite_invalido`; 409 → `email_cadastrado`; 422 com `senha` em `campos` → `senha_invalida`.
  - `sairParaAceitarConvite(): Promise<void>` — `signOut({ redirect: false })`.

- [ ] **Step 1: Escrever os testes**

```ts
it("consulta o convite pelo corpo, sem sessão", async () => {
  chamarBackend.mockResolvedValueOnce({ email: "ana@x.com", razao_social: "Padaria", expira_em: "2026-10-23T12:00:00Z" });
  expect(await consultarConvite("tok")).toEqual({ ok: true, convite: { email: "ana@x.com", razaoSocial: "Padaria", valeAte: "23/10/2026" } });
  expect(chamarBackend).toHaveBeenCalledWith("/convites/consultar", { method: "POST", corpo: { token: "tok" }, publica: true });
});
it.each([[400, "convite_invalido"], [429, "muitas_tentativas"], [500, "falha"]])("consulta com %i → %s", ...);
it("aceita e já entra com o e-mail do convite", async () => {
  // chamarBackend resolve; signIn resolve
  expect(await aceitarConvite("tok", "ana@x.com", "Ana", "senha-boa-1")).toEqual({ ok: true, entrou: true });
  expect(chamarBackend).toHaveBeenCalledWith("/convites/aceitar", { method: "POST", corpo: { token: "tok", nome: "Ana", senha: "senha-boa-1" }, publica: true });
  expect(signIn).toHaveBeenCalledWith("credentials", { email: "ana@x.com", senha: "senha-boa-1", redirect: false });
});
it.each([[400, [], "convite_invalido"], [409, [], "email_cadastrado"], [422, ["senha"], "senha_invalida"], [429, [], "muitas_tentativas"]])(
  "aceite com %i → %s", ...);
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(auth)/acoes.test.ts"` → FAIL.
- [ ] **Step 3: Implementar** — nos moldes de `redefinirSenha` e `cadastrar` do mesmo arquivo.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.
- [ ] **Step 5: Commit** — `feat(convite): consultar e aceitar convite com senha`.

### Task 6: A página `/aceitar-convite` (com senha)

**Files:**
- Create: `app/(auth)/aceitar-convite/page.tsx` (Server Component), `app/(auth)/aceitar-convite/formulario.tsx` (`"use client"`)
- Test: `app/(auth)/aceitar-convite/formulario.test.tsx`

**Interfaces:**
- Consumes: Task 5.
- Produces: `AceitarConvite({ conectadoComo, google }: { conectadoComo: string | null; google: { ligado: boolean; erro: string | null; convite: ConsultaConvite | null } })`. Nesta tarefa o `page.tsx` passa `google: { ligado: false, erro: null, convite: null }` e `conectadoComo` = `(await auth())?.user?.email ?? null`; a Tarefa 7 completa o `google`.

Etapas do formulário: `"lendo" | "invalido" | "conectado" | "formulario" | "enviando"`. Na montagem, lê `new URLSearchParams(location.hash.slice(1)).get("token")`, guarda num `useRef`, apaga o fragmento com `history.replaceState(null, "", location.pathname + location.search)`, e só então decide: sem token → `invalido`; `conectadoComo` → `conectado`; senão consulta. Campos com `CampoTexto`: "Seu nome", "Senha", "Repita a senha"; a validação de senha é a da `/redefinir-senha` (8 caracteres a 72 bytes, confirmação igual) — mover `validar` de lá para `_compartilhado/validacao.ts` como `validarSenhaNova(senha, confirmacao)` e usar nos dois lugares. Depois do aceite, `router.push("/visao-geral")` (com `entrou: false`, `router.push("/login")`).

- [ ] **Step 1: Escrever os testes** (no molde de `redefinir-senha/page.test.tsx`)

```ts
it("lê o token, apaga o fragmento e mostra o convite", async () => {
  abrirLink("/aceitar-convite#token=tok");
  render(<AceitarConvite conectadoComo={null} google={semGoogle} />);
  expect(await screen.findByRole("heading", { name: "Entrar na Padaria Ltda" })).toBeInTheDocument();
  expect(screen.getByText("ana@x.com")).toBeInTheDocument();
  expect(screen.getByText("O convite vale até 23/10/2026")).toBeInTheDocument();
  expect(window.location.hash).toBe("");
  expect(consultarConvite).toHaveBeenCalledWith("tok");
});
it("sem token, ou convite inválido, não mostra formulário", async () => {
  // "Este convite expirou ou já foi usado. Peça um novo a quem convidou." e link "Ir para o login"; sem campo "Senha"
});
it("um novo render depois de apagar o fragmento não perde o convite", async () => {
  // rerender com as mesmas props → continua o formulário; consultarConvite chamado 1 vez
});
it("valida como o cadastro antes de aceitar", async () => { /* senha "curta" → mensagem de 8 caracteres; aceitarConvite não chamado */ });
it("aceita e vai para a Visão geral", async () => {
  // preenche Ana / senha-boa-1 / senha-boa-1 → "Criar conta e entrar"
  // aceitarConvite("tok", "ana@x.com", "Ana", "senha-boa-1"); push("/visao-geral")
});
it("e-mail já cadastrado manda para o login", async () => { /* "Este e-mail já tem conta no Ledgr. Entre com ela." + link /login */ });
it("conectado em outra conta pede para sair primeiro, e Sair e continuar volta ao convite", async () => {
  // conectadoComo="bia@y.com": "Você está conectado como bia@y.com. Para aceitar este convite, saia primeiro."
  // clique → sairParaAceitarConvite(); depois consultarConvite("tok") e o formulário
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(auth)/aceitar-convite" "app/(auth)/redefinir-senha"` → FAIL.
- [ ] **Step 3: Implementar** — `MolduraAuth` em volta, `MensagemErro` para os erros, `metadata` `{ title: "Aceitar convite · Ledgr" }` no `page.tsx`.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando (a `/redefinir-senha` continua verde com o `validarSenhaNova` movido) → PASS.
- [ ] **Step 5: Commit** — `feat(convite): página para aceitar o convite com senha`.

### Task 7: Aceitar o convite com Google

**Files:**
- Modify: `lib/google.ts`, `lib/login.ts` (`aoVoltarDoGoogle`), `app/(auth)/acoes.ts`, `app/(auth)/aceitar-convite/page.tsx`, `app/(auth)/aceitar-convite/formulario.tsx`
- Test: `lib/login.test.ts`, `app/(auth)/acoes.test.ts`, `app/(auth)/aceitar-convite/formulario.test.tsx`

**Interfaces:**
- Consumes: Tasks 5 e 6; `entrarNoBackendComGoogle`/`usuarioDaSessao` de `lib/login.ts`.
- Produces:
  - `lib/google.ts`: `COOKIE_CONVITE_GOOGLE = "ledgr-convite-google"`; `type ErroConviteGoogle = "email_diferente" | "convite_invalido" | "email_cadastrado" | "muitas_tentativas" | "falha"`; `ehErroConviteGoogle(valor: unknown): valor is ErroConviteGoogle`.
  - `lib/login.ts`: `aceitarConviteNoBackendComGoogle(token: string, idToken: string): Promise<{ ok: true; usuario: User } | { ok: false; erro: ErroConviteGoogle }>` — `POST /convites/aceitar/google`, `publica: true`; 400 → `convite_invalido`; 409 com `detalhe` contendo "diferente" → `email_diferente`, outro 409 → `email_cadastrado`; 429 → `muitas_tentativas`; resto → `falha`.
  - `aoVoltarDoGoogle`: se o cookie `COOKIE_CONVITE_GOOGLE` existe, usa `aceitarConviteNoBackendComGoogle`; sucesso → apaga o cookie, `Object.assign(usuario, …)`, `true`; recusa → `"/aceitar-convite?google=<erro>"`, apagando o cookie só em `convite_invalido`. Sem o cookie, o caminho de hoje sem mudança.
  - `app/(auth)/acoes.ts`: `aceitarConviteComGoogle(token: string): Promise<false>` (grava o cookie com as opções das Global Constraints e chama `signIn("google", { redirectTo: "/visao-geral" })`; token vazio não grava nada e usa o cookie que já existe, que é o caso de tentar de novo depois de um `?google=`; sem `AUTH_GOOGLE_ID`, ou com token vazio e sem cookie, devolve `false`); `conviteDoCookie(): Promise<ConsultaConvite | null>` (lê o cookie e chama `consultarConvite`; inválido → apaga o cookie e `null`).
  - `page.tsx`: com `searchParams.google` válido, `google = { ligado: googleLigado(), erro, convite: await conviteDoCookie() }`; sem, `{ ligado: googleLigado(), erro: null, convite: null }`.
  - Formulário: com `google.erro`, não lê fragmento; usa `google.convite` (null → etapa `invalido`). Mensagens: `email_diferente` → "Entre no Google com <email do convite> para aceitar."; `email_cadastrado` → "Este e-mail já tem conta no Ledgr. Entre com ela." + link para o login; `muitas_tentativas`/`falha` → os textos de `MENSAGEM_GOOGLE`. O botão "Aceitar com Google" e o separador "ou" só com `google.ligado`. Depois de um erro do Google não há token na memória, então o botão chama `aceitarConviteComGoogle("")`.

- [ ] **Step 1: Escrever os testes**

`lib/login.test.ts`:
```ts
it("com o cookie do convite, aceita o convite em vez de entrar", async () => {
  // cookies().get(COOKIE_CONVITE_GOOGLE) → "tok"; chamarBackend resolve um UsuarioAPI
  expect(await aoVoltarDoGoogle(usuario, "id-tok")).toBe(true);
  expect(chamarBackend).toHaveBeenCalledWith("/convites/aceitar/google", { method: "POST", corpo: { token: "tok", id_token: "id-tok" }, publica: true });
  expect(chamarBackend).not.toHaveBeenCalledWith("/login/google", expect.anything());
  expect(cookies.delete).toHaveBeenCalledWith(COOKIE_CONVITE_GOOGLE);
});
it.each([
  [409, "O e-mail da conta Google é diferente do e-mail convidado.", "/aceitar-convite?google=email_diferente", false],
  [409, "E-mail já cadastrado.", "/aceitar-convite?google=email_cadastrado", false],
  [400, "Convite inválido ou expirado. Peça um novo convite.", "/aceitar-convite?google=convite_invalido", true],
])("recusa %i (%s) volta para %s", async (status, detalhe, destino, apagaCookie) => { ... });
it("sem o cookie do convite, segue o login pelo Google de hoje", async () => { /* chama /login/google */ });
```

`app/(auth)/acoes.test.ts`: `aceitarConviteComGoogle("tok")` grava o cookie com `{ httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 }` e chama `signIn("google", { redirectTo: "/visao-geral" })`; `conviteDoCookie()` sem cookie → `null` sem chamar o backend; com cookie inválido → `null` e cookie apagado.

`formulario.test.tsx`:
```ts
it("com email_diferente, pede o e-mail certo do convite", async () => {
  render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: "email_diferente", convite }} />);
  expect(screen.getByText("Entre no Google com ana@x.com para aceitar.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Aceitar com Google" })).toBeInTheDocument();
});
it("com erro do Google e sem convite no cookie, mostra convite inválido", async () => {
  render(<AceitarConvite conectadoComo={null} google={{ ligado: true, erro: "email_diferente", convite: null }} />);
  expect(screen.getByText("Este convite expirou ou já foi usado. Peça um novo a quem convidou.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
});
it("o botão do Google só aparece ligado", async () => { /* ligado:false → sem botão e sem "ou" */ });
it("Aceitar com Google manda o token guardado", async () => { /* aceitarConviteComGoogle("tok") */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/login.test.ts "app/(auth)/acoes.test.ts" "app/(auth)/aceitar-convite"` → FAIL.
- [ ] **Step 3: Implementar** — conforme as Interfaces acima.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.
- [ ] **Step 5: Commit** — `feat(convite): aceitar o convite com Google`.

### Task 8: Documentação, verificação completa e checagem na tela

**Files:**
- Modify: `CLAUDE.md` (o item "The date tolerance is editable…", o item "The account comes from `GET /me`…" e a última frase do item do Google)
- Modify: `docs/superpowers/specs/2026-10-02-configuracoes-equipe-design.md` (nota no topo)

- [ ] **Step 1: CLAUDE.md** — trocar "The MVP is a single account: no roles, team or invites" e "No `papel`…" por: um papel só, o administrador (`administrador` do `GET /me`, `true` sem o campo); a seção Equipe (`app/(app)/equipe/`) e a página `/aceitar-convite`, com o desvio do cookie `ledgr-convite-google` no `aoVoltarDoGoogle`; convidar responde 503 enquanto o e-mail do backend estiver desligado. Tirar "'Aceitar com Google' on the invite page is not done".
- [ ] **Step 2: Nota na spec antiga** — no topo: "Revisão de 16/10/2026: Equipe e convites estão em `2026-10-16-equipe-e-convites-design.md`, com um papel só."
- [ ] **Step 3: Verificação** — `npm run test && npm run lint && npm run build`. Esperado: tudo verde e `○ /aceitar-convite` (ou `ƒ`) na tabela de rotas.
- [ ] **Step 4: Checagem na tela** — backend local (`backend-local`) e o dev server desta worktree (entrada nova no `.claude/launch.json` da pasta principal, porta 3960, `.env.development.local` copiado de `C:/Users/Eduardo/postgres18/env-do-front.local`). Com a conta de teste do LEIA-ME: abrir Configurações › Equipe, ver a lista e tentar convidar (503 se o e-mail local estiver desligado: conferir o texto). Para o aceite, criar o convite com o e-mail ligado no backend local ou, se não der, gerar um token direto no banco local só para o teste e abrir `/aceitar-convite#token=…`; conferir aceite com senha, a entrada na Visão geral e a pessoa nova na lista do administrador; remover a pessoa e ver o acesso dela cair. Screenshot de cada tela.
- [ ] **Step 5: Commit** — `docs: equipe e convites no CLAUDE.md`.
