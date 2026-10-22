# Empresas clientes nas Configurações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma seção "Empresas" em Configurações (lista e cadastro de empresas clientes) e os avisos de limite do plano para empresas e usuários, lidos do `GET /me`.

**Architecture:** Server Actions (`empresas/acoes.ts`) falam com `GET`/`POST /empresas` por `chamarBackend`; um hook `useLinhasDasEmpresas` devolve linhas no mesmo formato das outras seções (como `useLinhasDaEquipe`); os limites vêm do `/me` por `contaDaSessao` → `ProvedorDaConta` → `useLimites()`; regras puras dos limites em `lib/limites.ts`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Vitest + Testing Library, CSS global (`app/globals.css`).

**Spec:** `docs/superpowers/specs/2026-10-22-empresas-na-configuracao-design.md`

## Global Constraints

- Texto da tela em português do Brasil; nomes de código em português, como o resto do app.
- O front nunca chama o backend do navegador: só Server Actions por `chamarBackend` (`lib/backend.ts`).
- Dentro de `app/(app)/e/[empresa]`: links, `push` e redirecionamentos só por `LinkDoApp`, `useRoteador()` e `redirecionarNoApp()`; o guarda `lib/rotas.guarda.test.ts` falha em `next/link`, `useRouter`, `redirect` ou `<a href={...}>` sem `comEmpresa(...)`.
- Reusar as classes do design system (`.btn`, `.input`, `.tag`, `.cfg-form`, `.cfg-acao`, `.cfg-valor`, `.field`) em vez de estilos novos.
- Antes de cada commit: `npm run test && npm run lint && npm run build`. Mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Sem o campo `limites` no `/me` (backend anterior ao #133) e sem a rota `GET /empresas` (404): nada quebra, nada é mostrado.
- A rota `/empresas` é da conta e ignora `X-Ledgr-Empresa`; o front a chama como qualquer outra.

## Review Focus

- CNPJ digitado em minúsculas ou com pontuação vai ao backend só com letras maiúsculas e números (Task 3).
- Duplo clique em "Cadastrar" envia uma vez só (Task 5).
- O botão desligado pelo limite não substitui o 402: outra aba ou o contador defasado ainda chegam ao backend, e o 402 mostra a mensagem dele (Task 5).
- Backend sem a rota (404) e `/me` sem `limites`: a seção diz "ainda não disponível" e some o botão; o resto do app segue (Tasks 4 e 2).
- Cadastro com sucesso com a janela de Configurações aberta: fecha a janela, grava a empresa recente com o id novo e abre a Visão geral dela (Task 5).
- Razão social só com espaços é recusada antes de chamar o backend (Task 3).

---

### Task 1: Regras puras dos limites

**Files:**
- Create: `lib/limites.ts`
- Test: `lib/limites.test.ts`

**Interfaces:**
- Produces:
  - `type Limite = { usadas: number; maximo: number | null }`
  - `type LimitesDaConta = { empresas: Limite | null; usuarios: Limite | null }`
  - `type SituacaoDoLimite = "livre" | "folga" | "perto" | "no-limite" | "acima"`
  - `adaptarLimites(bruto: unknown): LimitesDaConta | null`
  - `situacaoDoLimite(limite: Limite): SituacaoDoLimite`
  - `textoDoLimite(tipo: "empresas" | "usuarios", limite: Limite): string | null`

- [ ] **Step 1: Write the failing tests** em `lib/limites.test.ts`:
  - `adaptarLimites`: `{ empresas: { usadas: 2, maximo: 3 }, usuarios: { usados: 1, maximo: null } }` → `{ empresas: { usadas: 2, maximo: 3 }, usuarios: { usadas: 1, maximo: null } }` (o backend chama de `usados` os usuários; o tipo é um só). `undefined`, `null`, `{}`, `{ empresas: "x" }` e números negativos → `null`; só `empresas` válido → `usuarios: null`.
  - `situacaoDoLimite`: `maximo: null` → `livre`; `{1,3}` → `folga`; `{2,3}` → `perto`; `{8,10}` → `perto` (80%); `{7,10}` → `folga`; `{3,3}` → `no-limite`; `{4,3}` → `acima`.
  - `textoDoLimite("empresas", …)`: `folga` e `livre` → `null`; `{2,3}` → "Falta 1 empresa para o limite do plano."; `{8,10}` → "Faltam 2 empresas para o limite do plano."; `{3,3}` → "O plano chegou ao limite de 3 empresas. Para adicionar outra, troque de plano em Assinatura."; `{4,3}` → "A conta tem mais empresas (4) do que o plano permite (3). Nada some; só não dá para adicionar.".
  - `textoDoLimite("usuarios", …)`: `{2,3}` → "Falta 1 pessoa para o limite do plano."; `{3,3}` → "O plano chegou ao limite de 3 pessoas, contando os convites pendentes. Para convidar mais, troque de plano em Assinatura."; `{4,3}` → "A conta tem mais pessoas (4) do que o plano permite (3). Ninguém perde o acesso; só não dá para convidar.".
- [ ] **Step 2: Run** `npx vitest run lib/limites.test.ts` — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** as três funções em `lib/limites.ts`. `perto` é: faltam (`maximo - usadas`) 1 ou mais e (falta 1, ou `usadas / maximo >= 0.8`). Singular/plural por `falta`/`faltam` e `empresa(s)`/`pessoa(s)`.
- [ ] **Step 4: Run** o mesmo teste — Expected: PASS.
- [ ] **Step 5: Commit** `feat(limites): regras puras dos limites do plano (#169)`.

### Task 2: Os limites do `/me` chegam às telas

**Files:**
- Modify: `app/(auth)/acoes.ts` (`ContaDaSessao`, `contaDaSessao`), `app/(app)/e/[empresa]/conta.tsx`, `app/(app)/e/[empresa]/layout.tsx`
- Test: `app/(auth)/acoes.test.ts`, `app/(app)/e/[empresa]/conta.test.tsx`, `app/(app)/e/[empresa]/layout.test.tsx`

**Interfaces:**
- Consumes: `adaptarLimites`, `LimitesDaConta` (Task 1).
- Produces: `ContaDaSessao.limites: LimitesDaConta | null` (null no fallback e sem o campo); `ProvedorDaConta` aceita `limites?: LimitesDaConta | null`; `useLimites(): LimitesDaConta | null` (null fora do provedor).

- [ ] **Step 1: Write the failing tests:**
  - `acoes.test.ts`, em `contaDaSessao`: um `/me` com `limites` devolve `limites: { empresas: { usadas: 2, maximo: 3 }, usuarios: { usadas: 1, maximo: null } }`; sem o campo, `limites: null`. Os três `toEqual` existentes de `contaDaSessao` ganham `limites: null` (o do `catch` também).
  - `conta.test.tsx` (já existe; acrescentar): um componente que chama `useLimites()` dentro de `<ProvedorDaConta preferencias={null} limites={...}>` mostra o valor; fora do provedor, `null`.
  - `layout.test.tsx`: com `contaDaSessao` devolvendo `limites`, o `ProvedorDaConta` recebe `limites` (mesmo estilo do teste de `papel`/`assinatura`).
- [ ] **Step 2: Run** `npx vitest run "app/(auth)/acoes.test.ts" "app/(app)/e/[empresa]/conta.test.tsx" "app/(app)/e/[empresa]/layout.test.tsx"` — Expected: FAIL.
- [ ] **Step 3: Implement.** `contaDaSessao` lê `limites` do corpo do `/me` e passa por `adaptarLimites`; o `catch` devolve `limites: null`. `ProvedorDaConta` ganha um contexto novo para `limites`; o layout passa `limites={conta.limites}`.
- [ ] **Step 4: Run** os mesmos testes — Expected: PASS.
- [ ] **Step 5: Commit** `feat(conta): limites do plano lidos do /me (#169)`.

### Task 3: Ações de empresas (`GET` e `POST /empresas`)

**Files:**
- Create: `app/(app)/e/[empresa]/empresas/acoes.ts`
- Modify: `lib/adaptadores.ts` (tipos e adaptador), `app/(auth)/cadastro/passos.ts` (exportar `caracteresCnpj`, que hoje é interna)
- Test: `app/(app)/e/[empresa]/empresas/acoes.test.ts`

**Interfaces:**
- Consumes: `chamarBackend`, `ErroBackend`, `emailDaSessao` (`lib/backend.ts`); `ehContaDeDemonstracao`, `RECUSA_DEMONSTRACAO` (`lib/demo`); `validarCnpj` e `caracteresCnpj` (`(auth)/cadastro/passos`); `Resultado`, `Falha` (`../conciliacoes/acoes`).
- Produces:
  - em `lib/adaptadores.ts`: `type EmpresaClienteAPI = { id: string; razao_social: string; cnpj: string; cnpj_verificado_em: string | null; criado_em: string }`; `type EmpresaCliente = { id: string; razaoSocial: string; cnpj: string; cnpjVerificado: boolean; criadaEm: string }`; `adaptarEmpresaCliente(api: EmpresaClienteAPI): EmpresaCliente`
  - `carregarEmpresas(): Promise<Resultado<EmpresaCliente[]>>` — `GET /empresas`, que responde `{ itens: EmpresaClienteAPI[] }`
  - `cadastrarEmpresa(cnpj: string, razaoSocial: string): Promise<Resultado<EmpresaCliente>>` — `POST /empresas` com `{ cnpj, razao_social }`

- [ ] **Step 1: Write the failing tests** (mesmo esqueleto de `equipe/acoes.test.ts`: `chamarBackend` e `emailDaSessao` mockados, `ErroBackend` real):
  - `carregarEmpresas` devolve a lista adaptada (`cnpjVerificado` verdadeiro só com `cnpj_verificado_em` preenchido); um 404 vira `{ ok: false, status: 404, … }`.
  - `cadastrarEmpresa("11.444.777/0001-61", "  Cliente Dois Ltda  ")` chama `chamarBackend("/empresas", { method: "POST", corpo: { cnpj: "11444777000161", razao_social: "Cliente Dois Ltda" } })`; `cadastrarEmpresa("ab12cd34000195", …)` envia o CNPJ em maiúsculas.
  - Antes de chamar o backend: razão social vazia ou só espaços → `{ ok: false, status: 422, erro: "Informe a razão social." }`; CNPJ que `validarCnpj` recusa → `{ ok: false, status: 422, erro: <a mensagem do validarCnpj> }`; nenhum dos dois chama `chamarBackend`.
  - Conta de demonstração recusa as duas sem chamar o backend (`RECUSA_DEMONSTRACAO`).
  - Erros do `POST`: 409 → "Esta empresa já está cadastrada na conta."; 402 → o `detalhe` do backend; 429 com `segundosParaTentar: 180` → "Muitos cadastros seguidos. Tente de novo em 3 minutos." (sem segundos: "…Tente de novo mais tarde."); 403 → "Seu papel na conta não permite fazer isso."; 401 → "Sua sessão expirou. Entre de novo para continuar."; 422 com `mensagens: { cnpj: "CNPJ não encontrado na Receita." }` → essa mensagem; rede fora → status 0 "Não foi possível falar com o servidor.".
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/empresas/acoes.test.ts"` — Expected: FAIL.
- [ ] **Step 3: Implement** com o mesmo desenho de `equipe/acoes.ts` (`traduzir`, `recusaNaDemonstracao`, comentários que dizem por quê). Normalizar com `caracteresCnpj(cnpj)` (letras e números, maiúsculas) depois de `validarCnpj`.
- [ ] **Step 4: Run** o mesmo teste — Expected: PASS.
- [ ] **Step 5: Commit** `feat(empresas): ações para listar e cadastrar empresas clientes (#169)`.

### Task 4: A seção Empresas: lista, limite e papel

**Files:**
- Create: `app/(app)/e/[empresa]/empresas/secao-empresas.tsx`
- Test: `app/(app)/e/[empresa]/empresas/secao-empresas.test.tsx`

**Interfaces:**
- Consumes: `carregarEmpresas` (Task 3); `useLimites` (Task 2); `situacaoDoLimite`, `textoDoLimite` (Task 1); `useEmpresaAtiva` (`lib/empresa-ativa`); `gravarEmpresaRecente` (`lib/empresa-recente`); `destinoDaTroca` (`lib/rotas`); `useRoteador`; `formatarCnpj`; `LinhaDaEquipe` (tipo de linha, de `../equipe/secao-equipe`); `Papel`, `podeConvidar` (`lib/papel`).
- Produces: `useLinhasDasEmpresas({ aberta, papel, aoAbrir }: { aberta: boolean; papel: Papel; aoAbrir: () => void }): LinhaDaEquipe[]`. `aoAbrir` roda antes de navegar para outra empresa (a janela de Configurações usa para fechar).

- [ ] **Step 1: Write the failing tests** (mesmo esqueleto de `secao-equipe.test.tsx`: ações mockadas, componente `Linhas` que desenha as linhas, `ProvedorDaEmpresa` e `ProvedorDaConta` em volta):
  - Carrega ao abrir; mostra "Carregando as empresas…" e depois uma linha por empresa com razão social, CNPJ formatado, tag "Ativa" só na da aba e "CNPJ verificado" só na com `cnpjVerificado`.
  - "Abrir" só nas que não são a ativa; ao clicar: chama `aoAbrir`, grava o cookie recente (`document.cookie` contém `ledgr-empresa-recente=<id>`) e faz `push(destinoDaTroca(caminho, id))`.
  - 404 → "As empresas ainda não estão disponíveis." e nenhuma linha de cadastro; falha → "Não foi possível carregar agora." com "Tentar de novo" que recarrega.
  - Linha do plano (com `limites.empresas`): "2 de 3 empresas" e, em `perto`, o texto "Falta 1 empresa para o limite do plano."; `maximo: null` → "2 empresas" sem frase; sem `limites` → nenhuma linha do plano.
  - Papel `analista`: lista sem o formulário e com a linha "Só o admin e o gestor cadastram empresas.". Admin e gestor: aparece a linha "Adicionar empresa" (o formulário em si é da Task 5; aqui basta o botão "Adicionar empresa").
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/empresas/secao-empresas.test.tsx"` — Expected: FAIL.
- [ ] **Step 3: Implement** o hook no desenho de `useLinhasDaEquipe` (estados `carregando`/`sem-rota`/`falhou`/lista, "Tentar de novo"). Link "Ver planos" para `/assinatura` por `LinkDoApp` quando a situação for `no-limite` ou `acima`.
- [ ] **Step 4: Run** o mesmo teste — Expected: PASS; depois `npx vitest run lib/rotas.guarda.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(empresas): seção com a lista das empresas e o limite do plano (#169)`.

### Task 5: O formulário de cadastro

**Files:**
- Modify: `app/(app)/e/[empresa]/empresas/secao-empresas.tsx`
- Test: `app/(app)/e/[empresa]/empresas/secao-empresas.test.tsx`

**Interfaces:**
- Consumes: `cadastrarEmpresa` (Task 3); `formatarCnpj`, `validarCnpj`; `comEmpresa` (`lib/rotas`); `MensagemErro` (`app/(auth)/_compartilhado/mensagem-erro`); `useRoteador` (`push`, `refresh`).
- Produces: componente interno `CadastrarEmpresa` na linha "Adicionar empresa" (formulário em linha, padrão `ConvidarPessoa`: `<form className="cfg-form" aria-label="Adicionar empresa">`, campos "CNPJ" e "Razão social", botão "Cadastrar empresa").

- [ ] **Step 1: Write the failing tests:**
  - O campo CNPJ aplica a máscara ao digitar (`11444777000161` → `11.444.777/0001-61`).
  - CNPJ inválido (`validarCnpj`) mostra a mensagem dele sob o campo e não chama a ação; razão social vazia mostra "Informe a razão social." e não chama a ação.
  - Sucesso (201): chama `cadastrarEmpresa("11.444.777/0001-61", "Cliente Dois Ltda")`, depois `aoAbrir`, grava `ledgr-empresa-recente=<id novo>` e faz `push("/e/<id novo>/visao-geral")`.
  - **Duplo clique:** dois cliques seguidos em "Cadastrar empresa" chamam `cadastrarEmpresa` uma vez; enquanto envia o botão diz "Cadastrando…" e fica desligado.
  - 409 e 422 aparecem sob o campo CNPJ; 402 mostra a mensagem do backend com o link "Ver planos" e chama `refresh()` (relê o `/me`); 429 e 403 mostram a mensagem num aviso do formulário (403 também recarrega a lista); 401 faz `push("/login")`.
  - No limite (`limites.empresas` = `{ usadas: 3, maximo: 3 }`): o botão "Cadastrar empresa" fica desligado e a frase do limite aparece; **mesmo assim**, se a ação responder 402 (outra aba, contador velho), a mensagem do backend aparece.
  - O formulário limpa os campos depois de cadastrar.
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/empresas/secao-empresas.test.tsx"` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement** `CadastrarEmpresa`, com `enviando` travando o segundo clique antes de qualquer `await`, os erros por campo em `MensagemErro` com `aria-describedby`, e o retorno geral em `role="status"`/`MensagemErro`.
- [ ] **Step 4: Run** o mesmo teste e `lib/rotas.guarda.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(empresas): cadastro de empresa cliente pela seção (#169)`.

### Task 6: A seção entra nas Configurações

**Files:**
- Modify: `app/(app)/e/[empresa]/configuracoes.tsx`
- Test: `app/(app)/e/[empresa]/configuracoes.test.tsx`

**Interfaces:**
- Consumes: `useLinhasDasEmpresas` (Task 4/5), ícone `Building2` de `lucide-react`.
- Produces: seção `{ id: "empresas", nome: "Empresas", grupo: "Configurações" }`, antes de `equipe`, abrindo por `secao="empresas"`.

- [ ] **Step 1: Write the failing tests** (mesmo esqueleto do teste de Equipe em `configuracoes.test.tsx`; mockar `./empresas/acoes`): a janela lista "Empresas" no menu das seções; `secao="empresas"` abre nela; a busca da janela por parte do nome de uma empresa acha a linha; clicar em "Abrir" numa empresa chama `onFechar`.
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/configuracoes.test.tsx"` — Expected: FAIL.
- [ ] **Step 3: Implement:** `const linhasDasEmpresas = useLinhasDasEmpresas({ aberta, papel, aoAbrir: onFechar });` e a seção na lista, antes da Equipe.
- [ ] **Step 4: Run** o mesmo teste e `npx vitest run "app/(app)/e/[empresa]/menu-lateral.test.tsx"` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(empresas): seção Empresas na janela de Configurações (#169)`.

### Task 7: Aviso de limite de usuários na Equipe

**Files:**
- Modify: `app/(app)/e/[empresa]/equipe/secao-equipe.tsx`
- Test: `app/(app)/e/[empresa]/equipe/secao-equipe.test.tsx`

**Interfaces:**
- Consumes: `useLimites` (Task 2), `textoDoLimite("usuarios", …)` (Task 1).

- [ ] **Step 1: Write the failing tests:** com `limites.usuarios` = `{ usadas: 2, maximo: 3 }`, admin vê a linha "Plano" com "Falta 1 pessoa para o limite do plano." acima de "Convidar pessoa"; no limite (`{3,3}`) a linha aparece **e o botão "Enviar convite" continua ligado** (reenviar para o mesmo e-mail não ocupa vaga); sem `limites` ou em `folga`, nenhuma linha. Um 402 do `convidar` mostra o texto do backend no retorno do formulário (já é o comportamento padrão de `traduzir`: o teste só o fixa).
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/equipe/secao-equipe.test.tsx"` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement** a linha "Plano" na lista devolvida a quem convida (admin e gestor).
- [ ] **Step 4: Run** o mesmo teste — Expected: PASS.
- [ ] **Step 5: Commit** `feat(equipe): aviso de limite de usuários do plano (#169)`.

### Task 8: "Gerenciar empresas" no seletor

**Files:**
- Modify: `app/(app)/e/[empresa]/seletor-de-empresa.tsx`, `app/globals.css`
- Test: `app/(app)/e/[empresa]/seletor-de-empresa.test.tsx`

**Interfaces:**
- Consumes: `abrirConfiguracoes("empresas")` (`lib/eventos`).

- [ ] **Step 1: Write the failing tests:** com a lista aberta, existe um botão "Gerenciar empresas" **fora** do `listbox` (não conta como opção: `getAllByRole("option")` continua com uma por empresa); ao clicar, a lista fecha e a janela recebe o evento `ledgr:abrir-configuracoes` com `detail: { secao: "empresas" }`; Escape ainda fecha e devolve o foco ao botão do seletor; as setas continuam andando só pelas opções.
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/seletor-de-empresa.test.tsx"` — Expected: FAIL.
- [ ] **Step 3: Implement** o botão logo após a `ul`, com a classe `.seletor-empresa-gerenciar` (borda superior `var(--color-divider)`, mesma altura e fonte das opções, ícone discreto); CSS ao lado dos outros `.seletor-empresa-*`. Confere claro, escuro e recolhido na Task 10.
- [ ] **Step 4: Run** o mesmo teste — Expected: PASS.
- [ ] **Step 5: Commit** `feat(seletor): atalho para gerenciar empresas (#169)`.

### Task 9: Texto na Central de ajuda

**Files:**
- Modify: `app/(ajuda)/ajuda/paginas.ts`
- Test: `app/(ajuda)/ajuda/central.test.tsx` (o teste existente da Central, que continua passando).

- [ ] **Step 1: Write the failing test** em `central.test.tsx`: na página de Configurações, existe uma função com `id: "empresas"` entre "Conta" e "Equipe", com `faz`, passos (`como`) e uma nota sobre o limite do plano; sem `imagem` nem `video` (a página já aceita isso).
- [ ] **Step 2: Run** `npx vitest run "app/(ajuda)"` — Expected: FAIL no teste novo.
- [ ] **Step 3: Implement** a função no formato das vizinhas (`**negrito**` para nomes de botão: "**Adicionar empresa**", "**Cadastrar empresa**", "**Abrir**"). Ajustar a frase que lista as seções ("Conta, Equipe, …") para incluir Empresas.
- [ ] **Step 4: Run** `npx vitest run "app/(ajuda)"` — Expected: PASS.
- [ ] **Step 5: Commit** `docs(ajuda): empresas clientes nas Configurações (#169)`.

### Task 10: Documentação do projeto e verificação real

**Files:**
- Modify: `CLAUDE.md`
- Create (fora do repositório, só para verificar): script de verificação no scratchpad da sessão.

- [ ] **Step 1: CLAUDE.md.** No bullet "The active company lives in the URL", trocar o "Not built: Configurações › Empresas (…)" por uma referência ao novo bullet; adicionar o bullet **"Client companies in Configurações"** (seção `empresas/`, `GET`/`POST /empresas`, os erros e o que cada um mostra, `limites` do `/me` por `contaDaSessao` → `useLimites`, aviso na Equipe sem desligar o convite, "Gerenciar empresas" no seletor, a empresa nova abre depois do cadastro). Mantém o que não foi feito (troca de papel e transferência de admin, parte C).
- [ ] **Step 2: Suite completa.** `npm run test && npm run lint && npm run build` — Expected: tudo verde; conferir a tabela de rotas do build.
- [ ] **Step 3: Verificação real** contra o backend local (`develop` do backend, #143), com o front em `next dev` apontando para ele: (a) a seção lista as duas empresas da conta de teste, a ativa marcada; (b) cadastrar um CNPJ novo válido abre a empresa nova e ela aparece no seletor; (c) repetir o mesmo CNPJ dá o 409 sob o campo; (d) CNPJ inválido mostra o erro do `validarCnpj`; (e) reiniciar o backend com `LIMITE_EMPRESAS_PADRAO` igual ao número de empresas: o botão fica desligado, a frase do limite aparece e um cadastro forçado de outra aba devolve o 402 com a mensagem; (f) o analista (convidado de teste) vê a lista sem o formulário; (g) "Gerenciar empresas" no seletor abre a seção; (h) claro, escuro e menu recolhido sem quebra de layout. Guardar capturas para você.
- [ ] **Step 4: Commit** `docs: empresas clientes no CLAUDE.md (#169)` e anotar na descrição do PR o que a verificação real cobriu e o que não cobriu.
