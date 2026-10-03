# Conciliação em rodadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Comparação direta vira a tela de uma conciliação em rodadas (o mesmo extrato do banco, versões novas do extrato do sistema), com conferência e justificativa por linha.

**Architecture:** Parte A, só frontend: as rodadas saem de `/execucoes` (funções puras em `lib/rodadas.ts`), uma Server Action carrega a rodada pedida e a comparação com a anterior, e uma janela na tela envia a nova versão do extrato do sistema. Parte B: o modelo de decisão (`Decisao`, `EventoDecisao`) entra em `LinhaComparacao`, a situação de cada linha sai de uma função pura, e as ações gravam no mock em memória ou na rota proposta ao backend, ligadas só quando os itens trazem o campo `decisao`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Vitest + Testing Library, CSS em `app/globals.css`, ícones `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-02-conciliacao-em-rodadas-design.md`

## Global Constraints

- Textos da tela, exatamente: "Enviar nova versão do extrato do sistema", "rodada N", "Rodada N de M · ver a mais recente", "Desde a rodada N: X passaram a bater · Y continuam divergindo · Z novas divergências" (singular: "1 passou a bater", "1 continua divergindo", "1 nova divergência"), "Justificada", "Justificar", "Desfazer justificativa", "Fica no registro com o seu nome e o horário. Desfazer depois gera um novo registro.", "Conferida na rodada N, continua divergindo depois da nova versão", filtros "Todos (n)", "Só revisão (n)", "Justificadas (n)", progresso "X de Y conferidas".
- A tela não finge que salva: com dado do backend, caixa e "Justificar" só aparecem quando os itens trazem a chave `decisao` (mesmo `null`). Rodada antiga é só leitura (nem caixa, nem "Justificar", nem "Enviar nova versão").
- O status do motor nunca muda por decisão; "Justificada" é exibição sobre ele.
- Guia de estilo (`app/(app)/guia-de-estilo.test.ts`): nada de `fontFamily`/`textTransform` inline, `fontSize` inline ≥ 20 só em h1–h3 ou `.font-titulo`, ícones sem `strokeWidth` literal (o `LucideProvider` do shell já passa o traço).
- Não rodar o prettier sobre arquivos inteiros; editar no estilo do arquivo.
- Antes de cada commit: `npm run test && npm run lint && npm run build`. Mensagens no estilo do repositório (`feat:`, `fix:`, `refactor:`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Extrato do banco sem nenhuma execução nas primeiras páginas de `/execucoes` (conciliação antiga): a tela abre como hoje, sem rodada, em vez de "não encontrada" — teste na Task 4.
2. Duas linhas só do sistema idênticas (mesma data, valor e descrição): chaves diferentes, para não dividirem a justificativa — teste na Task 1.
3. Conciliar o mesmo par de novo (mesmo extrato do sistema) não cria rodada — teste na Task 2.
4. Justificativa que falha ao salvar: o texto fica no campo e o botão não manda duas vezes enquanto salva — teste na Task 12.
5. URL de rodada antiga: nada de caixa, "Justificar" ou "Enviar nova versão" — testes nas Tasks 5 e 11.

---

## Parte A — rodadas

### Task 0: Fechar a rodada de tela anterior e abrir a branch

**Files:** nenhum novo.

- [ ] **Step 1:** Em `feat/status-no-centro`, rodar `npm run test && npm run lint && npm run build`. Esperado: tudo verde.
- [ ] **Step 2:** Commit das mudanças de tela já feitas (status no eixo, compacta como padrão, balão no eixo, explicação por linha, descrições e valores longos), **sem** o spec e este plano:

```bash
git add app lib
git commit -m "feat: status no eixo da comparação, balão maior e descrições numa linha"
```

- [ ] **Step 3:** `git switch -c feat/conciliacao-em-rodadas` e commit do spec e do plano (`docs: conciliação em rodadas`).

### Task 1: A chave estável de cada linha

**Files:**
- Modify: `lib/mock-data.ts` (`LinhaComparacao`), `lib/adaptadores.ts` (`ItemConciliacaoAPI`, `adaptarLinha`, `adaptarConciliacao`)
- Create: `lib/rodadas.ts` (só `chaveDaLinha` nesta task)
- Test: `lib/adaptadores.test.ts`, `lib/rodadas.test.ts`

**Interfaces:**
- Produces: `LinhaComparacao.chave?: string`; `ItemConciliacaoAPI.chave?: string`; `chaveDaLinha(linha: LinhaComparacao): string` (devolve `linha.chave ?? linha.id`; o mock não tem chave).

- [ ] **Step 1: Testes que falham** em `lib/adaptadores.test.ts`:
  - `"a chave é o lançamento do banco, que é o mesmo em todas as rodadas"`: `adaptarConciliacao(lista com item()).linhas[0].chave` é `"b:lb-1"`.
  - `"sem banco, a chave é data, valor e descrição do sistema"`: item com `lancamento_banco: null` e sistema `{ data: "2026-09-12", valor: "-980.00", descricao: "  Estorno  Maquininha " }` → `"s:2026-09-12|-980.00|estorno maquininha"`.
  - `"duas linhas só do sistema iguais não dividem a chave"`: dois itens assim → `"s:…|estorno maquininha"` e `"s:…|estorno maquininha#2"`.
  - `"prefere a chave que o backend mandar"`: `item({ chave: "k-1" })` → `"k-1"`.
  - Em `lib/rodadas.test.ts`: `chaveDaLinha({ ...linha, chave: undefined })` devolve `linha.id`.
- [ ] **Step 2:** `npx vitest run lib/adaptadores.test.ts lib/rodadas.test.ts` — FAIL.
- [ ] **Step 3:** Implementar. A chave base sai em `adaptarLinha` (`b:` + id do banco; senão `s:` + data + `|` + valor com duas casas + `|` + descrição em minúsculas, sem espaços nas pontas e com espaços repetidos reduzidos); `adaptarConciliacao` acrescenta `#2`, `#3`… às repetidas, na ordem em que chegam. `item.chave` do backend vence.
- [ ] **Step 4:** Rodar de novo — PASS.
- [ ] **Step 5:** Commit `feat: chave estável por linha da conciliação`.

### Task 2: Rodadas e comparação entre rodadas (funções puras)

**Files:**
- Modify: `lib/rodadas.ts`
- Test: `lib/rodadas.test.ts`

**Interfaces:**
- Consumes: `Execucao` (`lib/adaptadores.ts`), `chaveDaLinha` (Task 1), `estaResolvida` (`app/(app)/dashboard/resumo.ts`).
- Produces:
  - `type Rodada = { numero: number; extratoSistemaId: string; arquivoSistema: string; execucao: Execucao }` — `execucao` é a mais recente daquele par.
  - `rodadasDoBanco(execucoes: Execucao[], extratoBancoId: string): Rodada[]` — numeradas de 1 pela primeira execução de cada extrato do sistema, em ordem crescente.
  - `execucoesVigentes(execucoes: Execucao[]): Execucao[]` — as atuais da última rodada de cada extrato do banco, na ordem recebida.
  - `type Mudancas = { passaramABater: number; continuamDivergindo: number; novas: number }`
  - `compararRodadas(anterior: LinhaComparacao[], atual: LinhaComparacao[]): Mudancas` — por chave: divergente antes e não mais (bateu ou saiu do extrato do sistema) = passou a bater; divergente nas duas = continua; divergente agora e não antes (ou ausente antes) = nova.

- [ ] **Step 1: Testes que falham:**
  - `"numera as rodadas pela primeira execução de cada extrato do sistema"`: execuções do banco B com sistemas S1 (23/09) e S2 (24/09) → `[1: S1, 2: S2]`.
  - `"conciliar o mesmo par de novo não cria rodada"`: S2 executado duas vezes (uma `atual: false`) → duas rodadas, a 2 com a execução `atual`.
  - `"ignora as execuções de outro extrato do banco"`.
  - `"vigentes: só a última rodada de cada banco"`: B com S1 e S2 (ambos `atual: true`) e B2 com S3 → `[S2, S3]` na ordem recebida.
  - `"compara as rodadas pela chave"`: anterior `[k1 divergente, k2 divergente, k3 divergente, k4 match]`, atual `[k1 match, k2 divergente, k5 divergente, k4 divergente]` → `{ passaramABater: 2, continuamDivergindo: 1, novas: 2 }` (k3 saiu; k4 e k5 são novas).
- [ ] **Step 2:** `npx vitest run lib/rodadas.test.ts` — FAIL.
- [ ] **Step 3:** Implementar as quatro funções com as assinaturas acima.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: rodadas de uma conciliação a partir das execuções`.

### Task 3: Contar só a rodada vigente

**Files:**
- Modify: `app/(app)/conciliacoes/acoes.ts` (`carregarPainel`, `carregarVisaoGeral`, `carregarFechamentos`), `app/(app)/visao-geral/page.tsx:167`
- Test: `app/(app)/conciliacoes/acoes.test.ts`, `app/(app)/visao-geral/page.test.tsx`

**Interfaces:**
- Consumes: `execucoesVigentes` (Task 2).

- [ ] **Step 1: Testes que falham** em `acoes.test.ts` (helper novo `duasRodadas()`: banco `BANCO_RECENTE` com sistema v1 em 23/09 e v2 em 24/09, os dois `atual: true`):
  - `carregarFechamentos`: `"conta um par por extrato do banco: a versão nova do sistema substitui a antiga"` → um par, com o sistema v2.
  - `carregarPainel`: `anteriores` não traz a v1.
  - `carregarVisaoGeral`: `recente.execucao.extratoSistemaId` é a v2.
  - Em `visao-geral/page.test.tsx`: o contador de pares conciliados conta 1 com as duas rodadas.
- [ ] **Step 2:** Rodar os dois arquivos — FAIL.
- [ ] **Step 3:** Trocar os `filter((execucao) => execucao.atual)` e o `find` desses pontos por `execucoesVigentes(...)`. O Histórico e a tela de Extratos continuam vendo todas. Os links dessas telas não mudam: saindo de execuções vigentes, o `?sistema=` já é o da rodada mais recente, e assim a tela não precisa procurá-la de novo.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `fix: a versão nova do extrato do sistema substitui a antiga nas contagens`.

### Task 4: Carregar a conciliação na rodada pedida

**Files:**
- Modify: `app/(app)/conciliacoes/acoes.ts`, `app/(app)/conciliacoes/usar-conciliacao.ts`
- Modify (mocks de teste): `app/(app)/conciliacoes/[id]/page.test.tsx`, `app/(app)/conciliacoes/[id]/[linha]/page.test.tsx`
- Test: `app/(app)/conciliacoes/acoes.test.ts`

**Interfaces:**
- Consumes: `rodadasDoBanco`, `compararRodadas`, `Mudancas` (Task 2); `carregarConciliacao`, `listarExecucoes`.
- Produces:
  - `type RodadaVista = { numero: number; total: number; extratoSistemaId: string; arquivoSistema: string; executadaEm: string }`
  - `carregarConciliacaoEmRodadas(extratoBancoId: string, extratoSistemaId?: string): Promise<Resultado<{ conciliacao: Conciliacao; truncada: boolean; rodada: RodadaVista | null; mudancas: Mudancas | null }>>` — lê até 3 páginas de `/execucoes` (para antes, se uma página vier incompleta); sem `extratoSistemaId` abre a última rodada; `conciliacao.extratoSistemaId` é o da rodada aberta; `mudancas` só na última rodada, a partir da 2, e `null` se a anterior falhar ou vier truncada. Sem rodada achada, cai em `carregarConciliacao(extratoBancoId, extratoSistemaId)` com `rodada: null`. ponytail no código: um filtro `?extrato_banco_id=` em `/execucoes` substitui a varredura.
  - `EstadoConciliacao` "pronta" ganha `rodada: RodadaVista | null` e `mudancas: Mudancas | null` (`null` no mock); `useConciliacao` passa a devolver também `recarregar: () => void`.

- [ ] **Step 1: Testes que falham** (`describe("carregarConciliacaoEmRodadas")`):
  - `"sem o sistema na URL, abre a rodada mais recente"`: com `duasRodadas()`, pede as linhas com `extrato_sistema_id` da v2; `rodada` = `{ numero: 2, total: 2, … }`.
  - `"com o sistema de uma rodada antiga, abre aquela, sem comparação"`: `rodada.numero` 1, `mudancas` null.
  - `"compara com a rodada anterior"`: itens da v1 com uma divergência que na v2 bate → `mudancas.passaramABater` 1.
  - `"sem execução do extrato, abre como antes, sem rodada"` (Review Focus 1): `/execucoes` sem o banco → `ok: true`, `rodada: null`, pediu `/conciliacoes/{banco}` sem `extrato_sistema_id`.
- [ ] **Step 2:** `npx vitest run "app/(app)/conciliacoes/acoes.test.ts"` — FAIL.
- [ ] **Step 3:** Implementar a action e trocar a chamada em `useConciliacao` (com `recarregar` incrementando um contador nas dependências do efeito). Nos dois testes de tela, o mock de `../acoes` (e `../../acoes`) passa a expor `carregarConciliacaoEmRodadas`, que embrulha o `carregarConciliacao` mockado com `rodada: null, mudancas: null`.
- [ ] **Step 4:** `npm run test` — PASS.
- [ ] **Step 5:** Commit `feat: a conciliação abre na rodada mais recente do extrato do banco`.

### Task 5: Rodada, aviso de rodada antiga e faixa do que mudou

**Files:**
- Modify: `app/(app)/conciliacoes/[id]/page.tsx`, `app/globals.css`
- Test: `app/(app)/conciliacoes/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `estado.rodada`, `estado.mudancas` (Task 4); `formatarDataHora` (`dashboard/resumo.ts`); `caminhoDaConciliacao`.

- [ ] **Step 1: Testes que falham** (o mock da action devolve `rodada`/`mudancas` por teste):
  - `"diz a rodada no contexto quando há mais de uma"`: `rodada { numero: 2, total: 2, arquivoSistema: "erp-setembro-v2.csv", executadaEm: "2026-09-24T17:02:00Z" }` → o contexto tem `rodada 2 · erp-setembro-v2.csv, 24/09/2026 14:02`; com `total: 1`, não tem "rodada".
  - `"avisa a rodada antiga e leva à mais recente"`: `numero: 1, total: 2` → `role="status"` com "Rodada 1 de 2", link "ver a mais recente" para `/conciliacoes/{banco}`.
  - `"conta o que mudou desde a rodada anterior"`: `mudancas { passaramABater: 4, continuamDivergindo: 2, novas: 1 }` → texto "Desde a rodada 1: 4 passaram a bater · 2 continuam divergindo · 1 nova divergência"; com `{1, 1, 3}` → "1 passou a bater · 1 continua divergindo · 3 novas divergências".
- [ ] **Step 2:** Rodar o arquivo — FAIL.
- [ ] **Step 3:** Implementar no topo do corpo da tela (acima do relatório); a faixa usa uma classe nova `.rodada-faixa` (fundo `var(--tinta-ativa)`, 13.5px, `--radius-sm`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: rodada e o que mudou na comparação`.

### Task 6: O envio de um extrato, fora da tela de nova conciliação

**Files:**
- Create: `app/(app)/conciliacoes/envio.ts`
- Modify: `app/(app)/conciliacoes/nova/page.tsx`
- Test: `app/(app)/conciliacoes/nova/page.test.tsx` (sem mudar; prova a refatoração)

**Interfaces:**
- Produces (movidos da página, mesmo comportamento): `TAMANHO_MAXIMO_BYTES`, `ERRO_SEM_RESPOSTA`, `RECADO`, `type Etapa`, `type Origem`, `type Pendente`, `subir(arquivo: File, origem: Origem)`, `aguardarProcessamento(extratoId: string, vivo: () => boolean): Promise<SituacaoExtrato | Falha | null>`, `motivoDaRecusa(situacao: SituacaoExtrato): string`, `conferirCsv(arquivo: File): Promise<{ pronto: true } | { pronto: false; erro: string } | { pronto: false; pendente: Pendente }>`.

- [ ] **Step 1:** Mover as funções para `envio.ts` (sem `"use server"`: são do cliente e chamam as actions) e importar na página.
- [ ] **Step 2:** `npx vitest run "app/(app)/conciliacoes/nova"` — PASS sem tocar nos testes.
- [ ] **Step 3:** Commit `refactor: envio de extrato reaproveitável fora da tela de nova conciliação`.

### Task 7: Janela "Enviar nova versão do extrato do sistema"

**Files:**
- Create: `app/(app)/conciliacoes/[id]/nova-versao.tsx`
- Modify: `app/(app)/conciliacoes/[id]/page.tsx`, `app/globals.css`
- Test: `app/(app)/conciliacoes/[id]/nova-versao.test.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `envio.ts` (Task 6), `conciliar` (`acoes.ts`), `ImportacaoInterrompida` (`nova/importacao-interrompida.tsx`), `recarregar` (Task 4).
- Produces: `NovaVersao({ extratoBancoId, onConcluida }: { extratoBancoId: string; onConcluida: () => void })` — botão "Enviar nova versão do extrato do sistema" que abre um `<dialog>` com `showModal` (como `EspiaDaLinha`): campo de arquivo (`.csv,.pdf`), "Enviar e conciliar", o recado da etapa, erros em `role="alert"`, avisos de linhas não lidas, e o mapeamento de colunas dentro da janela quando o CSV pede.

- [ ] **Step 1: Testes que falham** (`nova-versao.test.tsx`, actions mockadas como em `nova/page.test.tsx`):
  - `"envia só o extrato do sistema e concilia com o banco desta tela"`: `enviarExtrato` uma vez com `origem=sistema`; `conciliar(BANCO, idNovo)`; `onConcluida` chamado.
  - `"recusa arquivo acima de 4MB sem enviar"`.
  - `"mostra por que o backend não leu o arquivo"`: situação `erro` → o texto de `motivoDaRecusa`.
  - `"sessão expirada volta para o login"`: 401 → `push("/login")`.
  - Em `page.test.tsx`: o botão aparece na rodada mais recente de conciliação do backend, e **não** aparece no mock nem em rodada antiga (Review Focus 5).
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3:** Implementar. Na tela, `onConcluida` faz `router.replace(caminhoDaConciliacao(id))` e `recarregar()`; o botão fica nas ações do `Cabecalho`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: nova versão do extrato do sistema na própria comparação`.

### Task 8: Ver a Parte A rodando

**Files:** backend de demonstração (`<scratchpad>/backend-demo.mjs`, fora do repositório).

- [ ] **Step 1:** No backend de demonstração, dar ao par `sicredi-setembro × erp-setembro.csv` (rodada 1) itens próprios: as mesmas linhas, com três divergências a mais que a v2 resolve e uma que continua.
- [ ] **Step 2:** No navegador, em 1440px: `/conciliacoes/{sicrediSet}` abre a rodada 2 com "rodada 2 · erp-setembro-v2.csv" e a faixa; `?sistema={erpSet}` mostra "Rodada 1 de 2 · ver a mais recente"; enviar um CSV pela janela cria a rodada 3 e a tela recarrega nela. Fechamentos conta setembro uma vez.
- [ ] **Step 3:** 375px: faixa e aviso quebram sem rolagem lateral.

## Parte B — conferência e justificativa

### Task 9: O modelo da decisão e a situação de cada linha

**Files:**
- Modify: `lib/mock-data.ts`, `lib/adaptadores.ts`, `app/(app)/conciliacoes/acoes.ts` (`carregarConciliacaoEmRodadas` preenche `conciliacao.rodada` com `rodada.numero`)
- Create: `app/(app)/conciliacoes/[id]/situacao.ts`
- Test: `lib/adaptadores.test.ts`, `app/(app)/conciliacoes/[id]/situacao.test.ts`, `acoes.test.ts`

**Interfaces:**
- Produces (`lib/mock-data.ts`):
  - `type TipoEvento = "conferida" | "conferencia_desfeita" | "justificada" | "justificativa_desfeita"`
  - `type Decisao = { tipo: "conferida" | "justificada"; texto: string | null; autor: string; em: string; rodada: number }`
  - `type EventoDecisao = { tipo: TipoEvento; texto: string | null; autor: string; em: string; rodada: number }`
  - `LinhaComparacao.decisao?: Decisao | null`, `LinhaComparacao.eventos?: EventoDecisao[]`, `Conciliacao.rodada?: number` (1 quando ausente).
- Produces (`situacao.ts`):
  - `type Situacao = "bate" | "a_conferir" | "conferida" | "justificada"`
  - `situacaoDaLinha(linha: LinhaComparacao, rodada: number): Situacao` — resolvida → bate; decisão justificada → justificada; decisão conferida **desta** rodada → conferida; senão a conferir.
  - `continuaDivergindo(linha, rodada): boolean` — divergente com decisão conferida de rodada anterior.
  - `decisoesLigadas(conciliacao: Conciliacao, real: boolean): boolean` — `!real` ou alguma linha com a chave `decisao` presente.

- [ ] **Step 1: Testes que falham:** a tabela da decisão 3 do spec, um caso por linha (bate; a conferir; conferida na rodada 2 vista na 2; conferida na 1 vista na 2 → a conferir e `continuaDivergindo`; justificada na 1 vista na 2 → justificada; justificada numa linha que passou a bater → bate). Adaptador: `"lê a decisão e os eventos que o backend mandar"` e `"sem o campo, a linha não tem decisão (undefined, não null)"`. Action: `carregarConciliacaoEmRodadas` devolve `conciliacao.rodada` 2 na rodada 2. `decisoesLigadas`: mock true; real com `decisao: null` true; real sem o campo false.
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3:** Implementar (adaptador copia `decisao` e `eventos` só quando a chave existe no item).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: decisão por linha e a situação que ela dá`.

### Task 10: Filtros, relatório e contagens com as justificadas

**Files:**
- Modify: `app/(app)/conciliacoes/[id]/ordenar.ts`, `app/(app)/conciliacoes/[id]/relatorio.tsx`, `app/(app)/conciliacoes/[id]/page.tsx`
- Test: `ordenar.test.ts`, `relatorio.test.ts`, `page.test.tsx`

**Interfaces:**
- Consumes: `situacaoDaLinha` (Task 9).
- Produces: `type Filtro = "todos" | "revisao" | "justificadas" | Divergencia`; `filtrarLinhas(linhas, filtro, rodada = 1)` — "revisao" = a conferir + conferidas; "justificadas" = justificadas; categoria = da categoria, fora as justificadas. `Relatorio` recebe `justificadas: number` e soma só o que pede revisão.

- [ ] **Step 1: Testes que falham:** `filtrarLinhas` nos três filtros com uma linha justificada; relatório `"2 linhas pedem revisão · R$ … em aberto · 1 justificada"`; na tela, com decisões ligadas, os botões "Todos (n)", "Só revisão (n)", "Justificadas (n)" e o texto "1 de 2 conferidas"; sem decisões ligadas, só "Todos" e "Só revisão", como hoje.
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3:** Implementar; o `?status=` da URL continua aceitando só categorias.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: justificadas fora do que pede revisão`.

### Task 11: Conferir no eixo, com o mock e com a rota do backend

**Files:**
- Modify: `lib/mock-data.ts`, `app/(app)/conciliacoes/acoes.ts`, `app/(app)/conciliacoes/[id]/page.tsx`, `app/(app)/conciliacoes/[id]/cartao-lancamento.tsx`, `app/globals.css`
- Create: `app/(app)/conciliacoes/[id]/decidir.ts`
- Test: `lib/mock-data.test.ts` (criar se não existir), `acoes.test.ts`, `page.test.tsx`, `cartao-lancamento.test.tsx`

**Interfaces:**
- Produces:
  - `registrarDecisaoNoMock(conciliacaoId: string, chave: string, tipo: TipoEvento, texto: string | null): Conciliacao | null` — acrescenta o evento (autor "Você", rodada 1, `em` = agora) e atualiza a `decisao` (as desfeitas zeram para `null`).
  - `registrarDecisao(extratoBancoId: string, chave: string, tipo: TipoEvento, texto?: string): Promise<Resultado<Decisao | null>>` — `POST /conciliacoes/{id}/decisoes` com `{ chave, tipo, texto }`; 404 vira "Esta linha mudou: a conciliação foi refeita depois que a tela abriu."
  - `decidir(args: { conciliacao: Conciliacao; real: boolean; linha: LinhaComparacao; tipo: TipoEvento; texto?: string }): Promise<{ ok: true; conciliacao: Conciliacao } | { ok: false; status: number; erro: string }>` — o mock ou a action, e a conciliação com a linha atualizada.
- Tela: na célula do status, com decisões ligadas, rodada vigente e linha divergente: `<button aria-pressed aria-label="Marcar {descrição} como conferida">` (ícone `Check` quando marcada); linha conferida com `data-situacao="conferida"` (selo neutro, texto apagado); ↻ (`RotateCw`, dourado, com texto para leitor de tela) quando `continuaDivergindo`; justificada mostra o selo "Justificada". Marcar é otimista: falhou, volta e mostra o erro em `role="alert"` acima da tabela; 401 vai ao login; 404 recarrega com o aviso.
- Balão: na justificada, "Justificada por {autor} em {data e hora}" e o texto; na que continua divergindo, "Conferida na rodada {n}, continua divergindo depois da nova versão"; o rótulo vira "{rótulo} · justificada".

- [ ] **Step 1: Testes que falham:** mock registra e desfaz; action chama o caminho e o corpo certos e traduz o 404; na tela (mock): marcar a caixa deixa `aria-pressed="true"` e o progresso "1 de 2 conferidas"; com a action falhando (dado do backend com `decisao: null`), a caixa volta e aparece o erro; dado do backend **sem** `decisao` não mostra caixa; rodada antiga não mostra caixa (Review Focus 5); balão das duas notas.
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3:** Implementar. A coluna do eixo pode crescer para 10.5rem se a caixa e o selo não couberem; medir no navegador.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: conferência por linha no eixo da comparação`.

### Task 12: Justificar e desfazer na janela da linha

**Files:**
- Modify: `app/(app)/conciliacoes/[id]/page.tsx` (`EspiaDaLinha`), `app/globals.css`
- Test: `page.test.tsx`

**Interfaces:**
- Consumes: `decidir` (Task 11).
- Produces: `EspiaDaLinha` recebe `podeDecidir: boolean`, `onJustificar: (texto: string) => Promise<string | null>` e `onDesfazer: () => Promise<string | null>` (devolvem o erro, ou null).

- [ ] **Step 1: Testes que falham:**
  - `"justifica com texto e a linha vira Justificada"`: escrever no campo "Justificativa", clicar "Justificar" → o eixo mostra "Justificada"; o aviso "Fica no registro com o seu nome e o horário. Desfazer depois gera um novo registro." está na janela.
  - `"não justifica em branco"`: só espaços → o botão não chama `decidir` e o campo fica inválido (`aria-invalid`).
  - `"mantém o texto se falhar e não manda duas vezes"` (Review Focus 4): action pendente → botão `disabled` com `aria-busy`; rejeita → o texto continua no campo e o erro aparece.
  - `"desfaz a justificativa"`: linha justificada mostra o texto, quem e quando, e "Desfazer justificativa"; clicar volta a linha para A conferir.
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: justificar uma divergência, com registro`.

### Task 13: O histórico do lançamento no detalhe

**Files:**
- Modify: `app/(app)/conciliacoes/[id]/situacao.ts`, `app/(app)/conciliacoes/[id]/[linha]/page.tsx`
- Test: `situacao.test.ts`, `[linha]/page.test.tsx`

**Interfaces:**
- Produces: `historicoDaLinha(linha: LinhaComparacao, rodada: number): EventoHistorico[]` — os eventos de `linha.historico`, mais os de decisão: "Conferida por {autor}", "Conferência desfeita por {autor}", "Justificada por {autor}: {texto}", "Justificativa desfeita por {autor}", com " (rodada N)" a partir da 2, e "Continua divergindo (rodada N)" quando for o caso; `quando` = `formatarDataHora(em)`, `origem` "Ledgr".

- [ ] **Step 1: Testes que falham:** a lista na ordem dos eventos; o detalhe mostra "Justificada por Eduardo: Juros…" no "Histórico do lançamento".
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3:** Implementar e trocar `linha.historico` por `historicoDaLinha(...)` no detalhe.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: decisões no histórico do lançamento`.

### Task 14: Fechamentos com as justificadas

**Files:**
- Modify: `lib/adaptadores.ts` (`ExecucaoAPI.contagens.justificadas?: number`, `Execucao.justificadas: number`), `app/(app)/fechamentos/fechamento.ts`, `app/(app)/fechamentos/mesa.tsx`, `app/(app)/visao-geral/pendencias.ts`
- Test: `lib/adaptadores.test.ts`, `app/(app)/fechamentos/page.test.tsx`, `app/(app)/visao-geral/pendencias.test.ts`

**Interfaces:**
- Produces: `MesDeFechamento.justificadas: number`; `pronto` = divergentes − justificadas = 0 e nenhum arquivo com linha não lida.

- [ ] **Step 1: Testes que falham:** adaptador lê `justificadas` (0 quando não vem); um mês com 2 divergências, ambas justificadas, é "Pronto para fechar" e o painel diz "2 divergências justificadas"; com 1 de 2, continua com pendência. Na visão geral, uma linha justificada não entra em "Pede sua atenção".
- [ ] **Step 2:** Rodar — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: mês justificado pode fechar`.

### Task 15: Documentar e ver tudo rodando

**Files:**
- Modify: `CLAUDE.md` (seção "Backend status": conferência e justificativa só no mock; ligam quando os itens trouxerem `decisao`; a rota proposta é `POST /conciliacoes/{id}/decisoes`), `DESIGN.md` (o eixo com caixa e o selo "Justificada")
- Backend de demonstração: itens com `decisao: null`, `POST /conciliacoes/{id}/decisoes` em memória e `justificadas` nas contagens, para ver o fluxo real localmente.

- [ ] **Step 1:** Atualizar os dois documentos.
- [ ] **Step 2:** `npm run test && npm run lint && npm run build` — verde.
- [ ] **Step 3:** Navegador, 1440px claro e escuro e 375px: conferir, enviar nova versão (a conferida que continua divergindo volta com ↻), justificar e desfazer, histórico no detalhe, Fechamentos pronto com as justificadas. Contraste dos textos novos ≥ 4,5:1.
- [ ] **Step 4:** Commit `docs: conciliação em rodadas no CLAUDE.md e no DESIGN.md`.
