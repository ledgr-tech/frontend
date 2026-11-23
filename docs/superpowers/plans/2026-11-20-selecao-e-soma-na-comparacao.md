# Seleção única e soma das selecionadas na comparação: plano de implementação

> **Para agentes:** sub-skill obrigatória: superpowers:subagent-driven-development (recomendada) ou superpowers:executing-plans, task a task. Os passos usam checkbox (`- [ ]`).

**Objetivo:** Qualquer papel seleciona linhas que pedem revisão na comparação e vê a soma do banco, a do sistema e a diferença. A seleção substitui a marcação da #208, que continua servindo para aprovar e rejeitar (issue ledgr-tech/frontend#475 e a parte de seleção da #473).

**Arquitetura:**
- **Regra pura:** em `conciliacoes/[id]/selecao.ts`, quais linhas aceitam seleção e a soma em centavos.
- **Componente:** `soma-das-selecionadas.tsx`, um componente só, usado no painel lateral (≥1100px) e na faixa da seleção (<1100px).
- **Estado:** `page.tsx` troca o `marcadas` da #208 por `selecionadas`, que sobrevive à troca de filtro.
- **Tabela:** a seleção ganha uma coluna nova à esquerda; o Visto fica sempre no fim, só para conferir.

**Stack:** React 19, Next 16, Vitest + Testing Library.

**Spec:** as issues ledgr-tech/frontend#475 e #473, mais as decisões do Eduardo de 20/11:
- coluna nova à esquerda;
- 4 PRs por dependência (este é o PR 1);
- a soma funciona na demo, o lote não;
- o Copilot executa as tasks.

