# Coluna "Agora" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma coluna fixa à direita nas sete telas com tutorial, que diz o que fazer agora, recebe o tutorial do mascote (ligado ao alvo pelo fio em onda) e os painéis de Extratos e Fechamentos.

**Architecture:** A moldura (`app/(app)/shell.tsx`) ganha um `ProvedorDaColuna` e o `<ColunaAgora>`, que reserva o espaço, recolhe, vira painel nas telas menores e expõe dois "encaixes" (Agora e Tutorial). Cada tela desenha o seu "Agora" com `<ColunaDaTela>`, que usa `createPortal` para o encaixe; o tutorial faz o mesmo no encaixe dele. O fio em onda é um SVG numa camada fixa, calculado por uma função pura.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest + Testing Library (jsdom), CSS em `app/globals.css`, ícones `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-20-coluna-agora-design.md`

## Global Constraints

- Telas com coluna: `visao-geral`, `conciliacoes`, `nova-conciliacao`, `comparacao`, `extratos`, `historico`, `fechamentos` (valores de `TelaDoTutorial`). Sem coluna: `divergencia` em página inteira, `configuracoes`, Assinatura, Central de ajuda, relatório.
- Largura da coluna: 340px. Ela aparece fixa a partir de 1280px (`@media (min-width: 1280px)` e `matchMedia("(min-width: 1280px)")`); abaixo disso, botão "Agora" na barra do topo e painel por cima (da direita até 900px, folha de baixo abaixo de 900px).
- Recolhida: `localStorage["ledgr_coluna"]` = `"recolhida"` | `"aberta"`, espelhado em `document.documentElement.dataset.coluna`, escrito pelo script do `<head>` em `app/layout.tsx` antes da primeira pintura (como `ledgr_menu`).
- Fio em onda: `--color-accent`, período 17px (meia onda 8,5px), amplitude 3px, traço 1,2px; ponta de dois traços de 7px a ±28° da direção final, sem preenchimento. Desenha em 0,45s `cubic-bezier(0.22, 1, 0.36, 1)`; com `prefers-reduced-motion: reduce`, aparece pronto.
- Tutorial: texto 16px (era 14,5px); título maior que o atual.
- Nenhuma chamada nova ao backend: o "Agora" usa só o que a página já carregou.
- Textos em português, como os da tela; nada de copy nova além da que está neste plano e na spec.
- Antes de cada commit: os testes do arquivo mexido passam; antes do PR: `npm run test && npm run lint && npm run build`.

## Review Focus

1. **Detalhe da linha por cima da Comparação** (`/conciliacoes/[id]/[linha]` interceptado): o endereço vira `divergencia`, mas a Comparação continua montada embaixo. A coluna deve continuar (Task 1). Na página inteira da linha, sem Comparação embaixo, não há coluna.
2. **Tutorial com a coluna recolhida**, aberto pelo "Rever o tutorial": a coluna abre e, ao fechar o tutorial, volta a recolher, sem gravar "aberta" no `localStorage` (Task 4).
3. **Alvo que some no meio do passo** (filtro trocado, linha que sai da lista): o fio e o recorte somem sem erro, e o próximo quadro não desenha nada (Task 5).
4. **Troca de tela com o painel das telas menores aberto**: o painel fecha e o "Agora" da tela nova não herda o da anterior (Task 2).
5. **`localStorage` bloqueado** (modo privado, `setItem` lança): recolher funciona na sessão e não quebra a tela (Task 1).

---

### Task 1: A coluna na moldura (estado, encaixes e layout)

**Files:**
- Create: `app/(app)/coluna/estado.ts`, `app/(app)/coluna/coluna.tsx`
- Modify: `app/(app)/shell.tsx`, `app/layout.tsx:143` (script do `<head>`), `app/globals.css` (bloco novo "Coluna Agora" perto de `.app-principal`, ~linha 3538)
- Test: `app/(app)/coluna/estado.test.ts`, `app/(app)/coluna/coluna.test.tsx`

