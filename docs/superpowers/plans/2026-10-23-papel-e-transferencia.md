# Troca de papel e transferência de administração Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O administrador troca o papel das outras pessoas (gestor ou analista) e transfere a administração, pela aba Equipe da tela Empresas.

**Architecture:** Duas Server Actions em `equipe/acoes.ts` (`PATCH /empresa/usuarios/{id}` e `POST /empresa/admin/transferencia`); a etiqueta do papel vira um menu (`MenuDePapel`) na linha da pessoa; a transferência é uma janela modal (`ModalDaTela`) com a confirmação por senha; `temSenha` entra no contexto da conta.

**Tech Stack:** Next.js 16 (Server Actions), React 19, Vitest + Testing Library, CSS global.

**Spec:** `docs/superpowers/specs/2026-10-23-papel-e-transferencia-design.md`

## Global Constraints

- Texto da tela em português do Brasil; nada de pronome inferido pelo nome de alguém ("a pessoa", o nome).
- O front nunca chama o backend do navegador: só Server Actions por `chamarBackend`; Server Action é endpoint público, então valida UUID e papel.
- Só o administrador troca papel e transfere; o analista e o gestor nunca veem os controles.
- Dentro de `app/(app)/e/[empresa]`: navegação só por `LinkDoApp`, `useRoteador()` e `redirecionarNoApp()`; o guarda `lib/rotas.guarda.test.ts` continua verde.
- Reusar as classes do design system e a janela `ModalDaTela`; rótulo em caixa alta com +0,08em (`guia-de-estilo.test.ts`); faixas de rolagem lateral definem `overflow-y`.
- Antes de cada commit: `npm run test && npm run lint && npm run build`. Mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A transferência com duplo envio sai uma vez só (a trava é um `ref`, antes do primeiro `await`).
- Escolher o papel que a pessoa já tem não chama o backend.
- O 403 numa troca ou transferência (o papel mudou por fora) relê a equipe e a página, e a tela não fica oferecendo o que o backend recusaria.
- Conta só do Google: nenhum campo de senha é enviado nem pedido; o 409 do login recente aparece na janela.
- Depois da transferência, a tela de quem foi rebaixado perde os controles de administrador sem recarregar à mão.
- O menu de papel não abre na linha do próprio administrador nem na de outro admin, e fecha com Esc e clique fora.

---

### Task 1: As ações `trocarPapel` e `transferirAdmin`

**Files:**
- Modify: `app/(app)/e/[empresa]/equipe/acoes.ts`
- Test: `app/(app)/e/[empresa]/equipe/acoes.test.ts`

**Interfaces:**
- Consumes: `chamarBackend`, `ErroBackend`, `pareceUuid`, `adaptarPessoa`, `ehPapel`, `recusaNaDemonstracao`, `traduzir`, `Falha`, `Resultado` (já no arquivo).
- Produces:
  - `trocarPapel(id: string, papel: Papel): Promise<Resultado<Pessoa>>` — `PATCH /empresa/usuarios/{id}` com `{ papel }`; só `gestor` ou `analista` seguem ao backend.
  - `transferirAdmin(usuarioId: string, senhaAtual: string | null): Promise<Resultado<Pessoa[]>>` — `POST /empresa/admin/transferencia` com `{ usuario_id, senha_atual? }` (sem `senha_atual` quando `null`); devolve as pessoas da lista `{ itens }` adaptadas.

- [ ] **Step 1: Write the failing tests** (mesmo esqueleto dos testes existentes de `convidar`/`removerPessoa`, `chamarBackend` mockado, `ErroBackend` real):
  - `trocarPapel`: manda `PATCH` no caminho `/empresa/usuarios/<id>` com `{ papel: "gestor" }` e devolve a pessoa adaptada (`papel` em `lerPapel`); `papel: "admin"` ou `"qualquer"`, e id que não é UUID, são recusados antes do backend (422 e 404); na demonstração recusa sem chamar o backend.
  - `transferirAdmin`: manda `POST` com `{ usuario_id, senha_atual: "x" }`; com `null` manda só `{ usuario_id }`; devolve a lista adaptada; id inválido e demonstração recusados antes do backend.
  - Traduções: 400 → o `detalhe` do backend ("Senha atual incorreta."); 403 → "Seu papel na conta não permite fazer isso."; 404 → "Essa pessoa não está mais na conta."; 409 → o `detalhe`; 429 com `segundosParaTentar: 180` → "Muitas tentativas. Tente de novo em 3 minutos." (com 60: "…em 1 minuto.", sem: "…mais tarde."); 401 → "Sua sessão expirou. Entre de novo para continuar."; rede fora → status 0.
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/equipe/acoes.test.ts"` — Expected: FAIL (as funções não existem).
- [ ] **Step 3: Implement** as duas funções no padrão de `convidar` e `removerPessoa`, com o 404 e o 429 novos em `traduzir` (parâmetro de contexto já existe para o convite; estender sem mudar o comportamento atual).
- [ ] **Step 4: Run** o mesmo teste — Expected: PASS.
- [ ] **Step 5: Commit** `feat(equipe): ações de trocar papel e transferir administração (#169)`.

