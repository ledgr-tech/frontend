# Cap. II "Ache as diferenças" e "Por que o Ledgr": plano de implementação

> **Revisão de 13/10/2026:** o jogo das Tasks 1 e 3 foi feito e depois retirado, a pedido, porque a
> landing é uma página de leitura. Ficou só a Task 2 ("Por que o Ledgr"). Ver a revisão no topo da spec.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar o Cap. II da landing pelo jogo "Ache as diferenças" (só a dor, com uma ponte para o
Cap. III) e levar a comparação "Hoje × Com o Ledgr" para uma seção própria, "Por que o Ledgr", como
tabela de verdade.

**Architecture:** um componente cliente novo (`AcheAsDiferencas`) recebe os lançamentos de agosto
que o `page.tsx` já tem, mais um `fato` por linha divergente, e guarda o estado do jogo em React
(nada persiste). A comparação sai do `page.tsx` para `por-que.tsx`, um componente de servidor com a
tabela. O que só a demonstração antiga usava (`ExtratoComparacao`, o caminho `interacao` da
`TabelaFolhas` e o CSS do hover) sai.

**Tech Stack:** Next 16 (App Router), React 19, `motion` (`Reveal`), Vitest + Testing Library
(`@testing-library/user-event` 14), CSS em `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-10-13-cap-ii-ache-as-diferencas-design.md`

## Global Constraints