**Interfaces:**
- Produces (`estado.ts`): `CHAVE_COLUNA = "ledgr_coluna"`; `colunaRecolhida(): boolean` (lê `dataset.coluna`, como `menuRecolhido` em `app/(app)/menu.ts`); `definirColuna(recolhida: boolean, { gravar = true } = {}): void` (escreve o atributo e, com `gravar`, o `localStorage`, em try/catch); `TELAS_COM_COLUNA: ReadonlySet<TelaDoTutorial>`; `temColuna(tela: TelaDoTutorial | null): boolean`.
- Produces (`coluna.tsx`): `ProvedorDaColuna({ children })`; `useColuna(): { encaixeAgora: HTMLElement | null; encaixeTutorial: HTMLElement | null; largas: boolean; painelAberto: boolean; abrirPainel(): void; fecharPainel(): void; mostrarParaTutorial(): () => void; pendente: boolean }`; `ColunaAgora()` (o `<aside className="coluna-agora" aria-label="O que fazer agora">` com botão "Recolher a coluna"/"Abrir a coluna", o `<div>` do encaixe Agora, o `<div>` do encaixe Tutorial e o espaço da ajuda, que a Task 3 preenche); `ColunaDaTela({ children, pendente = false }: { children: ReactNode; pendente?: boolean })`.
- `mostrarParaTutorial()` abre a coluna (largas: `definirColuna(false, { gravar: false })`; menores: `abrirPainel()`) e devolve a função que desfaz só o que ele mudou.

- [ ] **Step 1: Testes de `estado.ts`**: `temColuna` é true para as sete telas, false para `divergencia`, `configuracoes` e `null`; `definirColuna(true)` põe `dataset.coluna = "recolhida"` e grava `ledgr_coluna`; `definirColuna(false, { gravar: false })` muda o atributo e não toca o `localStorage`; com `localStorage.setItem` lançando, o atributo muda mesmo assim (Review Focus 5).
- [ ] **Step 2: Rodar** `npx vitest run "app/(app)/coluna/estado.test.ts"`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3: Implementar `estado.ts`** com as assinaturas acima.
- [ ] **Step 4: Testes de `coluna.tsx`**, montando `<ProvedorDaColuna><ColunaAgora/><ColunaDaTela>…</ColunaDaTela></ProvedorDaColuna>`:
  - o conteúdo de `ColunaDaTela` aparece dentro de `getByRole("complementary", { name: "O que fazer agora" })`;
  - o botão "Recolher a coluna" põe `data-coluna="recolhida"` e vira "Abrir a coluna";
  - `ColunaDaTela pendente` deixa `useColuna().pendente` true; ao desmontar, volta a false;
  - Review Focus 1: com `tela = "divergencia"` e uma `ColunaDaTela` montada, o `<aside>` continua; sem nenhuma montada, `ColunaAgora` não desenha nada.
- [ ] **Step 5: Rodar** `npx vitest run "app/(app)/coluna"`. Esperado: FAIL.
- [ ] **Step 6: Implementar `coluna.tsx`.** Os encaixes chegam por `ref` de callback guardada em estado (para o portal re-renderizar quando existirem). Quantas `ColunaDaTela` estão montadas é um contador no provedor. A coluna existe quando `temColuna(telaDoCaminho(pathname)) || (tela === "divergencia" && montadas > 0)`. `largas` vem de `matchMedia("(min-width: 1280px)")`, com escuta de `change`.
- [ ] **Step 7: Encaixar na moldura.** Em `shell.tsx`, `ProvedorDaColuna` por fora de `MenuLateral` e do `<main>`. Dentro de `.app-principal`, depois de `BarraSuperior`, um `<div className="app-corpo">` com `.app-conteudo` e `<ColunaAgora />`. No `app/layout.tsx`, o script do `<head>` lê também `ledgr_coluna` para `d.coluna`.
- [ ] **Step 8: CSS.** `.app-corpo` em grid `minmax(0, 1fr) 340px` só com `@media (min-width: 1280px)` e `:has(> .coluna-agora)`. Recolhida (`html[data-coluna="recolhida"]`): `minmax(0, 1fr) 48px`, e só o botão de abrir à mostra. O conteúdo da coluna fica `position: sticky; top: var(--app-topo-altura)`, com `max-height: calc(100dvh - var(--app-topo-altura))` e rolagem própria, para o cartão do tutorial nunca sair da tela (isso refina o "rola junto" da spec, para o fio sempre ter de onde sair). Abaixo de 1280px, `.coluna-agora` é escondida, e a Task 2 cuida do painel.
- [ ] **Step 9: Rodar** `npx vitest run "app/(app)/coluna" "app/(app)/shell.test.tsx"`. Esperado: PASS.
- [ ] **Step 10: Commit** `feat(coluna): coluna Agora na moldura do app, com recolher lembrado`

