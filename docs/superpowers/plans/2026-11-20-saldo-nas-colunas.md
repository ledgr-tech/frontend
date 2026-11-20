# Saldo do banco no topo e no fim da coluna: plano de implementação (parte 1 da #474)

> **Para agentes:** sub-skill obrigatória: superpowers:subagent-driven-development (recomendada) ou superpowers:executing-plans, task a task. Os passos usam checkbox (`- [ ]`).

**Objetivo:** O saldo inicial do extrato do banco aparece no cabeçalho da coluna "Extrato do banco" e o saldo final no pé dessa coluna, para ninguém achar que é o saldo do sistema. O painel lateral e a faixa do topo deixam de repetir o saldo (issue ledgr-tech/frontend#474, parte do banco). O saldo do sistema e a diferença entram no PR 3, quando chegar o backend #238.

**Arquitetura:**
- **`saldo.tsx`:** ganha um componente `SaldoDaFolha` que mostra o saldo inicial ou o final de um extrato. Ele não precisa saber o lado: o texto é o mesmo nas duas folhas, e o PR 3 só passa o saldo do sistema na célula do sistema.
- **Tabela da comparação:** mostra o inicial na linha `folhas-titulos` do `thead` e o final num `tfoot` novo, cada um sob a sua folha.
- **No celular (≤680px):** o `thead` some no modo cartão, então a `FaixaDoSaldo` fica, mas só nessa largura.

**Stack:** React 19, Next 16, Vitest + Testing Library.

**Spec:** a issue ledgr-tech/frontend#474, com as recomendações aceitas:
- tirar o saldo do painel lateral;
- o saldo fica visível na densidade compacta, em uma linha.

Mais a decisão do Eduardo de 20/11: 4 PRs por dependência, e este é o PR 2.

## Restrições globais
- Branch `feat/saldo-nas-colunas` numa worktree a partir de `origin/develop`. Não depende do PR 1, mas os dois mexem em `page.tsx` (o PR 1 na coluna nova e na faixa; este no `thead`, linha `folhas-titulos`, e no fim da tabela). Quem entrar depois resolve o conflito.
- **Os três estados de `SaldoDoExtrato`**, que continuam como são:
  - `undefined`: o backend antes da #118, e nada aparece;
  - `null`: aparece `SEM_SALDO`, nunca R$ 0,00;
  - `inicial: null`: aparece "depende das linhas não lidas".
- **O saldo é do extrato:** o mesmo em qualquer filtro, ordem e densidade. Também aparece com a tabela vazia no filtro (regra da #239).
- **Arquivos compartilhados:** `app/globals.css` fica para o orquestrador, na Task 3.
- **Antes do PR:** `npm run test && npm run lint && npm run build`, depois `verificador` e `revisor`.

## Contrato do backend #238, confirmado em 20/11 (para o PR 3, não para este)
- **`saldo_sistema`**: objeto **sempre presente** em `GET /conciliacoes/{extrato_id}`, com `saldo_inicial`, `saldo_final` e `saldo_data`, nulos quando o arquivo não traz saldo e seguindo a mesma regra do banco.
  - **Consequência:** com o #238 no ar, a coluna do sistema nunca fica sem nada. Ela mostra o saldo ou "Saldo não informado no arquivo".
  - **O que este PR já deixa pronto:** o `SaldoDaFolha` serve às duas folhas sem saber o lado, e a célula do sistema existe no `thead` (com o título) e no `tfoot` (vazia).
- **`diferenca_saldo_final`**: texto decimal, ou null.
- **`diferenca_saldo_motivo`**: um código, quando a diferença vem null. Os valores são `datas_diferentes`, `sem_saldo_banco` e `sem_saldo_sistema`; o texto da tela é nosso.
- **Os campos do banco na raiz não mudam.** Este PR continua lendo `conciliacao.saldo` como hoje.
- **Mudança de nome:** se algum nome mudar, o backend avisa no contrato do ledgr-docs (07-tecnico/frontend). Conferir lá antes do PR 3.

## Foco de revisão
- O filtro "Justificadas" sem nenhuma linha: o cabeçalho e o pé com o saldo continuam lá (Task 2).
- Extrato com linhas não lidas: o topo diz "depende das linhas não lidas" e o pé mostra o final (Task 1).
- Celular, 390px: o saldo aparece uma vez só, na faixa, porque o `thead` está escondido e o `tfoot` também (Task 3).
- Painel lateral, ≥1100px: sem o bloco "Saldo do extrato", e nada mais nele quebra (Task 2).
- Rodada antiga (`?rodada=`): o mesmo saldo do banco (Task 2).

---

### Task 1: `SaldoDaFolha`

**Arquivos:**
- Modificar: `app/(app)/e/[empresa]/saldo.tsx`. Sai `SaldoNoFim`, que esta task substitui, e entra `SaldoDaFolha`.
- Testar: `app/(app)/e/[empresa]/saldo.test.tsx`, que já existe; se não existir, criar.

**Interfaces:**
- Produz: `SaldoDaFolha({ saldo, momento }: { saldo: SaldoDoExtrato | null | undefined; momento: "inicial" | "final" })`.
  - `undefined` → `null`.
  - `null` → `<span className="saldo-folha">` com `SEM_SALDO`.
  - `"inicial"` → "Saldo inicial" + valor, ou "depende das linhas não lidas".
  - `"final"` → `Saldo final em DD/MM/AAAA` + valor.
  - O valor vai em `<strong>`, com `formatarMoeda`.

- [ ] **Passo 1: testes que falham:**
  - `"inicial"` com `{ inicial: 1000, final: -250.75, data: "2026-09-30" }` → "Saldo inicial" e "R$ 1.000,00".
  - `"final"` → "Saldo final em 30/09/2026" e "-R$ 250,75" (no formato exato de `formatarMoeda`).
  - `"inicial"` com `inicial: null` → "depende das linhas não lidas".
  - `null` → "Saldo não informado no arquivo", nos dois momentos.
  - `undefined` → nada (`container` vazio).
- [ ] **Passo 2:** `npx vitest run "app/(app)/e/[empresa]/saldo.test.tsx"`. Esperado: FAIL.
- [ ] **Passo 3:** implementar e apagar `SaldoNoFim`. O único uso é `page.tsx:991`, que a Task 2 troca. Confira com `grep -rn SaldoNoFim app`.
- [ ] **Passo 4:** PASS.
- [ ] **Passo 5:** `git commit -m "feat(saldo): o saldo inicial ou final de uma folha da comparação (#474)"`

### Task 2: o saldo nas colunas e fora do painel

**Arquivos:**
- Modificar:
  - `app/(app)/e/[empresa]/conciliacoes/[id]/page.tsx`:
    - linha `folhas-titulos` do `thead` (≈610-626);
    - `tfoot` novo depois do `tbody`;
    - `SaldoNoFim` (≈991) e `FaixaDoSaldo` (≈451).
  - `app/(app)/e/[empresa]/conciliacoes/[id]/painel-do-extrato.tsx`: sai do `Saldos` (linhas 79 e 511-550) só o saldo: o `<dl>` e a data. **O botão "Voltar ao topo do extrato" fica no pé do painel**, como hoje: a Central de ajuda o descreve e a gravação da ajuda o usa. Mantenha a `<section className="comp-saldos">` só com o botão, sem o `aria-label` "Saldo do extrato". A prop `saldo` sai, se ficar sem uso. O `aria-label` do `aside` passa a ser "Detalhe da linha".
- Testar: `page.test.tsx` e `painel-do-extrato.test.tsx`.

**Interfaces:**
- Consome: `SaldoDaFolha` (Task 1).

**Comportamento:**
- **No `th` "Extrato do banco"**, depois de `folha-nome`, vai `<SaldoDaFolha saldo={conciliacao.saldo} momento="inicial" />`. O `th` do sistema fica como está; o PR 3 põe o do sistema.
- **`<tfoot role="rowgroup">`** com uma linha:
  - `<td colSpan={3} className="folha-banco">` com `<SaldoDaFolha … momento="final" />`;
  - `<td className="folha-fora" />`;
  - `<td colSpan={3} className="folha-sistema" />`;
  - a célula do Visto, se `podeDecidir`.
  - O `tfoot` só existe com `conciliacao.saldo !== undefined`.
- **Filtro sem linhas:** o `<table>` continua montado com o `tbody` vazio (conferido na develop: a `<p className="tabela-vazia">` vem depois da tabela), então o `tfoot` aparece também sem linhas.
- **`FaixaDoSaldo`:** passa a ser renderizada sempre, mas com a classe `saldo-faixa-celular`, que o CSS da Task 3 só mostra em ≤680px. Tire o `!painel &&`.

- [ ] **Passo 1: testes que falham** em `page.test.tsx`. Use a conciliação de exemplo com saldo que os testes da #118 e da #239 já usam; procure `SEM_SALDO` e "Saldo final" no arquivo.
  - Dentro do `columnheader` "Extrato do banco": "Saldo inicial" e o valor.
  - No `rowgroup` do `tfoot`: "Saldo final em …", na mesma coluna do banco. Basta conferir que está dentro da célula com `folha-banco`.
  - O filtro "Justificadas" sem linhas: o saldo final continua na tela.
  - Sem saldo (`null`): "Saldo não informado no arquivo" no topo e no fim.
  - O backend sem saldo (`undefined`): nenhuma menção a saldo.
  - Em `painel-do-extrato.test.tsx`: o painel não tem mais "Saldo do extrato" nem os valores do saldo, mas o botão "Voltar ao topo do extrato" continua. Apague ou reescreva os testes que procuravam o saldo.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run "app/(app)/e/[empresa]/"` e `npm run lint`. Esperado: PASS.
- [ ] **Passo 5:** `git commit -m "feat(comparacao): saldo inicial no topo e final no pé da coluna do banco (#474)"`

### Task 3 (orquestrador): estilo e verificação
- [ ] `app/globals.css`:
  - `.saldo-folha` (texto pequeno e tabular, uma linha, sem quebrar na densidade compacta);
  - o `tfoot` da `tabela-folhas`, com a borda de cima no tom da folha;
  - `.saldo-faixa-celular` com `display: none`, mostrada só em `@container tela (max-width: 680px)`;
  - no modo cartão, `tfoot` com `display: none`.
  - Apagar `.saldo-fim` se ficar sem uso.
- [ ] Conferir no navegador, com `backend-fake` e `next dev`:
  - em 1440px e em 1000px: saldo no topo e no pé da coluna do banco, e nada no painel;
  - em 390px: só a faixa;
  - nas densidades normal e compacta;
  - nos filtros "Todas" e "Justificadas".
- [ ] `CLAUDE.md`, no tópico "The bank extrato's balance": onde o saldo aparece agora (topo e pé da coluna do banco, a faixa só no celular, fora do painel).
- [ ] A Central de ajuda (`paginas.ts`) cita o saldo no painel? Se sim, ajustar o texto. Regravar as figuras da comparação se o `demonstracao.test.ts` reclamar.
- [ ] `npm run test && npm run lint && npm run build`, depois `verificador`, `revisor`, `codex review --base origin/develop` e o Copilot headless.
- [ ] PR para a `develop` com "Parte de #474" (o saldo do sistema e a diferença ficam para o PR 3).