- Todo o trabalho fica no worktree `.worktrees/cap-ii-ache-as-diferencas`, branch `feat/cap-ii-ache-as-diferencas` (sai da `develop`).
- Texto: exatamente o da tabela "Texto novo" da spec; nenhum número que não saia dos dados; nenhum travessão (`—` ou `–`) nos textos novos.
- `.eyebrow` só nos quatro capítulos (o teste "labels only the four chapters above the section titles" continua igual): os rótulos novos usam `.rotulo-parte`.
- Todo `h1`/`h2` da landing fora da vitrine tem `titulo-misto` e um `<em>` com o trecho em itálico.
- A landing só tem tema claro: nada de CSS de tema escuro para ela.
- Cores pelos tokens: `--color-ok` (achou), `--color-erro` (passou), `--color-accent` / `--color-accent-700` (marcada, filete do Ledgr), `--color-divider`, `--folha-banco` / `--folha-sistema`.
- Nenhum `fontFamily` em `style` inline (o teste do guia de estilo cobra).
- Pontos de quebra: as linhas do jogo viram duas abaixo de 600 px; a tabela de "Por que o Ledgr" vira blocos abaixo de 760 px.
- As notas da revelação entram uma depois da outra, 150 ms entre elas; com `prefers-reduced-motion: reduce`, sem animação.
- Antes de cada commit: `npm run test && npm run lint && npm run build`. Mensagens em português, com prefixo (`feat:`, `fix:`, `test:`, `style:`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Sair da página com o cronômetro correndo: o intervalo tem que parar no desmonte, sem aviso de `act` nem timer pendurado (teste na Task 1).
- Marcar e desmarcar todas antes de revelar: o cronômetro já andou, mas o resultado é "Você não marcou nenhuma: passaram as N." (teste na Task 1).
- O foco não pode cair no `body` quando "Ver o que passou" some: vai para "Tentar de novo", e volta para a primeira linha do banco ao tentar de novo (teste na Task 1).
- Revelar não depende de ter marcado: com nada marcado, todas as divergentes saem como "Passou." (teste na Task 3, com os dados reais).
- Descrição longa a 390 px: corta com reticências dentro da folha, sem rolagem lateral da página (conferido no navegador na Task 4).

---

### Task 1: o jogo, `AcheAsDiferencas`

**Files:**
- Create: `app/(marketing)/ache-as-diferencas.tsx`
- Create: `app/(marketing)/ache-as-diferencas.test.tsx`
- Modify: `app/(marketing)/categorias.ts` (o `POR_EXTENSO` vira `porExtenso`)
- Modify: `app/globals.css` (bloco novo depois do de "O problema", por volta da linha 1440; e `.ache` na lista `:is(.vitrine-app, .demonstracao-folhas, .beneficio)` das variáveis das folhas, por volta da linha 1189)

**Interfaces:**
- Consumes: `LinhaExtrato` de `./comparacao`; `estaResolvida` e `rotuloCurto` de `@/app/(app)/dashboard/resumo`; `IconeOrigem` de `@/app/(app)/icone-origem`.
- Produces:
  - `porExtenso(n: number, genero: "f" | "m"): string` em `categorias.ts`, com maiúscula ("Cinco", "Uma"/"Um", "Duas"/"Dois", "Nenhuma"/"Nenhum"; acima de dez, o algarismo). `QUANTAS_CATEGORIAS = porExtenso(DIVERGENCIAS.length, "f")`.
  - Em `ache-as-diferencas.tsx` (`"use client"`):
    - `formatarTempo(segundos: number): string`, em `m:ss`
    - `textoDoResultado(achadas: number, total: number, marcadas: number, tempo: string): string`
    - `PONTE: string`, a frase da ponte da spec
    - `AcheAsDiferencas({ banco, sistema, fatos }: { banco: LinhaExtrato[]; sistema: LinhaExtrato[]; fatos: Record<string, string> })`, onde `fatos` vai da descrição da linha ao fato ("R$ 36,00 a mais no banco").

**Marcação que os testes e o CSS usam:**
- Raiz `div.ache`, com `data-revelado` depois da revelação.
- `p.rotulo-parte.rotulo-parte-ledgr` "Tente você". A classe é renomeada de `.problema-rotulo` na Task 2. Até lá, use `problema-rotulo problema-rotulo-ledgr` e a Task 2 troca.
- `p.ache-instrucao` com dois `span`, `so-mouse` e `so-toque`, cada um com a frase inteira.
- `p.ache-relogio`: `<span className="sr-only">Tempo: </span>` mais o tempo.
- Duas `div.ache-folha` (`data-folha="banco"` / `"sistema"`). Cada uma tem `p.ache-folha-nome` com `id` (`useId`), com o `IconeOrigem` e "Extrato do banco" / "Sistema de gestão", e uma `ul.ache-linhas` com `aria-labelledby` nesse `id`.
- Antes da revelação, cada linha do banco é `<li><button type="button" className="ache-linha" aria-pressed aria-label="04/08, Pagamento fornecedor #1082, R$ 12.640,00">`, com `span.ache-data`, `span.ache-desc` e `span.ache-valor`. Do sistema, `li.ache-linha` com os mesmos três `span` e `valorSistema`.
- Depois da revelação, cada linha do banco é `li.ache-linha`, com `data-estado` `"achou"` (diverge e foi marcada), `"passou"` (diverge e não foi marcada) ou `"a-toa"` (marcada e bate). Quem tem estado ganha `p.ache-nota` com `style={{ "--ordem": i }}`, onde `i` é a posição entre as linhas com nota. A linha par do sistema (mesma `desc`) recebe o mesmo `data-estado`.
- Notas: `"Você achou. ${rotuloCurto(l)} · ${fatos[l.desc]}"`, `"Passou. ${rotuloCurto(l)} · ${fatos[l.desc]}"`, `"Esta bate."`. Diverge é `!estaResolvida(l.status)`.
- Região viva `div.ache-resultado` com `aria-live="polite"`, sempre no DOM. Depois da revelação, ela tem dois `p`: `textoDoResultado(...)` e `PONTE`.
- Ações: antes, `button.btn.btn-primary` "Ver o que passou". Depois, `a.btn.btn-primary href="#como"` "Ver como funciona" e `button.btn.btn-ghost` "Tentar de novo".

- [ ] **Step 1: Escrever os testes que falham**

Em `ache-as-diferencas.test.tsx`, com um agosto de três linhas no banco e duas no sistema, para provar que os números saem dos dados:

```tsx
const BATE: LinhaExtrato = { data: "03/08", desc: "Recebimento cliente Alfa Comércio", valorBanco: "R$ 3.250,00", valorSistema: "R$ 3.250,00", status: "match_exato", explicacao: null };
const VALOR: LinhaExtrato = { data: "04/08", desc: "Pagamento fornecedor #1082", valorBanco: "R$ 12.640,00", valorSistema: "R$ 12.604,00", status: "divergente_valor", explicacao: null };
const TARIFA: LinhaExtrato = { data: "06/08", desc: "Tarifa de manutenção da conta", valorBanco: "R$ 45,00", valorSistema: null, status: "tarifa_bancaria", explicacao: null };
const FATOS = { [VALOR.desc]: "R$ 36,00 a mais no banco", [TARIFA.desc]: "não está no sistema" };
const jogo = () => render(<AcheAsDiferencas banco={[BATE, VALOR, TARIFA]} sistema={[BATE, VALOR]} fatos={FATOS} />);
const listaBanco = () => screen.getByRole("list", { name: "Extrato do banco" });
const listaSistema = () => screen.getByRole("list", { name: "Sistema de gestão" });
```

Testes, com estes nomes e asserções:
- `formats the clock as m:ss`: `formatarTempo(0)` é `"0:00"`, `(42)` é `"0:42"`, `(65)` é `"1:05"`, `(600)` é `"10:00"`.
- `words the result with the counts, or says nothing was marked`: `textoDoResultado(2, 4, 3, "0:42")` dá `"Você achou 2 de 4, em 0:42."`; `textoDoResultado(0, 4, 0, "0:12")` dá `"Você não marcou nenhuma: passaram as 4."`.
- `spells counts out in either gender`: `porExtenso(5, "m")` é `"Cinco"`, `(1, "m")` é `"Um"`, `(1, "f")` é `"Uma"`, `(2, "m")` é `"Dois"`, `(12, "f")` é `"12"`.
- `makes each bank line a toggle named by date, description and value, and leaves the system as text`: `within(listaBanco()).getAllByRole("button")` tem os nomes `["03/08, Recebimento cliente Alfa Comércio, R$ 3.250,00", "04/08, Pagamento fornecedor #1082, R$ 12.640,00", "06/08, Tarifa de manutenção da conta, R$ 45,00"]`, todos com `aria-pressed="false"`; `within(listaSistema()).queryAllByRole("button")` é vazio e há 2 `listitem`.
- `says how many lines there are, for mouse and for touch`: `getByText("Três lançamentos de agosto. Marque os do banco que não batem com o sistema.")` e `getByText("Três lançamentos de agosto. Toque nos do banco que não batem com o sistema.")`.
- `toggles a line on and off`: clicar duas vezes no botão da #1082 leva `aria-pressed` a `"true"` e depois a `"false"`.
- `starts the clock on the first mark and stops it on the reveal`: com `vi.useFakeTimers()`, vê `"0:00"`; avança 5 s e continua `"0:00"`; marca uma linha, avança 42 s e vê `"0:42"`; clica "Ver o que passou", avança 10 s e continua `"0:42"`. Use `fireEvent` com `act` ao avançar os timers, porque `userEvent` com timers falsos exige `advanceTimers`.
- `marks what was found, what slipped and what was marked for nothing`: marca BATE e VALOR e revela.
  - O `li` de VALOR tem `data-estado="achou"` e o texto `"Você achou. Valor diverge · R$ 36,00 a mais no banco"`.
  - O de TARIFA tem `"passou"` e `"Passou. Tarifa · não está no sistema"`.
  - O de BATE tem `"a-toa"` e `"Esta bate."`.
- `lights the pair in the system`: depois da revelação acima, o `li` de VALOR em `listaSistema()` tem `data-estado="achou"`, e o de BATE fica sem `data-estado`.
- `announces the result and the bridge once, in a live region`: `container.querySelector('[aria-live="polite"]')`.
  - Antes de revelar, está vazio.
  - Depois, com VALOR marcado, contém `"Você achou 1 de 2, em 0:00."` (sem timers falsos e sem avançar, o tempo é `0:00`) e `PONTE`.
- `says nothing was marked even after marking and unmarking`: marca e desmarca VALOR, revela, e a região viva contém `"Você não marcou nenhuma: passaram as 2."`.
- `turns the lines into text after the reveal and offers the way on`: depois da revelação, `within(listaBanco()).queryAllByRole("button")` é vazio e "Ver o que passou" não existe mais. O link "Ver como funciona" tem `href="#como"` e `document.activeElement` é o botão "Tentar de novo".
- `starts over from scratch`: marca VALOR, revela e clica "Tentar de novo".
  - Os três botões voltam, com `aria-pressed="false"`.
  - O relógio mostra `"0:00"`, não há `.ache-nota` e a região viva está vazia.
  - `document.activeElement` é o primeiro botão do banco.
- `stops the clock when it leaves the page`: com timers falsos, marca uma linha, `unmount()`, e `vi.getTimerCount()` é `0`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "app/(marketing)/ache-as-diferencas.test.tsx"`
Expected: FAIL, porque `./ache-as-diferencas` não existe.

- [ ] **Step 3: Implementar `porExtenso` e o componente**

- **Estado:** `marcadas: Set<string>` (por `desc`), `inicio: number | null`, `segundos: number`, `revelado: boolean`.
- **Cronômetro:** o primeiro toque grava `Date.now()` e abre um `setInterval` de 250 ms, que calcula `Math.floor((Date.now() - inicio) / 1000)`. A revelação e o desmonte limpam o intervalo.
- **Foco:** use `ref` e um `useEffect` que olha `revelado`. Ao revelar, foca "Tentar de novo". Ao recomeçar, foca o primeiro botão do banco.
- **Texto da instrução:** `${porExtenso(banco.length, "m")} lançamentos de agosto. ...`

- [ ] **Step 4: CSS do jogo em `globals.css`**

Bloco `/* Ache as diferenças (Cap. II) */` com:

- **`.ache-folhas`:** duas colunas `minmax(0, 1fr)`, `gap: 12px`, nunca empilhadas.
- **`.ache-folha`:**
  - fundo `var(--folha-banco)` / `var(--folha-sistema)` por `data-folha`;
  - filete `var(--color-divider)`, `border-radius: var(--radius-md)`.
- **`.ache-linha`:**
  - grade `56px minmax(0, 1fr) auto`, `padding: 10px 14px`, `border-top` no divisor;
  - o botão herda a fonte, sem fundo nem borda própria, `width: 100%`, `text-align: left`;
  - `.ache-desc` com `text-overflow: ellipsis`;
  - `.ache-valor` à direita, com `font-variant-numeric: tabular-nums`.
- **Estados:**
  - `[aria-pressed="true"]`: `outline: 1px solid var(--color-accent)` para dentro e fundo `color-mix(in srgb, var(--color-accent) 10%, transparent)`;
  - `:focus-visible`: o anel de foco do sistema;
  - `[data-estado="achou"]` / `"passou"`: fundo de 12% de `--color-ok` / `--color-erro`;
  - `[data-estado="a-toa"]`: sem fundo.
- **`.ache-nota`:**
  - 13 px, na cor do estado (`--color-ok-700`, `--color-erro`, ou o texto apagado no `a-toa`), na coluna inteira (`grid-column: 1 / -1`);
  - `animation: ache-nota-entra 260ms cubic-bezier(0.22, 1, 0.36, 1) both`, com `animation-delay: calc(var(--ordem) * 150ms)`;
  - a animação vai de `opacity: 0; transform: translateY(4px)` ao normal;
  - `@media (prefers-reduced-motion: reduce)`: `animation: none`.
- **Abaixo de 600 px:** a linha passa a ter `grid-template-areas: "data valor" "desc desc"`, e a descrição fica em 12,5 px.
- **`.ache-relogio`:** `tabular-nums`, na cor do texto apagado.
- **`.ache-acoes`:** `flex`, `gap: 12px`, `flex-wrap: wrap`.

Troque `.demonstracao-folhas` por `.ache` na lista `:is(...)` das variáveis das folhas. Não use classe do app (`folha-banco`, `table`...) nos seletores novos, porque o teste do guia de estilo trataria a regra como do app.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run "app/(marketing)/ache-as-diferencas.test.tsx" "app/(marketing)/page.test.tsx"`
Expected: PASS. A landing ainda não usa o jogo, e o teste dela continua passando com o `QUANTAS_CATEGORIAS` novo.

- [ ] **Step 6: Commit**

```bash
npm run test && npm run lint && npm run build
git add "app/(marketing)/ache-as-diferencas.tsx" "app/(marketing)/ache-as-diferencas.test.tsx" "app/(marketing)/categorias.ts" app/globals.css
git commit -m "feat: jogo Ache as diferenças, com os lançamentos de agosto sem as marcas do Ledgr"
```

---

### Task 2: a seção "Por que o Ledgr"

**Files:**
- Create: `app/(marketing)/por-que.tsx`
- Modify: `app/(marketing)/page.tsx`
  - saem `ASPECTOS`, `Resposta`, `Saida`, `SAIDAS_DE_HOJE`, `SAIDA_LEDGR` e `ColunaSaida`, nas linhas 122 a 185;
  - sai o `div#por-que` do Cap. II, nas linhas 495 a 512;
  - entra a seção nova entre `#por-dentro` e `#regra`;
  - a classe de `#regra` muda.
- Modify: `app/globals.css` (o bloco `.por-que-*`, nas linhas 1355 a 1385, vira o da tabela; `.problema-rotulo*` vira `.rotulo-parte*`)
- Modify: `app/(marketing)/ache-as-diferencas.tsx` (a classe do rótulo)
- Test: `app/(marketing)/page.test.tsx` (o `describe("the comparison with the other ways out")` inteiro, a lista de títulos e o teste das faixas)

**Interfaces:**
- Consumes: `LogoBarras` de `@/app/(app)/logo-barras`; `Reveal` de `../reveal`.
- Produces: `PorQueOLedgr()`, sem props, que desenha o rótulo, o título e a tabela. Os dados movidos ficam em `por-que.tsx`, com os mesmos nomes e textos. O `page.tsx` monta `<section id="por-que" className="onda onda-faixa-clara" style={{ background: "var(--color-surface)" }}>`, com o mesmo `div` de contêiner das outras seções (`maxWidth: 1600`, mesmo `padding`), e `#regra` passa a `className="onda onda-superficie"`.

**A tabela** (`table.por-que-tabela role="table"`, com `role` em todos os elementos, como na `TabelaFolhas`, para a forma de blocos no celular não perder a semântica):
- `<caption className="sr-only">As saídas de hoje e o Ledgr, pergunta por pergunta</caption>`, seguida de `<colgroup />`, `<colgroup span={2} />` e `<colgroup className="por-que-col-ledgr" />`.
- `thead`, primeira linha: uma célula vazia (`<td aria-hidden="true" />`), depois `<th scope="colgroup" colSpan={2}>Hoje</th>` e `<th scope="colgroup" className="por-que-grupo-ledgr">Com o Ledgr</th>`. Os dois rótulos vão no estilo `.rotulo-parte`: "Hoje" apagado, "Com o Ledgr" em dourado.
- `thead`, segunda linha: uma célula vazia, depois `<th scope="col">` para "Conferir à mão", "Migrar para um sistema com conciliação" e, com `className="por-que-ledgr"`, `<LogoBarras className="por-que-logo" /> Ledgr`.
- `tbody`: uma linha por `ASPECTOS[i]`, com `<th scope="row">` e três `<td data-rotulo={saida.nome}>` cujo primeiro filho é `<strong>{destaque}</strong>`, seguido do resto. A célula do Ledgr leva `className="por-que-ledgr"`.
- **CSS, a partir de 760 px:**
  - `border-collapse: separate; border-spacing: 0`;
  - a coluna das perguntas com cerca de 22% da largura;
  - os filetes de linha em `--color-divider`;
  - as células `.por-que-ledgr` com `border-inline: 1px solid var(--color-accent)`. A do nome tem `border-top` e cantos de cima em `var(--radius-md)`; a da última linha, `border-bottom` e cantos de baixo;
  - o filete entre as linhas da coluna do Ledgr em `color-mix(in srgb, var(--color-accent) 40%, transparent)`.
  - Sem margem negativa: a coluna fica dentro do contêiner.
- **CSS, abaixo de 760 px:**
  - `table`, `tbody`, `tr`, `th` e `td` em `display: block`, e o `thead` escondido;
  - cada `tr` é um bloco, com o `th` como título;
  - cada `td` mostra o `attr(data-rotulo)` num `::before` pequeno, em mono maiúscula;
  - a `td.por-que-ledgr` tem o filete dourado inteiro e `border-radius: var(--radius-md)`.
- As respostas mantêm as cores de hoje: o negrito na cor do texto e o resto a 72%.

- [ ] **Step 1: Reescrever os testes da comparação em `page.test.tsx`**

Troque o `describe("the comparison with the other ways out")` por `describe("Por que o Ledgr")`, com `const porQue = () => document.getElementById("por-que")!` e estes testes:
- `sits on its own between Por dentro and Regra de ouro`:
  - `#por-dentro` tem `nextElementSibling` igual a `porQue()`, e `porQue()` tem `nextElementSibling` igual a `#regra`;
  - `porQue().tagName` é `"SECTION"`;
  - `#problema` não contém `table`.
- `opens with its label and title, without taking a chapter label`:
  - `within(porQue()).getByText("Por que o Ledgr")` tem a classe `rotulo-parte`;
  - o `h2` "Sem trocar de sistema, e sem voltar para o manual." tem um `em` "e sem voltar para o manual.".
- `is a table of the three ways, with each question once`:
  - `getByRole("table", { name: "As saídas de hoje e o Ledgr, pergunta por pergunta" })`;
  - os `columnheader` são `["Hoje", "Com o Ledgr", "Conferir à mão", "Migrar para um sistema com conciliação", "Ledgr"]`;
  - os `rowheader` são `["Trocar de sistema", "Quem confere, todo mês", "Para começar", "O que custa"]`.
- `leads each answer with the direct answer in bold, so reading across a row compares the three ways`:
  - os `strong` de cada linha, nesta ordem: `[["Não precisa.", "Precisa.", "Não precisa."], ["Alguém que entenda de contabilidade", "O sistema novo", "O Ledgr, linha por linha"], ["A planilha de sempre.", "Migrar cadastros, contas e histórico", "Subir dois arquivos"], ["As horas de quem confere", "A mensalidade do sistema novo", "Pelo volume de lançamentos do mês"]]`;
  - cada `td` tem `firstChild` igual ao seu `strong`;
  - a célula de "Migrar…" em "Trocar de sistema" tem o texto `"Precisa. A empresa inteira passa para o sistema novo."`.
- `highlights only the Ledgr column`: as `td.por-que-ledgr` são as 4 da última coluna, e nenhuma outra `td` tem a classe.
- `names each answer by its way, for the phone layout`: em toda linha, os `data-rotulo` das `td` são `["Conferir à mão", "Migrar para um sistema com conciliação", "Ledgr"]`.
- `says the Ledgr keeps your system and leaves you only what does not match`: as duas primeiras células do Ledgr casam com `/^Não precisa\./` e com `/você revisa só o que não bate, já com o motivo/`.
- `compares kinds of solution, without naming competitors`: o mesmo teste de hoje, sobre `porQue()`.
- `keeps the bands alternating`: `#como` com `onda-papel`, `#por-dentro` com `onda-superficie`, `#por-que` com `onda-faixa-clara` e `#regra` com `onda-superficie`.

Ajuste também o teste `sets one short stretch of each main title in the display italic`: entra `["Sem trocar de sistema, e sem voltar para o manual.", ["e sem voltar para o manual."]]` entre "Cada lançamento…" e "O extrato do banco…".

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "app/(marketing)/page.test.tsx"`
Expected: FAIL nos testes de "Por que o Ledgr", porque a seção não existe.

- [ ] **Step 3: Criar `por-que.tsx`, montar a seção no `page.tsx`, trocar a classe de `#regra` e reescrever o CSS**

`PorQueOLedgr` põe o rótulo e o título num `<Reveal>` e a tabela noutro (`delay={0.1}`), como as outras seções. Renomeie `.problema-rotulo` para `.rotulo-parte` e `.problema-rotulo-ledgr` para `.rotulo-parte-ledgr` no CSS, em "Na prática" (que ainda existe nesta task) e no rótulo do jogo. Atualize o comentário do bloco no CSS para dizer que esses rótulos servem ao jogo e a "Por que o Ledgr". O `page.tsx` continua importando `LogoBarras`, que o hero usa (`hero-marca`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run "app/(marketing)/page.test.tsx"`
Expected: PASS. O teste do rodapé (`Por que o Ledgr` → `#por-que`) continua passando sem mudança.

- [ ] **Step 5: Commit**

```bash
npm run test && npm run lint && npm run build
git add "app/(marketing)/por-que.tsx" "app/(marketing)/page.tsx" "app/(marketing)/page.test.tsx" "app/(marketing)/ache-as-diferencas.tsx" app/globals.css
git commit -m "feat: Por que o Ledgr numa seção própria, com a comparação em tabela"
```

---

### Task 3: o Cap. II com o jogo, e a saída da demonstração antiga

**Files:**
- Modify: `app/(marketing)/page.tsx` (o Cap. II, nas linhas 468 a 534; os imports; uma constante nova `FATOS_DE_AGOSTO`)
- Rename: `app/(marketing)/comparacao.tsx` → `app/(marketing)/comparacao.ts` (fica só o tipo `LinhaExtrato`, sem `"use client"`)
- Delete: `app/(marketing)/comparacao.test.tsx`
- Modify: `app/(marketing)/tabela-folhas.tsx` (sai o caminho `interacao`)
- Modify: `app/globals.css` (sai o CSS da demonstração antiga e de "Na prática")
- Modify: `app/(app)/guia-de-estilo.test.ts:102` (sai `"demonstracao-folhas"` de `ESCOPOS`)
- Test: `app/(marketing)/page.test.tsx`

**Interfaces:**
- Consumes: `AcheAsDiferencas` e `PONTE` (Task 1).
- Produces: `FATOS_DE_AGOSTO: Record<string, string>` em `page.tsx`, com estes pares: `"Pagamento fornecedor #1082"` → `"R$ 36,00 a mais no banco"`, `"Crédito cartão D+30"` → `"R$ 0,05 de diferença"`, `"Tarifa de manutenção da conta"` → `"não está no sistema"` e `"Aluguel sede agosto"` → `"no sistema, 12/08"`. A `TabelaFolhas` passa a aceitar só `{ banco, sistema, setas?, destacada? }`.

- [ ] **Step 1: Reescrever os testes do Cap. II em `page.test.tsx`**

Saem estes quatro testes:
- `keeps the sticky header above the hover cards of the page`;
- `shows the bank vs. system statement comparison with a mismatch`;
- `names each line's status with the same labels the app uses`;
- `draws the demo with the same two-sheet table as the app window in Por dentro`.

Sai também o helper `demonstracao`. Entram, com `const problema = () => document.getElementById("problema")!`:
- `keeps the sticky header above the app card in Por dentro`: `#por-dentro .cartao-lancamento` existe e `Number(header.style.zIndex) > 20`.
- `tells the pain first: slow, tiring, and errors slip through`: `within(problema()).getByText("Todo fim de mês, alguém confere o extrato do banco contra o do sistema de gestão, item por item. É lento, cansa e um erro passa sem ninguém ver. Quanto maior o volume de lançamentos, pior fica, e o mês fecha sempre no aperto.")`.
- `puts the game right under the pain, and only the pain`:
  - o `h2` vem antes de `problema().querySelector(".ache")`;
  - não há `getByText("Na prática")`, `role="tooltip"`, `table` nem `.demonstracao-folhas` em `problema()`;
  - `problema().nextElementSibling` é `#como`.
- `plays with the same August lines as Por dentro`:
  - os botões da lista "Extrato do banco" têm nomes que começam pelas datas e descrições das linhas de `#por-dentro .vitrine-app .tabela-folhas tbody tr`, na mesma ordem;
  - a lista "Sistema de gestão" tem 4 itens, e um deles contém `"R$ 12.604,00"`.
- `says how many lines and differences there are`: `getByText("Cinco lançamentos de agosto. Marque os do banco que não batem com o sistema.")`; ao clicar "Ver o que passou" sem marcar nada, aparece `"Você não marcou nenhuma: passaram as 4."`.
- `reveals every difference with the app's label and the fact`: sem marcar nada, clicar "Ver o que passou" mostra os quatro textos:
  - `"Passou. Valor diverge · R$ 36,00 a mais no banco"`
  - `"Passou. Valor diverge · R$ 0,05 de diferença"`
  - `"Passou. Tarifa · não está no sistema"`
  - `"Passou. Data diverge · no sistema, 12/08"`
- `bridges to Como funciona after the reveal`: depois da revelação, aparecem o texto `PONTE` e o link "Ver como funciona" com `href="#como"`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "app/(marketing)/page.test.tsx"`
Expected: FAIL nos testes novos do Cap. II, porque o texto e o jogo ainda não estão lá.

- [ ] **Step 3: Montar o Cap. II**

- O parágrafo da abertura passa a ter o texto da spec.
- Depois do `InkHover` da abertura entra `<Reveal delay={0.1}><AcheAsDiferencas banco={EXTRATO_BANCO} sistema={EXTRATO_SISTEMA} fatos={FATOS_DE_AGOSTO} /></Reveal>`.
- Saem o bloco "Na prática", o `ExtratoComparacao` e a `DicaDoMouse`.
- Saem do `page.tsx` os imports que ficaram sem uso: `ExtratoComparacao` (o tipo `LinhaExtrato` passa a vir de `./comparacao` como `import type`) e `DicaDoMouse`, que `precos.tsx` ainda usa.
- O comentário da seção diz que ela é só a dor, com a ponte para o Cap. III.

- [ ] **Step 4: Tirar o que só a demonstração antiga usava**

- `comparacao.ts`: fica só o `export type LinhaExtrato`, com um comentário de uma linha dizendo que é uma linha de agosto da landing, de um lado ou dos dois.
- `tabela-folhas.tsx`: saem `InteracaoFolhas`, a prop `interacao`, o botão `celula-abrir`, os handlers e o `role="tooltip"`. O cartão só aparece em `b.desc === destacada`, sem `id`. Atualize o comentário do componente: ele desenha a janela de "Por dentro".
- `globals.css`: saem as regras com `.demonstracao-folhas` (as das linhas 1261 a 1319, e a classe nas listas `:is(...)` das linhas 1189 e 1255), as duas regras de `section:has(.demonstracao-folhas[data-explorado])` (linhas 544 e 545) e o bloco `.problema-pratica*`. Os comentários que citavam "a demonstração de 'O problema'" passam a falar só da janela de "Por dentro".
- `guia-de-estilo.test.ts`: `ESCOPOS` fica `new Set(["app-shell", "vitrine-app", "legal"])`.
- Confira com `grep -rn "demonstracao-folhas\|ExtratoComparacao\|InteracaoFolhas\|problema-pratica\|problema-rotulo" app`. O resultado esperado é vazio.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run test`
Expected: PASS na suíte inteira. Os testes de `precos.test.tsx` e o do guia de estilo continuam passando.

- [ ] **Step 6: Commit**

```bash
npm run test && npm run lint && npm run build
git add -A "app/(marketing)" app/globals.css "app/(app)/guia-de-estilo.test.ts"
git commit -m "feat: Cap. II só com a dor, no jogo Ache as diferenças, e sem a demonstração antiga"
```

---

### Task 4: conferir no navegador

**Files:**
- Modify: `C:\Users\Eduardo\Desktop\frontend\.claude\launch.json`, no checkout principal, que é de onde o `preview_start` lê. Entra a configuração `next-dev-cap-ii`, com `runtimeArgs` `["--prefix", ".worktrees/cap-ii-ache-as-diferencas", "run", "dev", "--", "-p", "3940"]` e `port` 3940.
- Modify: o que a conferência mostrar errado (CSS e, se for o caso, o componente), com teste quando o erro for de comportamento.

- [ ] **Step 1: Subir a prévia do worktree e abrir `http://localhost:3940/` no Playwright, a 1440×900**

- [ ] **Step 2: Conferir o Cap. II a 1440, 768 e 390 px**

O que tem que dar certo:
- as folhas ficam lado a lado nos três tamanhos;
- a 390 px, as linhas viram duas e a descrição corta com reticências, sem rolagem lateral: `document.documentElement.scrollWidth <= innerWidth`;
- as linhas desalinham a partir da tarifa;
- a altura de `#problema` a 390 px fica bem abaixo dos ~3.700 px de hoje.

Tire os prints da seção antes e depois da revelação.

- [ ] **Step 3: Jogar com o teclado e com movimento reduzido**

- **Teclado:** Tab até a primeira linha, espaço marca, Tab segue e Enter revela. O foco vai para "Tentar de novo"; Enter recomeça e o foco volta para a primeira linha.
- **Movimento reduzido:** com `page.emulateMedia({ reducedMotion: "reduce" })`, as notas aparecem todas de uma vez.
- **Toque:** numa página nova com `hasTouch: true` e `isMobile: true` (pelo `page.context().browser().newContext(...)`), a instrução diz "Toque".

- [ ] **Step 4: Conferir "Por que o Ledgr" a 1440, 768 e 390 px**

- **A partir de 760 px:** é tabela, e a borda direita da coluna do Ledgr fica dentro do contêiner (`getBoundingClientRect().right` da última `th.por-que-ledgr` menor ou igual ao `right` do contêiner menos o `padding`).
- **A 390 px:** são blocos por pergunta, a resposta do Ledgr por último, com o filete.
- **O link do rodapé:** "Por que o Ledgr" desce até a seção, com o título abaixo do cabeçalho fixo.

Tire um print em cada largura.

- [ ] **Step 5: Corrigir o que apareceu, rodar e commitar**

```bash
npm run test && npm run lint && npm run build
git add -A app
git commit -m "fix: ajustes do Cap. II e de Por que o Ledgr vistos no navegador"
```

Se nada precisar de ajuste, não há commit nesta task. Mande ao usuário os prints do passo 2 e do passo 4.