### Task 2: Telas menores: botão "Agora" e painel por cima

**Files:**
- Modify: `app/(app)/coluna/coluna.tsx`, `app/(app)/barra-superior.tsx` (botão ao lado de `MenuDeAjuda`), `app/globals.css`
- Test: `app/(app)/coluna/coluna.test.tsx`, `app/(app)/barra-superior.test.tsx`

**Interfaces:**
- Consumes: `useColuna()` da Task 1.
- Produces: `BotaoAgora()`, exportado de `coluna.tsx`. Desenhado na barra do topo só quando a tela tem coluna e `largas` é false. Leva `aria-expanded`, o rótulo "Agora" e um ponto `.coluna-ponto` quando `pendente`.

- [ ] **Step 1: Testes** (com `matchMedia` falso devolvendo `matches: false`):
  - o botão "Agora" aparece e o `<aside>` não fica à mostra;
  - clicar abre o painel (`role="dialog"`, nome "O que fazer agora", não modal) com o conteúdo da `ColunaDaTela`;
  - Esc e "Fechar" fecham e devolvem o foco ao botão;
  - o ponto aparece com `pendente`;
  - Review Focus 4: trocar o `pathname` (mock de `usePathname`) com o painel aberto fecha o painel;
  - com `matches: true`, o botão não aparece.