### Task 2: `temSenha` no contexto da conta

**Files:**
- Modify: `app/(app)/e/[empresa]/conta.tsx`, `app/(app)/e/[empresa]/shell.tsx`
- Test: `app/(app)/e/[empresa]/conta.test.tsx`

**Interfaces:**
- Produces: `ProvedorDaConta` aceita `temSenha?: boolean` (padrão `true`); `useTemSenha(): boolean` (`true` fora do provedor). O `Shell` passa o `temSenha` que já recebe.

- [ ] **Step 1: Write the failing test** em `conta.test.tsx`: `useTemSenha()` dentro de `<ProvedorDaConta preferencias={null} temSenha={false}>` devolve `false`; sem a prop e fora do provedor, `true`.
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/conta.test.tsx"` — Expected: FAIL.
- [ ] **Step 3: Implement** o contexto novo e a passagem no `Shell` (mesmo desenho do `email`).
- [ ] **Step 4: Run** o mesmo teste e `shell.test.tsx` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(conta): temSenha no contexto da conta (#169)`.

### Task 3: O menu de papel e a troca de papel

**Files:**
- Create: `app/(app)/e/[empresa]/empresas/menu-de-papel.tsx`
- Modify: `app/(app)/e/[empresa]/empresas/painel-da-equipe.tsx`, `app/globals.css`
- Test: `app/(app)/e/[empresa]/empresas/painel-da-equipe.test.tsx`

**Interfaces:**
- Consumes: `trocarPapel` (Task 1), `usePapel`, `useEmail`, `ROTULO_DO_PAPEL`, `DESCRICAO_DO_PAPEL` (hoje interna de `painel-da-equipe.tsx`; passa a ser exportada de lá).
- Produces: `MenuDePapel({ pessoa, ocupado, aoEscolher, aoTransferir })` — o botão da etiqueta com seta, `aria-haspopup="menu"`, e o menu com os itens `Gestor`, `Analista` (`role="menuitemradio"`, o atual com `aria-checked`) e `Tornar administrador…`; `aoEscolher(papel)` e `aoTransferir()` são callbacks. O painel guarda por pessoa o estado "salvando" e o erro.

- [ ] **Step 1: Write the failing tests** (no harness de `painel-da-equipe.test.tsx`, com `trocarPapel` e `transferirAdmin` no mock de `../equipe/acoes`): o admin vê um botão de papel na linha da Bia (analista) e da Gil (gestor), e **nenhum** na própria linha nem na de outro admin; o gestor e o analista veem só a etiqueta; o menu mostra Gestor e Analista com as descrições, o atual marcado, e "Tornar administrador…" depois de um filete; escolher o papel atual fecha o menu e não chama `trocarPapel`; escolher outro chama `trocarPapel("u2", "gestor")`, mostra "Salvando…" na linha, troca a etiqueta para o papel novo e chama `router.refresh()`; erro 409/404 do backend aparece na linha e o papel volta; 403 recarrega a equipe; 401 vai ao login; Esc e um clique fora fecham o menu; as setas andam entre os itens; só um menu aberto por vez.
- [ ] **Step 2: Run** `npx vitest run "app/(app)/e/[empresa]/empresas/painel-da-equipe.test.tsx"` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implement** `MenuDePapel` e a ligação na linha (o admin, nas pessoas que não são ele nem admin); CSS `.equipe-papel-botao`, `.equipe-menu`, `.equipe-menu-item`, o filete, com entrada suave só para quem não pediu menos movimento (o teste de CSS do guia cobre a animação da janela; o do menu entra no mesmo teste).
- [ ] **Step 4: Run** o mesmo teste, `lib/rotas.guarda.test.ts`, `guia-de-estilo.test.ts` e eslint — Expected: PASS.
- [ ] **Step 5: Commit** `feat(equipe): o administrador troca o papel das pessoas pelo menu (#169)`.

### Task 4: A janela de transferência da administração

**Files:**
- Create: `app/(app)/e/[empresa]/empresas/transferir-admin.tsx`
- Modify: `app/(app)/e/[empresa]/empresas/painel-da-equipe.tsx`, `app/globals.css`
- Test: `app/(app)/e/[empresa]/empresas/painel-da-equipe.test.tsx`

**Interfaces:**
- Consumes: `transferirAdmin` (Task 1), `useTemSenha` (Task 2), `ModalDaTela`, `MensagemErro`.
- Produces: `TransferirAdmin({ pessoa, aoConcluir, aoFechar, aoSairDaSessao })`; `aoConcluir(pessoas: Pessoa[])` recebe a lista nova. O painel, ao concluir: troca a lista, fecha a janela, chama `router.refresh()` e mostra "X agora é o administrador da conta. Você é Gestor." num aviso `role="status"`.

- [ ] **Step 1: Write the failing tests:** "Tornar administrador…" abre a janela "Transferir administração" com o aviso "X passa a ser o administrador da conta e você passa a ser Gestor. Só o novo administrador pode desfazer isso."; na conta com senha o campo **Senha atual** é obrigatório (vazio não chama a ação e mostra "Digite a sua senha atual."); `transferirAdmin("u2", "segredo")` com o valor digitado; na conta só do Google (`temSenha={false}`) não há campo e a ação recebe `null`; 400 aparece sob o campo e mantém a janela aberta; 409 e 429 aparecem na janela com os textos da Task 1; **dois envios no mesmo instante chamam a ação uma vez** (`requestSubmit` duas vezes dentro de um `act`) e o botão diz "Transferindo…" e fica desligado; sucesso fecha a janela, troca a lista (Bia vira "Administrador" e a própria pessoa vira "Gestor"), chama `router.refresh()` e mostra o aviso; Esc, Cancelar e clique no fundo fecham sem chamar a ação; 401 vai ao login; 403 e 404 fecham a janela, mostram o erro na aba e recarregam a equipe.
- [ ] **Step 2: Run** o teste — Expected: FAIL.
- [ ] **Step 3: Implement** `TransferirAdmin` (formulário no padrão de `CadastrarEmpresa`: trava por `ref`, erros por campo, senha com `type="password"` e `autoComplete="current-password"`), a ligação no painel e o aviso de sucesso.
- [ ] **Step 4: Run** o mesmo teste, o guarda de rotas e eslint — Expected: PASS.
- [ ] **Step 5: Commit** `feat(equipe): transferência da administração com confirmação (#169)`.

### Task 5: Ajuda, documentação e verificação real

**Files:**
- Modify: `app/(ajuda)/ajuda/paginas.ts`, `app/(ajuda)/ajuda/central.test.tsx`, `CLAUDE.md`

- [ ] **Step 1: Write the failing test** em `central.test.tsx`: a função `equipe` da página `empresas` cita **Equipe**, **Convidar pessoa**, **Remover**, o menu de papel (**Tornar administrador**) e a confirmação por senha na transferência, e diz que quem transfere vira Gestor.
- [ ] **Step 2: Run** `npx vitest run "app/(ajuda)"` — Expected: FAIL.
- [ ] **Step 3: Implement** os textos e atualizar o `CLAUDE.md` (o bullet de equipe e convites: o papel editável, a transferência e `useTemSenha`; sai o "Not built yet").
- [ ] **Step 4: Run** `npx vitest run "app/(ajuda)"` — Expected: PASS.
- [ ] **Step 5: Suíte completa:** `npm run test && npm run lint && npm run build` — Expected: verdes.
- [ ] **Step 6: Verificação real** contra o backend local, com uma segunda pessoa inserida no banco local (backup antes): trocar papel, escolher o mesmo, transferir com senha errada e com a certa, a tela de quem foi rebaixado sem controles, a de quem virou administrador com eles; claro, escuro e celular por captura.
- [ ] **Step 7: Revisão final** da branch por revisor independente, um passe de correções com teste, `git push` e o PR empilhado no #204 (base `feat/empresas-na-configuracao`, que muda para `develop` quando o #204 for mergeado).