## Restrições globais
- Branch `feat/selecao-e-soma` numa worktree a partir de `origin/develop`.
- **Dinheiro:** conta em centavos inteiros, com `centavos()` de `app/(app)/e/[empresa]/dashboard/resumo.ts`, que passa a ser exportada. Ela faz `Math.round(reais * 100)` sobre o valor da linha, que vem de um decimal com 2 casas, e isso é exato até a casa dos trilhões. A soma em si é sempre de inteiros. Não mexer em `lib/adaptadores.ts`.
- **O que se pode selecionar:** só linha que pede revisão, `!estaResolvida(linha.status)`. Conciliadas e lotes agrupados não (F2 da #473).
- **Persistência:** a seleção vale dentro da mesma comparação e não grava nada. Trocar de rodada ou de conciliação limpa.
- **Demo:** a seleção e a soma funcionam na conta demo. Aprovar e rejeitar o lote seguem só com backend (`real`), como hoje.
- **Arquivos compartilhados:** `app/globals.css` e `app/(ajuda)/ajuda/paginas.ts` ficam para o orquestrador, na Task 5.
- **Antes do PR:** `npm run test && npm run lint && npm run build`, depois `verificador` e `revisor`.

## Contrato do backend #237, confirmado em 20/11 (para o PR 3, não para este)
- **`POST /conciliacoes/{extrato_id}/decisoes/lote`**: aceita só `tipo: "justificada"` nesta rodada (conferir em lote ficou fora), com `texto` e `chaves` (1 a 500). A resposta é `{ processadas, ignoradas, lote_id }`.
- **`lote_id`**: vem na decisão em vigor de cada linha no `GET /conciliacoes/{extrato_id}`, nulo quando a justificativa não veio de lote. "Aprovar o lote todo" manda as chaves do mesmo `lote_id` para `POST /justificativas/lote` (`decidirLinhas`).
- **O que este PR já deixa pronto para o PR 3:**
  - `chavesSelecionadas` pega todas as linhas selecionadas, de qualquer filtro (as `chave` que o backend manda);
  - a faixa da seleção é onde entra "Justificar N linhas";
  - o `SomaDasSelecionadas` é o mesmo componente que a janela de justificar vai mostrar.

  Nada de `lote_id` neste PR.

## Foco de revisão
- Selecionar no filtro "Só revisão", trocar para "Todas": a seleção e a soma continuam iguais (Task 3).
- Linha selecionada que sumiu ou virou conciliada num recarregar: some da seleção e da soma. Uma linha justificada continua selecionável, porque a Task 4 aprova as que aguardam (Task 3).
- Admin com 3 selecionadas, das quais só 1 aguarda aprovação: "Aprovar" manda só essa chave (Task 4).
- Analista e mês fechado: seleciona e soma, mas sem botões de decidir (Task 3 e 4).
- Leitor de tela: o contador e a diferença são anunciados ao marcar e desmarcar, inclusive a primeira marcação (Task 2 e 3: `anuncioDaSoma` num `role="status"` sempre montado).

---

### Task 1: a regra da seleção e a soma em centavos

**Arquivos:**
- Criar: `app/(app)/e/[empresa]/conciliacoes/[id]/selecao.ts`
- Testar: `app/(app)/e/[empresa]/conciliacoes/[id]/selecao.test.ts`
- Modificar: `app/(app)/e/[empresa]/dashboard/resumo.ts`, onde `centavos` passa a ser `export`.

**Interfaces:**
- Produz:
  - `podeSelecionar(linha: LinhaComparacao): boolean`
  - `type SomaDasLinhas = { quantidade: number; banco: number; sistema: number; diferenca: number }`, com tudo em centavos e `diferenca = banco - sistema`
  - `somarLinhas(linhas: readonly LinhaComparacao[]): SomaDasLinhas`
  - `limparSelecao(selecionadas: ReadonlySet<string>, linhas: readonly LinhaComparacao[]): string[]`, que devolve as chaves selecionadas que ainda existem e ainda aceitam seleção, na ordem das `linhas`.

- [ ] **Passo 1: testes que falham**, em `selecao.test.ts`:
  - `somarLinhas` com a tarifa do cliente, três linhas:
    - sistema -2,40 sem banco;
    - banco -1,60 sem sistema;
    - banco -0,80 sem sistema.

    Espera `{ quantidade: 3, banco: -240, sistema: -240, diferenca: 0 }`.
  - Só banco: `[{ valorBanco: 100.5, valorSistema: null }]` → `banco: 10050, sistema: 0, diferenca: 10050`.
  - Só sistema, sinal invertido: `diferenca` negativa.
  - Float que erraria: linhas de 0,10 e 0,20 no banco → `banco: 30` (e não 30,000000000000004).
  - Os dois lados na mesma linha (divergente_valor 100 × 98) → `diferenca: 200`.
  - Lista vazia → todos 0.
  - `podeSelecionar`:
    - `false` para `match_exato`, `match_tolerancia` e `match_agrupado`;
    - `true` para `divergente_valor` e `sem_par_sistema`.
  - `limparSelecao` tira:
    - a chave que não existe mais;
    - a de uma linha que virou `match_exato`.
  - Monte as linhas com o mesmo ajudante de fábrica dos testes vizinhos (`par.test.ts` ou `situacao.test.ts`).
- [ ] **Passo 2:** `npx vitest run "app/(app)/e/[empresa]/conciliacoes/[id]/selecao.test.ts"`. Esperado: FAIL, módulo não existe.
- [ ] **Passo 3:** implementar.
  - A soma usa `centavos` de `resumo.ts` em cada lado não nulo.
  - `podeSelecionar` reusa `estaResolvida`.
- [ ] **Passo 4:** rodar de novo. Esperado: PASS. Rodar também `dashboard/resumo.test.ts`.
- [ ] **Passo 5:** `git commit -m "feat(comparacao): a soma das linhas selecionadas em centavos (#475)"`

### Task 2: o componente da soma

**Arquivos:**
- Criar: `app/(app)/e/[empresa]/conciliacoes/[id]/soma-das-selecionadas.tsx`
- Testar: `app/(app)/e/[empresa]/conciliacoes/[id]/soma-das-selecionadas.test.tsx`

**Interfaces:**
- Consome: `SomaDasLinhas` (Task 1) e `formatarMoeda` de `lib/mock-data.ts`, que recebe reais, ou seja `centavos / 100`.
- Produz: `SomaDasSelecionadas({ soma }: { soma: SomaDasLinhas })`. Com `soma.quantidade === 0` não renderiza nada.

- [ ] **Passo 1: testes que falham:**
  - Com a soma da tarifa, mostra:
    - "3 linhas selecionadas";
    - "Banco" −R$ 2,40 e "Sistema" −R$ 2,40;
    - o destaque "Fecha: a diferença zera".
  - Com `diferenca: 200`, mostra "Diferença" com "R$ 2,00" e o texto "Falta R$ 2,00 para zerar". Com `diferenca: -200`, mostra "−R$ 2,00" com o sinal.
  - Uma linha: "1 linha selecionada".
  - `quantidade: 0` não renderiza nada.
  - A região tem `aria-label="Soma das selecionadas"`, sem `aria-live`. O texto do anúncio vem de `anuncioDaSoma(soma)`, que a Task 3 põe num `role="status"` sempre montado: uma região `aria-live` que já nasce com o texto não é lida, e a primeira marcação passaria em silêncio (decisão da revisão de 20/11).
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
  - Um `<section>` com `<dl>` (Banco, Sistema, Diferença), no mesmo padrão do `<dl>` de `Saldos` em `painel-do-extrato.tsx`.
  - O destaque de zero usa `selo selo-ok` (ou o selo positivo que já exista em `globals.css`), sem classe nova.
  - As classes de layout novas vão para a Task 5.
- [ ] **Passo 4:** PASS.
- [ ] **Passo 5:** `git commit -m "feat(comparacao): o resumo da soma das selecionadas (#475)"`

### Task 3: a seleção única na tabela, na faixa e no painel

**Arquivos:**
- Modificar:
  - `app/(app)/e/[empresa]/conciliacoes/[id]/page.tsx`: o estado `marcadas` e as linhas 169-171 e 286-317; o `colgroup`, o `thead` e o `tbody` (≈580-990); a faixa `lote-faixa` (≈559-575).
  - `app/(app)/e/[empresa]/conciliacoes/[id]/painel-do-extrato.tsx`: prop nova `soma?: SomaDasLinhas`, com `<SomaDasSelecionadas>` logo acima de `<Saldos>`.
- Testar: `page.test.tsx` e `painel-do-extrato.test.tsx`.

**Interfaces:**
- Consome: `podeSelecionar`, `somarLinhas` e `limparSelecao` (Task 1), e `SomaDasSelecionadas` e `anuncioDaSoma(soma: SomaDasLinhas): string` (Task 2).
- Produz para a Task 4:
  - `selecionadas: ReadonlySet<string>`;
  - `chavesSelecionadas: string[]`, de `limparSelecao(selecionadas, conciliacao.linhas)`, ou seja todas as linhas e não só as do filtro (F3);
  - a faixa da seleção, onde a Task 4 pendura as ações.

**Comportamento:**
- **Coluna nova:** a primeira, `col-selecao`, em todo papel e sempre, inclusive com o mês fechado e numa rodada antiga. Selecionar não grava nada.
  - No `thead`, na linha das colunas, uma caixa "Selecionar todas as divergências à vista", que pega as selecionáveis do filtro atual. (Decisão de 21/11: era "as linhas que pedem revisão", mas as justificadas, fora de "Só revisão", também entram.)
  - Na linha `folhas-titulos`, uma célula vazia.
  - Em cada linha selecionável, `<input type="checkbox" aria-label="Selecionar: <data> <descrição>">`.
  - Nas outras linhas, a célula fica vazia.
- **Visto:** volta a ser sempre o círculo de conferir. Sai a troca de papel por filtro (`marcando`) e o checkbox da #208 na última coluna.
- **Faixa da seleção:** aparece com 1 ou mais selecionadas, em qualquer filtro, presa no pé da tela depois da tabela e antes dela no DOM (decisão de 21/11, achado do revisor: acima da tabela, ela empurrava as linhas no primeiro clique), e tem:
  - o contador ("3 selecionadas"), sem `aria-live`: quem anuncia é o `role="status"` abaixo;
  - o botão "Limpar seleção";
  - sem o painel (<1100px), o `<SomaDasSelecionadas>` no lugar do contador, que ele já traz ("3 linhas selecionadas"), para o número não aparecer duas vezes;
  - com o painel, a soma vai para o `PainelDoExtrato`, pela prop `soma`.
- **Anúncio:** `<p role="status" className="sr-only">{anuncioDaSoma(soma)}</p>`, sempre montado na tela, fora da faixa (que só aparece com seleção) e fora do painel. Vazio sem seleção.
- **Ao trocar de rodada:** limpar a seleção. Use um `useEffect` no `conciliacao.id` e na rodada exibida, ou guarde a seleção com a chave da conciliação; o que for mais simples sem violar as regras de hooks do lint.
- **O clique na caixa** não aciona o clique da linha. A guarda da linha 852 já exclui `input`.

- [ ] **Passo 1: testes que falham** em `page.test.tsx`. Use o mock da demo que os testes atuais da comparação já montam.
  - Uma linha divergente tem a caixa "Selecionar: …" e uma conciliada não tem.
  - Marcar duas linhas mostra a soma com "2 linhas selecionadas"; "Limpar seleção" tira as duas.
  - O `role="status"` existe vazio antes de marcar e diz "2 linhas selecionadas. …" depois de marcar duas.
  - Selecionar em "Só revisão", trocar para "Todas" e para "Justificadas": o contador continua igual.
  - Analista e mês fechado: a coluna de seleção e a soma aparecem.
  - O cabeçalho "Visto" está lá também no filtro "Aguardando aprovação". Os testes atuais da #208 que procuram "Marcar todas as justificativas aguardando aprovação" serão reescritos na Task 4.
  - Com o painel ativo (o mock de `usePainelAtivo` que os testes já usam), a soma aparece dentro de "Detalhe da linha e saldo do extrato" e não na faixa.
  - Em `painel-do-extrato.test.tsx`: com `soma`, mostra a região "Soma das selecionadas"; sem ela, não mostra.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar como descrito. Apagar `marcando`, `todasMarcadas` e `alternarTodas`, que a Task 4 reescreve sobre a seleção.
- [ ] **Passo 4:** rodar `page.test.tsx`, `painel-do-extrato.test.tsx` e `npm run lint`. Esperado: PASS, exceto os testes da #208, que ficam para a Task 4. Marque-os `it.todo` com o nome atual, para a Task 4 achar.
- [ ] **Passo 5:** `git commit -m "feat(comparacao): uma seleção só, à esquerda, separada de conferir (#473, #475)"`

### Task 4: aprovar e rejeitar as selecionadas (a #208 sobre a seleção nova)

**Arquivos:**
- Modificar: `page.tsx`, `decidirMarcadas` vira `decidirSelecionadas`, e a faixa da seleção.
- Testar: `page.test.tsx`, os testes `it.todo` da #208.

**Interfaces:**
- Consome: `chavesSelecionadas` (Task 3), `decidirLinhas(conciliacao.id, chaves, acao, motivo)` e `DecisaoEmLote` (`conciliacoes/decisao-em-lote.tsx`, sem mudança).

**Comportamento:**
- **Quem vê:** `podeDecidir && podeAprovar && real`, como hoje, mas em qualquer filtro.
- **O que vai:** `aguardandoSelecionadas`, as chaves selecionadas cuja `situacaoDaLinha` é `"aguardando"`. Só elas vão para `decidirLinhas`.
- **Texto:**
  - Com 0 aguardando entre as selecionadas, o `DecisaoEmLote` não aparece.
  - Com algumas, a faixa diz "1 das 3 selecionadas aguarda aprovação" e o `DecisaoEmLote` recebe `quantidade = aguardandoSelecionadas.length` e `objeto = { um: "justificativa selecionada", varios: "justificativas selecionadas" }`.
- **Deu certo:** limpa a seleção e `recarregar()`, como hoje.
- **Atalho:** o atalho de "Marcar todas" da #208 continua com o filtro "Aguardando aprovação" mais a caixa de selecionar todas da Task 3.

- [ ] **Passo 1: testes que falham**, reescrevendo os `it.todo`:
  - Admin, filtro "Aguardando aprovação", seleciona todas e clica em Aprovar: `decidirLinhas` recebe as chaves e "aprovar".
  - Admin com 3 selecionadas, 1 aguardando: a faixa diz "1 das 3 selecionadas aguarda aprovação" e Aprovar manda só aquela chave.
  - Rejeitar com motivo manda o motivo.
  - 409 recarrega.
  - Analista: sem Aprovar e Rejeitar.
  - Demo, `real` falso: sem Aprovar e Rejeitar, com a soma.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run "app/(app)/e/[empresa]/conciliacoes/"` e `npm run lint`. Esperado: PASS.
- [ ] **Passo 5:** `git commit -m "feat(comparacao): aprovar e rejeitar as selecionadas, em qualquer filtro (#473)"`

### Task 5 (orquestrador): estilo, ajuda e verificação
- [ ] `app/globals.css`, nas classes de layout da tabela:
  - `col-selecao` (estreita, como `col-conferir`);
  - no modo cartão (`@container tela (max-width: 680px)`), a caixa no canto do cartão;
  - o layout do `SomaDasSelecionadas` com o destaque de zero e a faixa da seleção.
- [ ] Conferir no navegador, com `backend-fake` e `next dev`, em 1440px, 1000px e 390px:
  - a tarifa do exemplo (selecionar as 3 linhas, ver "Fecha");
  - o teclado: Tab chega na caixa, Espaço marca e o contador é anunciado.
- [ ] Central de ajuda (`app/(ajuda)/ajuda/paginas.ts`, página da comparação): uma função "Selecionar linhas e somar". Regravar as figuras da comparação se o `demonstracao.test.ts` reclamar.
- [ ] `CLAUDE.md`, no tópico "Rounds, checks and justifications" e no de #208: a seleção única (coluna à esquerda, sobrevive ao filtro, a soma em centavos, o lote aprova só as aguardando).
- [ ] `npm run test && npm run lint && npm run build`, depois `verificador`, `revisor`, `codex review --base origin/develop` e o Copilot headless.
- [ ] PR para a `develop` com `Closes #475` e "Parte de #473" (a gravação do lote fica para o PR 3).