- [ ] **Step 2: Rodar** e ver FAIL.
- [ ] **Step 3: Implementar.** É o mesmo `<aside>` da Task 1. Nas telas menores, ele ganha `data-painel="aberto"` e `role="dialog"` quando aberto, e o CSS o posiciona: fixo à direita com 340px e a sombra de `.ajd-painel` até 900px; folha de baixo com `max-height: 70dvh` abaixo de 900px. Use a mesma animação `ajd-painel-entra`, respeitando o movimento reduzido.
- [ ] **Step 4: Rodar** `npx vitest run "app/(app)/coluna" "app/(app)/barra-superior.test.tsx"`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(coluna): botão Agora e painel por cima nas telas menores`

### Task 3: A ajuda da tela dentro da coluna

**Files:**
- Modify: `app/(app)/coluna/coluna.tsx` (bloco de ajuda), `app/(app)/ajuda/painel-de-ajuda.tsx` (`PainelDaRota` só nas telas sem coluna), `app/(app)/ajuda/menu-de-ajuda.tsx`, `lib/eventos.ts`
- Test: `app/(app)/ajuda/painel-de-ajuda.test.tsx`, `app/(app)/ajuda/menu-de-ajuda.test.tsx`, `app/(app)/coluna/coluna.test.tsx`

**Interfaces:**
- Consumes: `ajudaDaTela(tela)` e `PassosDaAjuda`, `NotaDaAjuda` (`app/(app)/ajuda/blocos.tsx`), `temColuna`, `useColuna().abrirPainel`.
- Produces: em `lib/eventos.ts`, `MOSTRAR_AJUDA_NA_COLUNA = "ledgr:mostrar-ajuda-na-coluna"` e `mostrarAjudaNaColuna(): void`. O bloco tem `id="coluna-ajuda"` e `aria-labelledby` apontando para o título "Ajuda desta tela".

- [ ] **Step 1: Testes:**
  - na `comparacao`, a coluna mostra "Ajuda desta tela" com os passos de `ajudaDaTela("comparacao")` e o link "Abrir na Central" para `/ajuda/comparacao`;
  - no `historico` (sem página), o bloco mostra só o link "Central de ajuda" para `/ajuda`;
  - no menu Ajuda, numa tela com coluna, "Ajuda desta tela" chama `mostrarAjudaNaColuna` e `PainelDaRota` não abre;
  - numa tela sem coluna com página (`divergencia`), o painel abre como hoje.
- [ ] **Step 2: Rodar** e ver FAIL.
- [ ] **Step 3: Implementar.** O provedor escuta `MOSTRAR_AJUDA_NA_COLUNA`. Em tela larga, abre a coluna se estiver recolhida (sem gravar), rola `#coluna-ajuda` para a vista e foca o título. Nas telas menores, `abrirPainel()` e depois a mesma rolagem. O menu Ajuda passa a mostrar "Ajuda desta tela" também nas telas com coluna sem página, levando ao link da Central.
- [ ] **Step 4: Rodar** `npx vitest run "app/(app)/ajuda" "app/(app)/coluna"`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(coluna): ajuda da tela dentro da coluna`

### Task 4: O tutorial dentro da coluna

**Files:**
- Modify: `app/(app)/tutorial/tutorial.tsx`, `app/globals.css` (`.tutorial*`, ~linhas 4428–4520)
- Test: `app/(app)/tutorial/tutorial.test.tsx`

**Interfaces:**
- Consumes: `useColuna().encaixeTutorial`, `mostrarParaTutorial()`, `temColuna`.
- Produces: o cartão continua com `role="dialog"`, `className="card tutorial"` e o mesmo `aria-labelledby`, agora desenhado por `createPortal` no encaixe. Nas telas sem coluna (`configuracoes`), o cartão fica onde está hoje.

- [ ] **Step 1: Ajustar os testes atuais** (os 12 de `tutorial.test.tsx`) para montar `ProvedorDaColuna` + `ColunaAgora` e achar o cartão dentro do `<aside>`. Novos testes:
  - com `data-coluna="recolhida"`, abrir o tutorial tira o atributo de recolhida e fechar o devolve, sem `localStorage.setItem("ledgr_coluna", …)` (Review Focus 2);
  - nas telas menores, abrir o tutorial abre o painel;
  - em `configuracoes`, o cartão continua fora do `<aside>`.
- [ ] **Step 2: Rodar** `npx vitest run "app/(app)/tutorial"` e ver FAIL.
- [ ] **Step 3: Implementar.** `abrir()` chama `mostrarParaTutorial()` e guarda o desfazer num `useRef`; `fechar()` e a desmontagem chamam o desfazer. `trazerParaAVista` deixa de descontar o cartão embaixo nas telas largas (ele não está mais por cima). Nas telas menores, desconta a altura do painel.
- [ ] **Step 4: CSS.** `.tutorial` perde `position: fixed`, `right`, `bottom` e `width` dentro de `.coluna-agora` (fica com a largura da coluna). `.tutorial-texto` vai para 16px e `.tutorial-titulo` sobe um degrau na escala do app. Fora da coluna, mantém as regras de hoje.
- [ ] **Step 5: Rodar** `npx vitest run "app/(app)/tutorial" "app/(app)/coluna"`. Esperado: PASS.
- [ ] **Step 6: Commit** `feat(tutorial): cartão do mascote dentro da coluna, maior e sem tapar a tela`

### Task 5: O fio em onda do cartão até o alvo

**Files:**
- Create: `app/(app)/tutorial/fio.ts`, `app/(app)/tutorial/fio-do-tutorial.tsx`
- Modify: `app/(app)/tutorial/tutorial.tsx` (montar o fio junto do véu), `app/globals.css`
- Test: `app/(app)/tutorial/fio.test.ts`, `app/(app)/tutorial/tutorial.test.tsx`

**Interfaces:**
- Produces (`fio.ts`):
  - `type Ponto = { x: number; y: number }`;
  - `caminhoDoFio(de: Ponto, para: Ponto): string`: o `d` do SVG, só `M` e `Q`;
  - `pontaDoFio(de: Ponto, para: Ponto): string`: dois segmentos `M…L…`;
  - `pontasDoFio(cartao: DOMRect, alvo: DOMRect, largas: boolean): { de: Ponto; para: Ponto } | null`. Nas telas largas, sai do meio da borda esquerda do cartão e chega ao meio da borda direita do alvo, recuado 8px (a `FOLGA` do recorte). Nas menores, sai do meio da borda de cima do painel e chega ao meio da borda de baixo do alvo. Devolve `null` se o alvo tem área zero ou está fora da janela.
- Produces (`fio-do-tutorial.tsx`): `FioDoTutorial({ cartao, alvo, largas }: { cartao: HTMLElement | null; alvo: HTMLElement | null; largas: boolean })`, um `<svg className="tutorial-fio" aria-hidden="true">` fixo na tela inteira.

- [ ] **Step 1: Testes de `fio.ts`:**
  - `caminhoDoFio({x:0,y:0},{x:85,y:0})` começa em `M0 0`, tem 10 `Q` (85 / 8,5) e termina em `85 0`;
  - os pontos de controle alternam +3 e −3 na perpendicular;
  - uma distância que não é múltipla de 8,5 arredonda o número de meias ondas e termina exatamente em `para`;
  - `pontaDoFio` tem dois traços de 7px a ±28° de `para`;
  - `pontasDoFio` devolve `null` para um alvo de área zero e para um alvo todo fora da janela (Review Focus 3).
- [ ] **Step 2: Rodar** `npx vitest run "app/(app)/tutorial/fio.test.ts"` e ver FAIL.
- [ ] **Step 3: Implementar `fio.ts`.** Divida a reta `de→para` em `n = max(1, round(dist / 8.5))` trechos iguais. Cada trecho é um `Q` com o ponto de controle no meio do trecho, deslocado 3px na perpendicular, alternando o sinal.
- [ ] **Step 4: Testes do componente**, em `tutorial.test.tsx`, com `getBoundingClientRect` falso como os testes do véu já fazem: com o tutorial aberto e alvo visível, existe `.tutorial-fio path` com `d` igual a `caminhoDoFio(...)` das pontas esperadas; ao trocar de passo, o `d` muda; sem alvo, nenhum `path`; ao fechar, o SVG some.
- [ ] **Step 5: Implementar `FioDoTutorial`.** Um laço de `requestAnimationFrame`, como `seguir()` no `tutorial.tsx`, que só reescreve o `d` quando ele muda. Para o desenho a cada passo, use `pathLength="1"` com `stroke-dasharray: 1` e animação de `stroke-dashoffset` de 1 a 0 em 0,45s, reiniciada pela `key` do passo. Com `prefers-reduced-motion: reduce`, sem animação.
- [ ] **Step 6: CSS.** `.tutorial-fio { position: fixed; inset: 0; z-index: 59; pointer-events: none; }`, acima do véu e abaixo do cartão. Traço `stroke: var(--color-accent); stroke-width: 1.2; fill: none; stroke-linecap: round`.
- [ ] **Step 7: Rodar** `npx vitest run "app/(app)/tutorial"`. Esperado: PASS.
- [ ] **Step 8: Commit** `feat(tutorial): fio em onda liga o cartão ao que ele explica`

### Task 6: "Agora" de Conciliações

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`, `app/(app)/dashboard/em-andamento.tsx`, `app/globals.css` (`.conc-continuar` no formato da coluna)
- Test: `app/(app)/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `ColunaDaTela` (Task 1); `ContinueDeOndeParou`, `ListaDeConciliacoes`, `pedemDecisao`, `resposta.dados.fechamentos`.
- Produces: `AgoraDeConciliacoes({ emAndamento, prontoParaFechar }: { emAndamento: { conciliacao: ConciliacaoNaLista; contagem: NonNullable<ListaDeConciliacoes["emAndamento"]> } | null; prontoParaFechar: { competencia: string; titulo: string } | null })`, em `em-andamento.tsx`.

- [ ] **Step 1: Testes:**
  - os três que procuram a região "Continue de onde parou" passam a achá-la dentro da coluna, e não antes da lista;
  - sem pendência e com um mês pronto, a coluna diz "Fechamento de setembro" com link para `/fechamentos?mes=<competencia>` (o mesmo destino do link "Fechamento de setembro" da lista);
  - sem pendência e sem mês pronto: link "Nova conciliação" para `/conciliacoes/nova`;
  - com pendência, `ColunaDaTela` recebe `pendente`.
- [ ] **Step 2: Rodar** `npx vitest run "app/(app)/dashboard"` e ver FAIL.
- [ ] **Step 3: Implementar.** O `page.tsx` tira a `ContinueDeOndeParou` de `.conc-corpo` e desenha `<ColunaDaTela pendente={emAndamento !== null}><AgoraDeConciliacoes …/></ColunaDaTela>`. O mês pronto é o primeiro de `fechamentos` que a lista já marca como pronto. Use o mesmo critério da `ListaDeTrabalho`, sem regra nova.
- [ ] **Step 3b: CSS da fila.** Com a coluna aberta (`.app-corpo:has(> .coluna-agora)` a partir de 1280px), as colunas Progresso e Última atividade da `ListaDeTrabalho` ficam mais estreitas, e "14 de 44 batem" e "Rodada 1" quebram embaixo, como já fazem. Confira a 1280px que nenhuma célula transborda.
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `feat(conciliacoes): Continue de onde parou vai para a coluna Agora`

### Task 7: "Agora" de Visão geral e Histórico

**Files:**
- Modify: `app/(app)/visao-geral/page.tsx`, `app/(app)/historico/page.tsx`
- Create: `app/(app)/visao-geral/agora.tsx`, `app/(app)/historico/agora.tsx`
- Test: `app/(app)/visao-geral/page.test.tsx`, `app/(app)/historico/page.test.tsx`

**Interfaces:**
- Consumes: `passosDoRoteiro`, `roteiroVisivel`, `pendencias(conciliacao)` (`visao-geral/pendencias.ts`), `porConciliacao`, `paraRevisar` (`historico/execucoes.ts`), `caminhoDaConciliacao` (`lib/caminhos`).
- Produces: `AgoraDaVisaoGeral({ proximo, pendente }: { proximo: PassoDoRoteiro | null; pendente: { mes: string; quantidade: number; href: string } | null })` e `AgoraDoHistorico({ conciliacao }: { conciliacao: { titulo: string; quantidade: number; href: string } | null })`.

- [ ] **Step 1: Testes:**
  - Visão geral com roteiro ativo: a coluna mostra o primeiro passo com `feito: false` e o botão do destino dele. Para destino `configuracoes`, o botão chama `abrirConfiguracoes("conciliacao")`.
  - Visão geral sem roteiro e com pendências no `recente`: "N pendências em <mês>", com link para a comparação.
  - Visão geral sem as duas coisas: "Tudo em dia".
  - Histórico: a primeira conciliação de `porConciliacao(execucoes)` com `paraRevisar(execucao vigente) > 0`, com link para a comparação. Sem nenhuma: "Tudo em dia".
- [ ] **Step 2: Rodar** `npx vitest run "app/(app)/visao-geral" "app/(app)/historico"` e ver FAIL.
- [ ] **Step 3: Implementar** os dois componentes e desenhá-los com `<ColunaDaTela pendente={…}>` nas páginas. São componentes de servidor que passam dados prontos para `ColunaDaTela`, que é de cliente.
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `feat(coluna): Agora da Visão geral e do Histórico`

### Task 8: "Agora" de Nova conciliação e Comparação

**Files:**
- Modify: `app/(app)/conciliacoes/nova/page.tsx`, `app/(app)/conciliacoes/[id]/page.tsx`
- Test: `app/(app)/conciliacoes/nova/page.test.tsx`, `app/(app)/conciliacoes/[id]/page.test.tsx`

**Interfaces:**
- Consumes: os estados que as páginas já têm. Na Nova: `arquivoBanco`, `arquivoSistema`, `etapa`. Na Comparação: `emRevisao`, `conferidas`, `escolherFiltro`, o `fechamento` de `ConciliacaoEmRodadas`.
- Produces: nenhum export novo. Os dois "Agora" são componentes locais nas páginas.

- [ ] **Step 1: Testes:**
  - Nova: a coluna lista "Extrato do banco", "Extrato do sistema" e "Conciliar". Os dois primeiros se marcam (`aria-checked` ou ✓ com texto acessível "feito") ao escolher cada arquivo, e "Conciliar" só fica marcado com `etapa` concluída.
  - Comparação com 30 em revisão e 0 conferidas: "30 linhas pedem decisão · 0 de 30 conferidas". "Mostrar só o que pede decisão" põe o filtro `revisao`, e a pill "Só revisão" fica `aria-pressed`.
  - Comparação com 0 em revisão: "Mês pronto para fechar", com link para `/fechamentos`.
  - Comparação com o mês fechado: o texto de mês fechado e o link para reabrir em Fechamentos, iguais aos que a tela já mostra.
- [ ] **Step 2: Rodar** `npx vitest run "app/(app)/conciliacoes/nova" "app/(app)/conciliacoes/[id]/page.test.tsx"` e ver FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `feat(coluna): Agora da Nova conciliação e da Comparação`

### Task 9: Extratos e Fechamentos: o painel vai para a coluna

**Files:**
- Modify: `app/(app)/extratos/galeria.tsx` (`Painel`, linha ~277), `app/(app)/fechamentos/mesa.tsx` (`Painel`, linha ~263), `app/globals.css` (`.extrato-painel` sem a moldura de coluna própria; o grid das duas telas sem a coluna do painel)
- Test: `app/(app)/extratos/galeria.test.tsx`, `app/(app)/extratos/page.test.tsx`, `app/(app)/fechamentos/page.test.tsx`

**Interfaces:**
- Consumes: `ColunaDaTela`.
- Produces: nenhum export novo. `Galeria` e `MesaDeFechamento` desenham `<ColunaDaTela pendente={…}><Painel …/></ColunaDaTela>` no lugar do `Painel` ao lado.

- [ ] **Step 1: Testes.** Os testes atuais do painel (`aria-label` "Arquivo selecionado" e "Mês selecionado") passam a achá-lo dentro da coluna. Novos:
  - Extratos com lista vazia: "Envie o primeiro extrato", com link para `/conciliacoes/nova`;
  - Extratos com algum arquivo com problema de leitura: o atalho põe o filtro desses arquivos;
  - em Fechamentos, `pendente` é true quando o mês escolhido tem pendências.
- [ ] **Step 2: Rodar** `npx vitest run "app/(app)/extratos" "app/(app)/fechamentos"` e ver FAIL.
- [ ] **Step 3: Implementar.** Mexa só no lugar onde o painel é desenhado e no CSS do grid. O conteúdo dos painéis não muda.
- [ ] **Step 4: Rodar.** Esperado: PASS.
- [ ] **Step 5: Commit** `feat(coluna): painéis de Extratos e Fechamentos na coluna Agora`

### Task 10: Verificação e PR

**Files:**
- Modify: `CLAUDE.md` (uma linha em "Backend status" sobre a coluna "Agora" e onde ela mora), `.claude/launch.json` da raiz (configuração `next-dev-coluna-agora`, porta 3980)

- [ ] **Step 1: Rodar** `npm run test && npm run lint && npm run build`. Esperado: tudo passa, e a tabela de rotas do build é igual à do `develop`.
- [ ] **Step 2: No navegador** (`preview_start` com `next-dev-coluna-agora`, backend local segundo `rodar_app_localmente`), nas sete telas: a 1440px, a 1280px, a 1024px e a 390px, temas claro e escuro. Conferir:
  - a coluna e o recolher, lembrado ao recarregar sem piscar;
  - o tutorial na coluna, com o fio chegando ao alvo enquanto a página rola;
  - o painel nas telas menores;
  - o detalhe da linha aberto por cima da Comparação, com a coluna parada.
- [ ] **Step 3: Commit** `docs: coluna Agora no CLAUDE.md` e abrir o PR `feat/coluna-agora` → `develop`, com prints das larguras no corpo.
