# Consentimento da conexão na proposta B: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** redesenhar `/autorizar-conexao` no layout da proposta B do artefato "Consentimento da conexão", em que a pessoa lê à esquerda e decide à direita.

**Arquitetura:** só a apresentação muda. O componente `Consentimento` mantém os mesmos estados, as Server Actions e as regras: um envio por vez, uma empresa já vem marcada quando é a única, o 404 troca a tela, o analista só recusa. Os estilos inline e as classes `.consent*` dão lugar a classes novas no `globals.css`, com tokens, o que deixa o modo escuro e o celular corretos. O título usa as duas vozes da landing (`.titulo-misto`), com o itálico carregado só nesta página, como já faz `/plano`.

**Stack:** Next.js (App Router), React, Vitest + Testing Library e `next/font/local` (`fonteDestaque`).

**Fonte do desenho:** a proposta B, "Ler e decidir lado a lado", do artefato https://claude.ai/artifact/XwAqSsdTcX9zewEkhoNbRY, arquivo `project/Proposta-B.dc.html`.

## Restrições globais

- Dourado só na ação principal: "Autorizar a leitura →" é `.btn .btn-primary`, um contorno dourado com texto #7d5411, como no guia v5. "Recusar" é `.btn .btn-secondary`.
- Seleção neutra: a empresa marcada recebe a tinta ativa (`rgba(32,31,29,0.09)`) e um filete de 2px à esquerda na cor do texto. Nada de dourado na seleção.
- Sem ícones decorativos, sem sombra e sem cor de status. A única exceção é o alerta de loopback, que já é terracota (`--color-erro`).
- Rótulos de 12px em maiúsculas, com +0.08em. O eyebrow usa `p.eyebrow` (JetBrains Mono 600 14px em #7d5411).
- Título: `<h1 className="titulo-misto">Conectar o {cliente} <em>ao Ledgr.</em></h1>`. O wrapper recebe `fonteDestaque.variable`, que vem de `app/(marketing)/fonte-destaque.ts`.
- Mascote: `/mascotes/mascote-conexao.webp` (1966×794) como marca d'água, com `aria-hidden`, `alt=""`, opacidade 0.06 e `pointer-events: none`, no canto inferior esquerdo da moldura. Segue a regra do guia ("marca d'água apagada ao fundo").
- Os textos de "lê" e "nunca sai" repetem a Política (`/privacidade#conexao-ia`, #361). Não invente outros.
- Baseie-se em `docs/mcp-tutorial` (#364), que já tem o link da Central na tela. Se #364 já estiver em `develop`, use `develop`. Trabalhe num worktree `.worktrees/consentimento-b`, branch `feat/consentimento-proposta-b`.

## Foco da revisão

1. **Celular (375px):** as duas colunas viram uma só, com o painel "Sua decisão" abaixo das listas. As duas listas também ficam uma embaixo da outra, e nada rola na horizontal.
2. **Modo escuro:** a folha do painel usa um token de superfície em vez de #fdfcfa fixo, e a marca d'água continua discreta sobre o fundo escuro.
3. **Analista:** no painel aparece o aviso "Só o admin ou o gestor…" no lugar das empresas, e só o botão Recusar. O título do painel continua "Sua decisão".
4. **Loopback:** o alerta fica na coluna da esquerda, logo abaixo do subtítulo, e a frase "passa para o programa que pediu" continua.
5. **Nome longo do cliente ou do host:** o título quebra com `text-wrap: balance`, e o host em mono usa `overflow-wrap: anywhere`, de modo que nada vaza da coluna.

---

### Tarefa 1: o novo layout no componente

**Arquivos:**
- Modificar: `app/(auth)/autorizar-conexao/consentimento.tsx`, só o retorno do estado `pronto`, além de `estiloTitulo` e `estiloTexto` se sobrarem sem uso.
- Teste: `app/(auth)/autorizar-conexao/consentimento.test.tsx`

**Interfaces:**
- Consome: `PedidoDeConexao` (`cliente`, `origem.host`, `origem.loopback`, `descricaoEscopo`, `expiraEm`, `empresas`), sem mudança.
- Produz: as classes que a Tarefa 2 estiliza, listadas abaixo.

| Classe | Uso |
|---|---|
| `.consent` | raiz e grade |
| `.consent-ler` | coluna da esquerda |
| `.consent-listas` | grade das duas listas |
| `.consent-lista` | cada lista |
| `.consent-item` | linha numerada |
| `.consent-num` | número da linha |
| `.consent-decisao` | painel da direita, um `<section aria-labelledby>` |
| `.consent-decisao-topo` | rótulo "Sua decisão" e "vale até HH:MM" |
| `.consent-empresa` | linha de rádio |
| `.consent-empresa[data-marcada]` | linha marcada |
| `.consent-botoes` | coluna com os dois botões |
| `.consent-marca` | marca d'água |
| `.consent-host`, `.consent-alerta`, `.consent-rotulo`, `.consent-cnpj`, `.consent-nota` | ficam com o mesmo papel |

- [ ] **Passo 1: ajustar os testes ao texto novo (devem falhar)**

  No teste "diz quem pede…":
  - O título passa a ser `findByRole("heading", { level: 1, name: "Conectar o Claude ao Ledgr." })`.
  - Inclua:
    - `screen.getByText("Pedido de conexão · só leitura")`;
    - `screen.getByRole("list", { name: "O Claude lê" })`, com 3 `listitem`;
    - `screen.getByRole("list", { name: "Nunca sai do Ledgr" })`, com 3 `listitem`, um deles com o texto "A descrição dos lançamentos";
    - `screen.getByRole("region", { name: "Sua decisão" })`;
    - `screen.getByText(/vale até/i)`.
  - A expectativa `/Só leitura/` vira `/não muda nada no Ledgr/`.
  - Continua valendo `getByText(/Ler o status das conciliações/)`, porque `descricaoEscopo` é exibido.

  Em todos os testes que clicam em "Autorizar", o nome do botão passa a ser `"Autorizar a leitura →"`, e o rótulo durante o envio é "Autorizando…".

  Teste novo: "a marca d'água do mascote fica escondida do leitor de tela". Monta o componente, faz `container.querySelector(".consent-marca img")` e espera `alt=""` e o pai com `aria-hidden="true"`.

- [ ] **Passo 2:** rodar `npx vitest run "app/(auth)/autorizar-conexao"`. Esperado: FAIL nos títulos, nas listas e no botão.

- [ ] **Passo 3: reescrever o retorno do estado `pronto`**

  `MolduraAuth` recebe `rotulo="Conexão"` e `larguraConteudo={1020}`. A raiz é `<div className={`consent ${fonteDestaque.variable}`}>`.

  Coluna da esquerda (`.consent-ler`), nesta ordem:
  - `p.eyebrow` com "Pedido de conexão · só leitura";
  - o `h1.titulo-misto`;
  - o parágrafo "O pedido vem de **host**. Você está no Ledgr como {email}.";
  - o alerta de loopback, quando houver;
  - `p` com `descricaoEscopo`;
  - `.consent-listas` com duas `<ul aria-labelledby>`:
    - "O {cliente} lê": Extratos e conciliações de cada mês · Divergências: categoria, data, valor e situação · Fechamentos dos meses;
    - "Nunca sai do Ledgr": A descrição dos lançamentos · O texto das justificativas e das ressalvas · Nomes de pessoas ou de arquivos;
  - a nota "Não confere, não justifica, não fecha mês e não muda nada no Ledgr.", seguida da frase de privacidade que já existe (com a variação de loopback) e do link da Política em outra aba.

  Os números 01–03 ficam num `<span className="consent-num" aria-hidden="true">`.

  Painel da direita (`section.consent-decisao`):
  - topo com `<h2 className="consent-rotulo">Sua decisão</h2>` e "vale até {hora(expiraEm)}";
  - o fieldset de empresas que já existe, com a legenda "De qual empresa?". Cada `label` recebe `data-marcada` quando `empresa === opcao.id`;
  - ou, para o analista, o aviso que já existe;
  - `MensagemErro`;
  - `.consent-botoes`, com Autorizar e Recusar empilhados;
  - a nota de revogação com o link da Central, que já existe.

  Por último, como filho da raiz, `<div className="consent-marca" aria-hidden="true"><Image src="/mascotes/mascote-conexao.webp" alt="" width={1966} height={794} sizes="420px" /></div>`.

  Os estados `carregando` e `invalido` não mudam.

- [ ] **Passo 4:** rodar `npx vitest run "app/(auth)/autorizar-conexao"`. Esperado: PASS.

- [ ] **Passo 5:** commit com a mensagem `feat(conexoes): consentimento lado a lado, ler à esquerda e decidir à direita`.

### Tarefa 2: os estilos

**Arquivos:**
- Modificar: `app/globals.css`, trocando o bloco `.consent*`, hoje por volta das linhas 3946–3964.

**Interfaces:**
- Consome: as classes da Tarefa 1.

- [ ] **Passo 1: escrever o bloco novo, só com tokens**
  - `.consent`: `width: 100%; max-width: 1020px; display: grid; grid-template-columns: 7fr 5fr; gap: clamp(28px, 5vw, 56px); align-items: start; text-align: left`.
  - `.consent h1`: `font-size: clamp(34px, 4.6vw, 54px); text-wrap: balance; margin: 0`. A fonte vem de `.titulo-misto`.
  - `.consent-listas`: grade de 2 colunas com `column-gap: 28px`. O rótulo de cada lista tem `border-bottom: 1px solid var(--color-text)`, e cada item tem `border-bottom: 1px solid var(--color-divider)` e padding de 10px 0.
  - `.consent-num`: `font-family: var(--font-mono); font-size: 12px`, na cor apagada.
  - `.consent-decisao`: `padding: 26px; border: 1px solid var(--color-divider); border-radius: var(--radius-lg)` e a superfície da folha. Use o token que as folhas do banco usam (`.extrato-cartao`/`mes-folha`) e confira o nome no arquivo. Não use cor fixa.
  - `.consent-empresa`: `padding: 9px 12px; border-radius: var(--radius-md)`. Com `[data-marcada]`, recebe a tinta ativa (procure a variável `--tinta-ativa` ou a equivalente, por volta da linha 1304) e `box-shadow: inset 2px 0 0 var(--color-text)`. O `input` passa a usar `accent-color: var(--color-text)`.
  - `.consent-botoes`: `display: flex; flex-direction: column; gap: 8px`.
  - `.consent-marca`: `position: absolute; left: -50px; bottom: -30px; width: clamp(260px, 32vw, 420px); opacity: 0.06; pointer-events: none; z-index: -1`. A `img` leva `width: 100%; height: auto`. A moldura já tem `position: relative; isolation: isolate; overflow: hidden`, então a marca d'água deve ficar posicionada em relação a ela. Para isso, `.consent` não pode ter `position`.
  - `@media (max-width: 900px)`: `.consent` passa a ter uma coluna só.
  - `@media (max-width: 560px)`: `.consent-listas` também passa a uma coluna, com 18px de espaço entre as listas.
  - `@media (prefers-reduced-motion)`: não há animação nova, então nada a fazer.

- [ ] **Passo 2:** rodar `npm run lint && npm run build`. Esperado: sem erro, e a rota `/autorizar-conexao` na tabela.

- [ ] **Passo 3: verificar no navegador**
  - Suba o backend-fake e o `next dev`.
  - Pegue o link em `GET /dev/pedido-mcp` do fake e entre como gestor.
  - Confira a tela em 1280px, em 375px (mobile) e no modo escuro.
  - Confira o loopback (`/dev/pedido-mcp?loopback=1`, se o fake aceitar; senão, apenas no teste).
  - Confira a tela como analista.
  - Tire um screenshot de cada caso.

- [ ] **Passo 4:** commit com a mensagem `style(conexoes): folha de decisão, listas com filete e marca d'água do mascote`.

### Tarefa 3: fechamento

- [ ] Se o `DESIGN.md` listar onde o itálico Cormorant aparece fora da landing, acrescentar `/autorizar-conexao` ao lado de `/plano`.
- [ ] Rodar `npm run test && npm run lint && npm run build`.
- [ ] Rodar os subagentes `verificador` e `revisor`.
- [ ] Gravar de novo a figura da Central que mostra o consentimento, se houver uma: `grep autorizar-conexao scripts/ajuda-videos`.
- [ ] Abrir o PR para `develop`, ou empilhado sobre #364, se ele ainda não tiver entrado. No corpo, colocar os screenshots e o link do artefato.
