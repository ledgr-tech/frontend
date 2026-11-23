# Saldo do sistema e justificar em lote na comparação: plano de implementação (#474 parte 3 e #473 parte 3)

> **Para agentes:** execute task a task. Os passos usam checkbox (`- [ ]`). Cada PR tem a sua worktree, e os arquivos de uma não se cruzam com os da outra, com uma exceção: `page.tsx` muda nas duas, em trechos diferentes (ver "Conflito esperado").

**Objetivo:**
- **PR A (#474):** a coluna do sistema mostra o saldo inicial no topo e o final no pé, como a do banco. O pé mostra também a diferença entre os saldos finais (banco menos sistema), ou o motivo de não haver diferença. A revisão do rascunho da importação via IA mostra o saldo final do arquivo.
- **PR B (#473):** qualquer papel justifica de uma vez as linhas selecionadas, com um texto só. A linha justificada em lote diz "junto com outras N linhas", e o admin ou o gestor aprova o lote inteiro a partir de uma linha dele.

**Stack:** React 19, Next 16, Vitest + Testing Library.

**Ponto de partida:**
- A seleção, a soma e o lote de aprovar/rejeitar já existem (#475, PR #477).
- O saldo do banco na coluna também (#474 parte 1, PR #476), e a célula do sistema no `thead` e no `tfoot` está pronta, mas vazia.
- Os planos anteriores são `2026-11-20-saldo-nas-colunas.md` e `2026-11-20-selecao-e-soma-na-comparacao.md`.

## Contrato do backend (develop do backend, conferido no código em 22/11; entra em produção no próximo release)

### #238: saldo do sistema (`app/api/conciliacoes.py`, `app/services/saldo.py`), sem flag
- **Raiz de `GET /conciliacoes/{extrato_id}`:**
  - `saldo_sistema`: objeto **sempre presente** com `saldo_inicial`, `saldo_final` e `saldo_data` (decimais em texto ou null), nas mesmas regras do banco. É o extrato do sistema do filtro `extrato_sistema_id` ou, sem o filtro, da rodada mais recente. Os três vêm nulos sem conciliação.
  - `diferenca_saldo_final`: decimal em texto (o saldo final do banco menos o do sistema), ou null.
  - `diferenca_saldo_motivo`: `null` quando há diferença; senão `"sem_saldo_banco"`, `"sem_saldo_sistema"` ou `"datas_diferentes"`.
- **Rascunho da importação via IA:** o resumo da revisão (o mesmo `ResumoAPI` de `nova/ia/acoes.ts`) e o 201 de `POST /importacoes-ia` trazem `saldo_final` e `saldo_data`, nulos quando o arquivo não trouxe saldo. O prompt que pede esses campos vem do backend; o front não muda nada nele.

### #237: justificar em lote (`app/api/conciliacoes.py` e `app/api/justificativas.py`)
- **`POST /conciliacoes/{extrato_id}/decisoes/lote`**
  - Corpo: `{ tipo: "justificada", texto, chaves }`, com `chaves` de 1 a 500 strings de 1 a 64 caracteres. Um `texto` vazio ou com mais de 1.000 caracteres dá 422 com texto.
  - Mesmas validações e na mesma ordem da rota de uma linha: extrato do banco (404), mês aberto (409) e a rodada atual.
  - Resposta 200: `{ processadas, ignoradas, ignoradas_por_motivo: { nao_encontrada, nao_diverge, repetida, aprovada }, lote_id }`. Sem nenhuma válida, `processadas` é 0 e `lote_id` é null, e ainda assim é 200.
  - Uma linha pendente recebe a justificativa nova e conta como processada. Uma linha com justificativa aprovada (com a aprovação ligada) é ignorada como `aprovada`, sem 409.
  - Grava todas as válidas numa transação. Com `APROVACAO_JUSTIFICATIVAS_HABILITADA` desligada, cada justificativa nasce aprovada.
- **`decisao` em cada item de `GET /conciliacoes/{id}`:** ganha `lote_id` (uuid ou null) e `lote_tamanho` (quantas linhas o lote tinha, ou null). A resposta do POST de uma linha traz os mesmos campos. Os itens de `eventos` trazem `lote_id`, mas não `lote_tamanho`.
- **Aprovar o lote todo:** `POST /justificativas/lote` com `{ acao: "aprovar" | "rejeitar", lote_id, extrato_banco_id }`. É uma terceira forma, que exclui `competencia` e `itens`; `lote_id` e `extrato_banco_id` vão juntos. Pega todas as linhas do lote que aguardam aprovação, mesmo as de outras páginas. A resposta é `{ processadas, ignoradas }`.

### Produção até o release
O backend em produção não tem nada disso:
- `saldo_sistema` não vem, e a tela fica como hoje.
- A rota do lote responde 404 "Not Found", o 404 genérico do FastAPI, diferente do 404 do extrato, que tem texto próprio.
- `lote_id` e `lote_tamanho` não vêm.

As duas PRs precisam funcionar contra os dois backends.

## Restrições globais
- **Branches e worktrees:** `feat/saldo-do-sistema` (PR A) e `feat/justificar-em-lote` (PR B), cada uma numa worktree em `.worktrees/` a partir de `origin/develop`. A primeira commit de cada uma é este plano, com o mesmo conteúdo.
- **Arquivos compartilhados, só do orquestrador, em cada worktree:**
  - `lib/adaptadores.ts` e `lib/mock-data.ts` (tipos);
  - `scripts/backend-fake.mjs`;
  - `app/globals.css`;
  - `app/(ajuda)/ajuda/paginas.ts`;
  - `CLAUDE.md`.

  As tasks marcadas **(orquestrador)** são dele; o agente de código não toca nesses arquivos.
- **Dinheiro:** valores do backend em texto decimal, lidos por `paraNumero`, como o saldo do banco. Nunca refazer a diferença no front: ela vem pronta.
- **Demo:** não chama o lote (é só com backend, `real`, como aprovar e rejeitar em lote). O saldo do sistema do mock pode ficar ausente.
- **Mês fechado ou situação desconhecida (#457):** os mesmos portões do "Justificar" da linha (`podeDecidir`, que já cobre `fechamento` e `fechamentoIndisponivel`). Rodada antiga não justifica.
- **Antes do PR:** `npm run test && npm run lint && npm run build`, depois `verificador`, `revisor`, `codex review --base origin/develop`, a revisão do Copilot e a do Sentinela.

## Conflito esperado
As duas PRs mudam `app/(app)/e/[empresa]/conciliacoes/[id]/page.tsx`:
- **PR A:** só o `th` do sistema na linha `folhas-titulos` e o `tfoot`.
- **PR B:** a `lote-faixa`, o `EspiaDaLinha` e o estado da tela.

A ordem de merge é **A antes de B**, porque A é menor. Quem entra depois faz `git merge origin/develop` e resolve.

---

## PR A: saldo do sistema e diferença (#474)

### Task A0 (orquestrador): tipo, adaptador e backend-fake
- [ ] **Tipo:** no tipo `Conciliacao` (`lib/mock-data.ts`, o que tem `saldo?: SaldoDoExtrato | null`), acrescentar:
  - `saldoSistema?: SaldoDoExtrato | null`;
  - `diferencaSaldo?: { valor: number | null; motivo: "sem_saldo_banco" | "sem_saldo_sistema" | "datas_diferentes" | null }`.
- [ ] **Adaptador:** em `lib/adaptadores.ts`, perto da linha 286 (`const saldo = adaptarSaldo(lista)`):
  - com a chave `saldo_sistema` no objeto, `saldoSistema = adaptarSaldo(lista.saldo_sistema)`;
  - com a chave `diferenca_saldo_final`, `diferencaSaldo = { valor: paraNumero(...), motivo }`;
  - um `motivo` fora dos três vira `null`;
  - sem as chaves, os dois campos ficam ausentes.
- [ ] **Testes do adaptador** em `lib/adaptadores.test.ts`:
  - backend sem as chaves: nada;
  - `saldo_sistema` com os três nulos: `null`;
  - saldo completo;
  - diferença `"0.00"`: `valor` 0;
  - diferença null com `datas_diferentes`;
  - motivo desconhecido: `null`.
- [ ] **`scripts/backend-fake.mjs`:** `GET /conciliacoes/{id}` passa a mandar `saldo_sistema` (um saldo para o extrato do sistema de exemplo), `diferenca_saldo_final` e `diferenca_saldo_motivo`. O resumo do rascunho da IA passa a mandar `saldo_final` e `saldo_data`. Com `SALDO_SISTEMA=0` no ambiente, nenhum desses campos sai, para testar o backend antigo.
- [ ] Commit: `feat(#474): saldo do sistema e diferença no adaptador e no backend-fake`.

### Task A1: o saldo e a diferença na tabela
**Arquivos:**
- `app/(app)/e/[empresa]/saldo.tsx` (+ `saldo.test.tsx`);
- `app/(app)/e/[empresa]/conciliacoes/[id]/page.tsx`, só o `th` do sistema (≈782) e o `tfoot` (≈1139);
- `page.test.tsx`.

**Comportamento:**
- **`th` "Sistema de gestão":** depois de `folha-nome`, `<SaldoDaFolha saldo={conciliacao.saldoSistema} momento="inicial" id="saldo-inicial-do-sistema" />`, e o `aria-describedby` do `th` aponta para esse id, como no banco. Sem `saldoSistema` (undefined), nada.
- **`tfoot`:**
  - passa a existir quando `saldo !== undefined || saldoSistema !== undefined`;
  - a célula do banco continua igual;
  - a célula do sistema recebe `<SaldoDaFolha saldo={conciliacao.saldoSistema} momento="final" />`;
  - a célula do eixo (`folha-fora`, entre as folhas) recebe a diferença, num componente novo `DiferencaDosSaldos` em `saldo.tsx`, e perde o `aria-hidden` quando tem conteúdo.
- **`DiferencaDosSaldos({ diferenca })`:**
  - `undefined` → nada;
  - `valor === 0` → "Saldos finais batem";
  - outro valor → "Diferença" + `formatarMoeda(valor)` em `<strong>`;
  - `valor === null` com `datas_diferentes` → "Saldos em datas diferentes";
  - `sem_saldo_banco`, `sem_saldo_sistema` ou motivo null → nada, porque a célula do lado já diz "Saldo não informado no arquivo".
- **Filtro sem linhas:** o `tfoot` continua (regra da #239).
- **Rodada antiga (`?rodada=`):** o saldo do sistema é o daquela rodada, porque o backend responde pelo `extrato_sistema_id` do filtro. Confira em `usar-conciliacao.ts` se a chamada da rodada antiga já manda `extrato_sistema_id`; se não mandar, **pare e avise o orquestrador**, em vez de calcular no front.

**Testes:**
- `saldo.test.tsx`: os cinco casos do `DiferencaDosSaldos`.
- `page.test.tsx`:
  - no `columnheader` "Sistema de gestão": "Saldo inicial" e o valor;
  - no `tfoot`: o saldo final do sistema na célula `folha-sistema` e a diferença no eixo;
  - sem `saldoSistema`: a coluna do sistema sem menção a saldo, como hoje;
  - com `saldoSistema: null`: "Saldo não informado no arquivo" no pé do sistema, e nada no topo (o `SaldoDaFolha` já faz assim no banco);
  - "Justificadas" sem linhas: o pé continua.

- [ ] Testes que falham → implementar → `npx vitest run "app/(app)/e/[empresa]/"` e `npm run lint` passam.
- [ ] Commit: `feat(comparacao): saldo do sistema e diferença dos saldos finais (#474)`.

### Task A2: o celular (modo cartão)
**Arquivos:** `saldo.tsx` (`FaixaDoSaldo`) e `saldo.test.tsx`; em `page.tsx`, só a chamada da `FaixaDoSaldo` (≈587).

**Comportamento:** até 680px o `thead` e o `tfoot` somem, e a `FaixaDoSaldo` é o único lugar do saldo. Ela passa a receber `{ banco, sistema, diferenca }` e mostra:
- os dois finais, rotulados "Banco" e "Sistema";
- a diferença, com as mesmas regras do `DiferencaDosSaldos`.

Sem `sistema` (undefined), mostra só o banco, como hoje.

- [ ] Testes, implementação e commit: `feat(comparacao): saldo do sistema na faixa do celular (#474)`.

### Task A3: saldo na revisão do rascunho da IA
**Arquivos:**
- `app/(app)/e/[empresa]/conciliacoes/nova/ia/acoes.ts`: `ResumoAPI` e `ResumoDoRascunho` ganham `saldoFinal?: string | null` e `saldoData?: string | null`, só quando a chave vem;
- `nova/ia/[id]/revisao.tsx` (+ `revisao.test.tsx`).

**Comportamento:** no bloco do resumo (≈328-345), uma linha:
- "Saldo final do arquivo: R$ X em DD/MM/AAAA", formatado como a revisão já formata `totalEntradas` (o `paraNumero` de `lib/adaptadores.ts` não é exportado, e esse arquivo é do orquestrador);
- "Saldo não informado no arquivo", quando a chave vem null;
- nada, sem a chave.

O valor segue o resumo: ao remover uma linha, o resumo novo traz o mesmo saldo final (o backend diz que corrigir linha muda o inicial, não o final).

- [ ] Testes (as três formas), implementação e commit: `feat(ia): saldo final do arquivo na revisão do rascunho (#474)`.

### Task A4 (orquestrador): estilo, ajuda, verificação e PR
- [ ] **`app/globals.css`:** a célula da diferença no eixo do `tfoot` (texto pequeno, tabular, centrado, sem quebrar a largura `col-eixo`) e as duas linhas da `FaixaDoSaldo`.
- [ ] **`paginas.ts`:** na página da comparação, o texto do saldo passa a falar das duas colunas e da diferença. Confira se `demonstracao.test.ts` continua verde. Se a figura do saldo mudou, regrave com `gravar.mjs --figuras comparacao` contra o `backend-fake`.
- [ ] **`CLAUDE.md`:** no tópico "The bank extrato's balance", o saldo do sistema, a diferença e o motivo, e o saldo na revisão da IA.
- [ ] **No navegador**, com `backend-fake` e `next dev`, em 1440, 1000 e 390px, nas densidades normal e compacta:
  - saldo nas duas colunas e a diferença;
  - "Saldos finais batem";
  - datas diferentes;
  - `SALDO_SISTEMA=0`: a tela de hoje;
  - a revisão da IA.

  Esse é o teste do Antigravity.
- [ ] Pré-PR completo, depois PR para a `develop` com `Closes #474`.

---

## PR B: justificar em lote (#473)

### Task B0 (orquestrador): tipos, adaptador e backend-fake
- [ ] **Tipo:** `Decisao` (`lib/mock-data.ts`) ganha `loteId?: string` e `loteTamanho?: number`.
- [ ] **`adaptarDecisao`** (`lib/adaptadores.ts`): lê `lote_id` e `lote_tamanho` e só põe os campos quando vierem não nulos, como faz com `aprovada_por`.
- [ ] **Testes:** com lote, sem lote (null) e backend antigo (sem as chaves).
- [ ] **`scripts/backend-fake.mjs`:**
  - `POST /conciliacoes/{id}/decisoes/lote`, com as quatro contagens de ignoradas e a transação;
  - `lote_id` e `lote_tamanho` na `decisao` da listagem e na resposta do POST de uma linha;
  - `POST /justificativas/lote` com `{ lote_id, extrato_banco_id }`;
  - com `LOTE_DE_JUSTIFICATIVAS=0`, a rota do lote responde `404 {"detail":"Not Found"}`, como em produção hoje.
- [ ] Commit: `feat(#473): lote nas decisões, no adaptador e no backend-fake`.

### Task B1: as Server Actions
**Arquivos:** `app/(app)/e/[empresa]/conciliacoes/acoes.ts` (+ `acoes.test.ts`).

**`justificarLinhas(extratoBancoId, chaves, texto)`**
- **Validação:** as mesmas de `decidirLinhas` (uuid, de 1 a 500 chaves, cada uma string de 1 a 64), e o texto aparado de 1 a 1.000 caracteres. Fora disso, devolve 422 com "Escreva o motivo da justificativa." ou "A justificativa pode ter até 1.000 caracteres.".
- **Sem recusa de papel:** todos justificam (decisão de 21/10).
- **Chamada:** `chamarBackend` → `POST /conciliacoes/${id}/decisoes/lote` com `{ tipo: "justificada", texto, chaves }`.
- **Resposta:** `{ processadas, ignoradas, ignoradas_por_motivo, lote_id }`, devolvida como `{ processadas, ignoradas, porMotivo: { naoEncontrada, naoDiverge, repetida, aprovada }, loteId }`.
- **Erros:**
  - 404 com `detail` igual a `"Not Found"` → `{ status: 404, erro: LOTE_INDISPONIVEL, indisponivel: true }`, com `LOTE_INDISPONIVEL = "Justificar várias linhas de uma vez ainda não está disponível."`;
  - outro 404 → `LINHA_MUDOU`;
  - 409 e 422 → `traduzir(erro)`, que mostra o texto do backend (mês fechado, texto inválido);
  - conta inativa → o texto do backend (`ehContaInativa`).

**`aprovarLote(extratoBancoId, loteId)`**
- Valida os dois como uuid.
- Recusa o analista antes do backend (`recusaSeNaoPodeFechar(SO_O_GESTOR_APROVA)`, como `decidirLinhas`).
- Chama `decidirEmLote({ acao: "aprovar", lote_id, extrato_banco_id })`. Se o tipo do corpo de `decidirEmLote` não aceitar essa forma, amplie o tipo; a função continua uma só.

**Testes:**
- formato inválido (chave número, 501 chaves, texto vazio, texto de 1.001 caracteres);
- corpo enviado ao backend;
- resposta adaptada;
- os dois 404 distintos;
- 409 com o texto do backend;
- `aprovarLote` recusando o analista e mandando `lote_id` + `extrato_banco_id`.

- [ ] Testes que falham → implementar → passar.
- [ ] Commit: `feat(acoes): justificar várias linhas e aprovar o lote (#473)`.

### Task B2: "Justificar" na faixa da seleção
**Arquivos:**
- novo `app/(app)/e/[empresa]/conciliacoes/[id]/justificar-em-lote.tsx` (+ teste);
- `page.tsx`: o estado, a `lote-faixa` (≈709-735) e a área de avisos (≈737).

**`JustificarEmLote({ quantidade, jaJustificadas, limite = 500, onJustificar })`**, no molde de `DecisaoEmLote`:
- **Botão:** "Justificar a linha selecionada" (1) ou "Justificar as N linhas selecionadas".
- **Formulário em linha:** abre com `textarea` obrigatória (`maxLength` 1000, rótulo "Motivo da justificativa") e a nota "Fica no registro com o seu nome e o horário. Desfazer depois gera um novo registro.".
- **Linhas já justificadas:** com `jaJustificadas > 0`, a nota "N das selecionadas já têm justificativa; a nova substitui a de antes."
- **Envio:** "Justificar" e "Cancelar". Vazio mostra "Escreva o motivo da justificativa." sem chamar o backend.
- **Um envio por vez:** uma `ref` trava antes do primeiro `await`, e um `catch` devolve `SEM_SERVIDOR`.
- **Acima do limite:** botão desligado, com a nota "Selecione no máximo 500 linhas para justificar de uma vez."

**Em `page.tsx`:**
- **Quando aparece:** `podeJustificarEmLote = podeDecidir && real && !loteIndisponivel`. `podeDecidir` já é falso na rodada antiga, no mês fechado e com o fechamento desconhecido. A demo não mostra o botão.
- **O que vai ao backend:** todas as `chavesSelecionadas`. A seleção já só aceita linhas que pedem revisão, e o backend conta o resto em `ignoradas`.
- **`jaJustificadas`:** as selecionadas com `situacaoDaLinha` `justificada` ou `aguardando`.
- **Ordem na faixa:** soma, "Justificar…", depois o `DecisaoEmLote` (quando houver aguardando) e "Limpar seleção".
- **Sucesso:**
  - `esvaziarSelecao(true)` e `recarregar()`, como `decidirSelecionadas`; o foco vai ao filtro aberto;
  - um aviso num `role="status"` sempre montado: "3 linhas justificadas." e, com ignoradas, "2 ficaram de fora: 1 já aprovada, 1 não diverge mais." (só os motivos com contagem > 0; `nao_encontrada` diz "não existe mais nesta rodada"; `repetida` não aparece);
  - com `processadas` 0, "Nenhuma linha foi justificada:" seguido dos motivos.
- **`indisponivel`:** guardar `loteIndisponivel = true` no estado da tela, sem persistir; o botão some e o texto do erro aparece uma vez.
- **401** → login. **409** → `recarregar()` e o texto.

**Testes:**
- `justificar-em-lote.test.tsx`: abrir, vazio bloqueado, limite de caracteres, nota das já justificadas, duplo clique manda uma vez, erro mostrado, cancelar.
- `page.test.tsx`:
  - analista seleciona 3 e justifica: a action recebe as 3 chaves e o texto, a seleção some e o aviso aparece;
  - o aviso com ignoradas;
  - demo sem o botão;
  - rodada antiga sem o botão;
  - mês fechado sem o botão;
  - o 404 "Not Found" esconde o botão;
  - admin com aguardando selecionadas vê os dois (Justificar e Aprovar/Rejeitar).

- [ ] Testes que falham → implementar → passar.
- [ ] Commit: `feat(comparacao): justificar as linhas selecionadas de uma vez (#473)`.

### Task B3: o lote na janela da linha, no painel e no detalhe
**Arquivos:**
- `page.tsx` (`EspiaDaLinha`, ≈1416-1520);
- `painel-do-extrato.tsx` (≈305-325) e `painel-da-comparacao.ts` (`acoesDoPainel`);
- `[linha]/detalhe.tsx`;
- os testes de cada um.

**Regra do CLAUDE.md:** a janela e o painel têm a mesma regra escrita em dois lugares. Mude os dois.

**Comportamento:**
- **"Junto com outras":** com `decisao.loteTamanho > 1`, abaixo de "Justificada por…", a linha "Justificada junto com outra linha" (2) ou "Justificada junto com outras N linhas" (N = tamanho − 1). Na janela, no painel e no detalhe. Com tamanho 1 ou ausente, nada.
- **"Aprovar o lote todo":** só para quem aprova (`podeAprovar`), com a linha `aguardando`, `decisao.loteId` e `loteTamanho > 1`. Fica ao lado de "Aprovar" e chama `aprovarLote(conciliacao.id, loteId)`. O rótulo é "Aprovar as N do lote", com o N do `loteTamanho`; o backend aprova as que ainda aguardam e ignora o resto.
- **Sucesso:** relê a tela (`recarregar()`) e mostra "N justificativas aprovadas." no mesmo aviso de status da B2.
- **Erros:** as mesmas regras do "Aprovar" da linha.
- **Rejeitar o lote:** fica fora. Para rejeitar várias, selecione e use "Rejeitar…".

**Testes:**
- o texto com 2 e com 5;
- nada com 1;
- o botão só para admin e gestor, só aguardando e só com lote;
- `aprovarLote` chamado com o `loteId`;
- o mesmo no painel (`acoesDoPainel` e o componente) e o texto no detalhe.

- [ ] Testes que falham → implementar → passar.
- [ ] Commit: `feat(comparacao): justificada em lote e aprovar o lote pela linha (#473)`.

### Task B4 (orquestrador): estilo, ajuda, verificação e PR
- [ ] **`app/globals.css`:** o formulário em linha do "Justificar" na `lote-faixa`, que pode quebrar linha na coluna estreita; o `ResizeObserver` (`prenderFaixa`) já mede a altura. Mais a linha "junto com outras".
- [ ] **`paginas.ts`:** na comparação, a seção "Justificar várias linhas de uma vez". A parte da aprovação do lote fica de fora, porque a Central não fala da aprovação enquanto a flag estiver desligada (ver `CLAUDE.md`).
- [ ] **`CLAUDE.md`:**
  - no tópico "Selecting lines and their sum", trocar "Justifying the selected lines at once waits for backend #237" pelo que foi feito;
  - no tópico "Approving justifications", `lote_id` e `lote_tamanho` e "aprovar o lote".
- [ ] **No navegador**, com `backend-fake`:
  - analista justifica 3;
  - admin aprova o lote pela janela de uma delas;
  - mês fechado;
  - `LOTE_DE_JUSTIFICATIVAS=0`;
  - 390px, com a faixa e o formulário;
  - teclado: Tab chega no "Justificar" antes das linhas, e o foco não fica atrás da faixa (WCAG 2.4.11, `--reserva-da-faixa`).

  Esse é o teste do Antigravity.
- [ ] Pré-PR completo, depois PR para a `develop` com `Closes #473`.

---

## Fora deste plano
- **A passada na landing** (seleção, soma, lote e os dois saldos no "Na prática", e regravar "Por dentro"): vem depois das duas PRs.
- **Rejeitar o lote pela linha.**
- **`lote_id` nos eventos do histórico.**
