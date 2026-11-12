# Conexão com IA na Central e na landing: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** uma página da Central de ajuda, "Conectar o ChatGPT ou o Claude", com vídeo em HTML e passo a passo por IA, e uma seção da landing que mostra a conexão como diferencial.

**Arquitetura:** a página é mais uma entrada de `PAGINAS` (`paginas.ts`), marcada `destaque`, com três campos novos opcionais em `FuncaoDaAjuda` (`abas`, `itens`, `sanfona`) que `central.tsx` desenha e `conteudo.ts` achata em `passos`. Assim o assistente do backend lê o texto novo sem mudar o contrato. O vídeo e a seção da landing são players de cenas em HTML no padrão de `mockup-demo.tsx`: um relógio, uma função pura que diz o que está na tela em cada instante e janelas que esmaecem. As janelas do Claude e do ChatGPT são um componente compartilhado pelos dois.

**Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rota), React, `motion/react` (`useInView`), Vitest + Testing Library, CSS em `app/globals.css`.

**Spec:** o canvas aprovado (https://claude.ai/artifact/X5pqufMs1JWahLkJtv9qes, versão 14), copiado em `docs/superpowers/plans/anexos/2026-11-11-conexao-ia/`:
- `central.dc.html`: a página da Central. Os textos dos passos estão em `PASSOS` e `COPIAR`, por volta da linha 347. Os tempos do vídeo estão em `INI`, `rota` e na cena 1, por volta da linha 308.
- `landing.dc.html`: a seção da landing. A linha do tempo é `linha()`, por volta da linha 157, e o estilo de cada instante está em `renderVals()`.
- `logo-chatgpt.png` e `logo-claude.png`: recortes de `public/mascotes/mascote-conexao.webp`.

O executor lê o anexo para os estilos exatos (cores, tamanhos, posições do cursor). O plano fixa as decisões, os nomes e os testes.

## Restrições globais

- Textos em pt-BR, sem travessão entre orações (a landing tem teste para isso, em `page.test.tsx`: "writes its copy without dashes between clauses").
- Guia V5:
  - Papel `#f3f2f2`, texto `#201f1d`, um dourado `#b68235`. Texto dourado usa `#7d5411`.
  - Filetes a 16% no lugar de caixas preenchidas.
  - Seleção neutra (tinta a 9% + filete de 2px), nunca dourada.
  - Verde `#336c3e` só para status.
  - Ícones Lucide com traço 1.75.
  - Uma curva só: `--ease-out` = `cubic-bezier(0.22,1,0.36,1)`. Exceção: o cursor dos vídeos usa `cubic-bezier(0.65,0,0.35,1)` 1.4s, como no canvas.
- Faixa escura igual ao resto da landing:
  - `className="onda onda-escura grao"` e fundo `var(--faixa-escura)`.
  - Título `var(--color-neutral-100)`.
  - Texto secundário `var(--color-neutral-300)`.
  - Filetes `color-mix(in srgb, var(--color-neutral-100) 22%, transparent)`.
- O palco do vídeo da Central usa o mesmo fundo escuro com grão.
- Movimento reduzido (`useMovimentoReduzido()` de `app/reveal.tsx`): tudo chega parado e completo, sem relógio rodando.
- Os players só rodam o relógio com o quadro na tela (`useInView(quadro, { amount: 0.4 })`, como `mockup-demo.tsx:52`).
- Ritmo da digitação e da resposta, fixado no canvas:
  - `TECLA = 85` ms por letra. Cada letra é um `<span class="letra">` com a animação `letra` de 0,5s, que parte de `opacity:0; translateY(3px); blur(2px)`.
  - `PALAVRA = 160` ms por palavra. Cada palavra entra com opacidade e `blur(4px→0)` em 1,2s.
  - Um cursor de texto piscando acompanha a digitação.
- Os números de exemplo são os do agosto da demonstração: 96,3% conciliado, 157 de 4.218 lançamentos a revisar.
- As frases fixas são do canvas:
  - Claude, pergunta: "Como está a conciliação de agosto?"
  - Claude, resposta: "Agosto está 96,3% conciliado. Dos 4.218 lançamentos do extrato do banco, 157 ainda pedem revisão no Ledgr."
  - ChatGPT, pergunta: "Agosto já foi fechado?"
  - ChatGPT, resposta: "Sim. Agosto está fechado, com 96,3% conciliado. O relatório do fechamento fica em Fechamentos, no Ledgr."
- Abaixo de toda simulação de chat vai a nota "Simulação no Claude e no ChatGPT com os números do agosto da demonstração.". Nunca imitamos a tela de um terceiro sem essa nota.
- O endereço do conector nunca é escrito à mão no texto. Ele vem de `LEDGR_API_URL` + `/mcp` (Tarefa 1).
- Arquivos de uma pessoa por vez: `app/globals.css`, `app/(ajuda)/ajuda/paginas.ts` e `CLAUDE.md`. Na execução em sequência deste plano, cada tarefa mexe neles na sua vez. Se dividir em worktrees, esses três ficam com a sessão que orquestra, no fim.
- Antes de cada commit, rode `npm run test && npm run lint && npm run build`. No build, confira na tabela de rotas que `/ajuda/[pagina]` continua lá.

## Foco da revisão

1. **A IA trocada no meio do vídeo.** Trocar a aba ChatGPT → Claude com o vídeo na cena 3 refaz a cena com a IA nova, sem misturar as duas janelas. Teste na Tarefa 5: `troca de aba refaz a conversa na IA nova`.
2. **Claude Code no vídeo.** A aba Claude Code não tem conector na interface. O vídeo mostra a do Claude e a legenda diz isso. Teste na Tarefa 5: `a aba Claude Code toca o vídeo do Claude`.
3. **Sem `LEDGR_API_URL`** (preview, teste local): a Central mostra o bloco do Claude Code com `<endereço do conector>`, nunca `undefined/mcp`. Teste na Tarefa 1 (`enderecoDoConector`) e na Tarefa 4.
4. **Leitor de tela e teclado nas abas.** As abas seguem `role="tablist"`: setas movem, `aria-selected` acompanha e o painel tem `role="tabpanel"` com `aria-labelledby`. O vídeo é `aria-hidden` com uma descrição em texto, e o botão pausar/tocar tem nome. Teste na Tarefa 4: `as abas trocam com as setas`.
5. **Celular em 375px.** A janela dividida da landing vira uma IA por vez, primeiro o Claude e depois o ChatGPT, na mesma linha do tempo, porque 50/50 em 343px não lê. A página da Central não rola na horizontal. Verificação visual na Tarefa 8. A regra do CSS (`@media (max-width: 760px)`) está na Tarefa 7.

---

### Tarefa 1: endereço do conector, documentação e logos num lugar só

**Arquivos:**
- Criar: `lib/conexao-ia.ts`, `lib/conexao-ia.test.ts`.
- Criar: `public/mascotes/logo-chatgpt.png` e `public/mascotes/logo-claude.png`, copiados do anexo.
- Modificar: `app/(app)/e/[empresa]/conexoes-mcp/acoes.ts:164-166`, que passa a usar `enderecoDoConector()`.
- Modificar: `app/(app)/e/[empresa]/conexoes-mcp/painel.tsx`. Hoje ele declara `DOCUMENTACAO` e `NOME`; passa a importá-los.

**Interfaces:**
- Produz:
  - `type IaDaConexao = "chatgpt" | "claude"`
  - `NOME_DA_IA: Record<IaDaConexao, string>`, com os valores "ChatGPT" e "Claude".
  - `DOCUMENTACAO_DA_IA: Record<IaDaConexao, string>`, com as mesmas URLs de hoje em `painel.tsx`.
  - `enderecoDoConector(base = process.env.LEDGR_API_URL): string | null`, que tira as barras do fim e põe `/mcp`. Sem base, devolve `null`.
  - `ENDERECO_SEM_BASE = "<endereço do conector>"`

- [ ] **Passo 1: teste que falha**

```ts
it("monta o endereço do conector a partir da API, sem barra dobrada", () => {
  expect(enderecoDoConector("https://api.x.com.br/")).toBe("https://api.x.com.br/mcp");
  expect(enderecoDoConector("https://api.x.com.br")).toBe("https://api.x.com.br/mcp");
  expect(enderecoDoConector(undefined)).toBeNull();
  expect(enderecoDoConector("")).toBeNull();
});
```

- [ ] **Passo 2:** `npx vitest run lib/conexao-ia.test.ts` deve falhar (módulo inexistente).
- [ ] **Passo 3:** implementar `lib/conexao-ia.ts` e trocar os dois usos em `acoes.ts` e `painel.tsx`. Copiar os logos do anexo para `public/mascotes/`.
- [ ] **Passo 4:** `npx vitest run lib/conexao-ia.test.ts "app/(app)/e/[empresa]/conexoes-mcp"` deve passar.
- [ ] **Passo 5:** commit `refactor(conexoes): endereço do conector e documentação das IAs em lib/conexao-ia`.

---

### Tarefa 2: as janelas do Claude e do ChatGPT

São componentes de apresentação, sem relógio. Quem anima (Tarefas 5 e 7) passa o estado de cada instante.

**Arquivos:**
- Criar: `app/chat-de-ia.tsx` e `app/chat-de-ia.test.tsx`. Ficam na raiz de `app/`, como `reveal.tsx`, porque `(ajuda)` e `(marketing)` usam os dois.
- Modificar: `app/globals.css`, com um bloco novo `/* chat de IA simulado */` e classes com prefixo `chat-ia-`.

**Interfaces:**
- Consome: `IaDaConexao` e `NOME_DA_IA` (Tarefa 1).
- Produz:

```ts
export type EstadoDoChat = {
  /** O que está digitado no campo, letra por letra; vazio mostra o placeholder. */
  digitado: string;
  /** A pergunta já enviada, como bolha; null antes do envio. */
  enviada: string | null;
  /** "nada" | "consultando" ("Consultando o Ledgr" / "Chamando o Ledgr…") | "feito" ("Ledgr · Resumo do mês ›" / "Usou o Ledgr ›") */
  ferramenta: "nada" | "consultando" | "feito";
  /** Palavras da resposta; `visivel` liga a entrada de cada uma. */
  resposta: { texto: string; visivel: boolean }[];
  /** Claude: menu de ferramentas aberto, Ledgr ligado. ChatGPT: menu "Apps" do @ aberto, chip do Ledgr no campo. */
  menuAberto: boolean;
  ledgrLigado: boolean;
};
export function JanelaDoClaude(props: { estado: EstadoDoChat; titulo?: string }): JSX.Element;
export function JanelaDoChatGpt(props: { estado: EstadoDoChat }): JSX.Element;
export function JanelaDaIa(props: { ia: IaDaConexao; estado: EstadoDoChat }): JSX.Element; // escolhe uma das duas
```

O visual sai do anexo `landing.dc.html`:
- **Claude:** barra lateral de 48px. A saudação com o logo, "Boa tarde, Ana", some depois do envio, e no topo aparece o título "Conciliação de agosto ⌄". O campo tem placeholder "Como posso ajudar você hoje?" antes da conversa e "Responder ao Claude…" depois. O botão de enviar é `#c6613f`, ou `#e6c3b4` quando está desligado, e o seletor mostra "Sonnet 4.5 ⌄". O menu de ferramentas tem "Pesquisa na web" e o Ledgr com uma chave que fica `#2c84db` quando ligada, e mais "Gerenciar conectores". A resposta é em serifa.
- **ChatGPT:** fundo branco e cabeçalho "ChatGPT ⌄". A saudação "Em que você está pensando hoje?" tem 22px, quebra linha e fica centralizada. O campo é uma pílula centralizada que desce para o rodapé depois do envio, com placeholder "Pergunte alguma coisa". O botão de enviar é um círculo preto. Depois da resposta aparecem os ícones de copiar e curtir.

- [ ] **Passo 1: testes que falham**

```tsx
it("mostra o placeholder com o campo vazio e as letras quando há texto", () => {
  const { container, rerender } = render(<JanelaDoClaude estado={{ ...VAZIO }} />);
  expect(screen.getByText("Como posso ajudar você hoje?")).toBeInTheDocument();
  rerender(<JanelaDoClaude estado={{ ...VAZIO, digitado: "Como" }} />);
  expect(container.querySelectorAll(".letra")).toHaveLength(4);
});
it("depois do envio o Claude mostra a pergunta e troca o placeholder", () => {
  render(<JanelaDoClaude estado={{ ...VAZIO, enviada: "Como está a conciliação de agosto?" }} />);
  expect(screen.getByText("Como está a conciliação de agosto?")).toBeInTheDocument();
  expect(screen.getByText("Responder ao Claude…")).toBeInTheDocument();
  expect(screen.queryByText("Boa tarde, Ana")).not.toBeInTheDocument();
});
it("o ChatGPT diz que usou o Ledgr quando a ferramenta termina", () => {
  render(<JanelaDoChatGpt estado={{ ...VAZIO, enviada: "Agosto já foi fechado?", ferramenta: "feito" }} />);
  expect(screen.getByText(/Usou o Ledgr/)).toBeInTheDocument();
});
it("só a palavra visível da resposta ganha a classe de entrada", () => {
  const { container } = render(<JanelaDoClaude estado={{ ...VAZIO, enviada: "x", resposta: [{ texto: "Agosto", visivel: true }, { texto: "está", visivel: false }] }} />);
  expect(container.querySelectorAll(".chat-ia-palavra.visivel")).toHaveLength(1);
});
```

`VAZIO` é um `EstadoDoChat` com tudo vazio, declarado no próprio teste.

- [ ] **Passo 2:** `npx vitest run app/chat-de-ia.test.tsx` deve falhar.
- [ ] **Passo 3:** implementar os componentes e o CSS. As janelas têm `aria-hidden="true"`, porque quem as usa dá a descrição em texto. As imagens são `/mascotes/logo-claude.png` e `/mascotes/logo-chatgpt.png` via `next/image`.
- [ ] **Passo 4:** os testes devem passar.
- [ ] **Passo 5:** commit `feat(conexao-ia): janelas simuladas do Claude e do ChatGPT`.

---

### Tarefa 3: a página "Conectar o ChatGPT ou o Claude" nos dados da Central

**Arquivos:**
- Modificar: `app/(ajuda)/ajuda/paginas.ts`:
  - Nos tipos (linhas 13-37), adicionar os campos novos.
  - No fim de `PAGINAS`, depois de Assinatura, adicionar a página nova.
  - Em Configurações (linhas 736-773), trocar `conexoes`, `conexoes-perguntas` e `conexoes-problemas` por uma função só.
- Modificar: `app/(ajuda)/ajuda/conteudo.ts`, que passa a achatar os campos novos.
- Testes: `app/(ajuda)/ajuda/central.test.tsx` (bloco "o conteúdo da ajuda") e `app/(ajuda)/ajuda/conteudo.test.ts`.

**Interfaces:**
- Produz (em `paginas.ts`):

```ts
export type AbaDoPasso = {
  id: "chatgpt" | "claude" | "claude-code";
  rotulo: string;                                   // "ChatGPT" | "Claude" | "Claude Code"
  passos: { titulo: string; texto: string; certo: string; comando?: true }[];
};
// em FuncaoDaAjuda, todos opcionais:
abas?: AbaDoPasso[];                    // o passo a passo com uma aba por IA
itens?: { titulo: string; texto: string }[]; // colunas lado a lado ("Antes de começar", "A IA lê / nunca vê")
sanfona?: true;                         // cada passo "Pergunta: resposta" vira um <details>, dividido no primeiro ": "
// em PaginaDeAjuda:
destaque?: true;                        // vai no grupo "Destaque" do menu, fora de anterior/próxima
video?: "conexao-ia";                   // um player próprio no lugar de `demonstracao`/capa
```

`comando: true` mostra o bloco `claude mcp add --transport http ledgr <endereço>`, com o endereço vindo da Tarefa 4.

- Produz (em `conteudo.ts`): `conteudoDaAjuda` continua com o mesmo formato de saída. Cada campo novo vira `passos`:
  - `abas`: um passo por item, no formato `"<rotulo>, <titulo>: <texto> Deu certo quando <certo>"`.
  - `itens`: `"<titulo>: <texto>"`.

**A página** (`id: "conectar-ia"`), com o texto do anexo `central.dc.html`:
- `titulo: "Conectar o ChatGPT ou o Claude"`
- `onde: "Configurações › Conexões · admin e gestor"`
- `serve`: a frase de abertura do canvas ("Ligue o Ledgr na sua IA uma vez…").
- `capa`: `/mascotes/mascote-conexao.webp` (1966×794). Só é usada como reserva.
- `destaque: true`, `video: "conexao-ia"`.
- `funcoes`, nesta ordem e com estes ids (os ids são âncoras públicas):
  1. `antes`, "Antes de começar": `itens` com as 3 colunas do canvas.
  2. `passo-a-passo`, "Passo a passo": `abas` com ChatGPT (5 passos), Claude (5) e Claude Code (4), com os textos e o "Deu certo quando" de `PASSOS` no anexo. O primeiro passo de Claude Code tem `comando: true`. A `nota` diz que os menus são do ChatGPT e do Claude e mudam com o plano e com o tempo.
  3. `perguntar`, "O que perguntar": `faz` com os 4 exemplos, `itens` com "A IA lê" e "A IA nunca vê", e `nota` "As respostas são da IA e podem errar: confira os números no Ledgr antes de decidir."
  4. `problemas`, "Quando não funciona": `sanfona: true`. Os `passos` são os 6 de hoje em `conexoes-problemas` (mais completos que os 5 do canvas), mais "Para desligar: …" vindo da `nota` de hoje.

**Em Configurações** fica só `conexoes`, "Conectar o ChatGPT ou o Claude":
- O `faz` de hoje.
- Os passos se reduzem a três:
  - Abrir **Conexões** e copiar o endereço.
  - Seguir o passo a passo da página **Conectar o ChatGPT ou o Claude** da Central.
  - **Revogar** para cortar o acesso.
- Um campo `link: { href: "/ajuda/conectar-ia", rotulo: "Ver o passo a passo completo" }`, que também entra em `FuncaoDaAjuda`.
- `conteudo.ts` ignora `link`.

- [ ] **Passo 1: testes que falham** (em `central.test.tsx` › "o conteúdo da ajuda")

```ts
it("a conexão com IA tem a sua página em destaque, com uma aba por IA", () => {
  const pagina = paginaDeAjuda("conectar-ia")!;
  expect(pagina.destaque).toBe(true);
  expect(pagina.funcoes.map((f) => f.id)).toEqual(["antes", "passo-a-passo", "perguntar", "problemas"]);
  const abas = pagina.funcoes[1].abas!;
  expect(abas.map((a) => [a.id, a.passos.length])).toEqual([["chatgpt", 5], ["claude", 5], ["claude-code", 4]]);
  expect(abas.flatMap((a) => a.passos).every((p) => p.certo.length > 0)).toBe(true);
});
it("Configurações resume a conexão e aponta para a página nova", () => {
  const config = paginaDeAjuda("configuracoes")!;
  expect(config.funcoes.map((f) => f.id)).not.toContain("conexoes-problemas");
  expect(config.funcoes.find((f) => f.id === "conexoes")!.link!.href).toBe("/ajuda/conectar-ia");
});
```

Em `conteudo.test.ts`:

```ts
it("as abas e as colunas entram no texto do assistente como passos", () => {
  const pagina = conteudoDaAjuda(PAGINAS).paginas.find((p) => p.id === "conectar-ia")!;
  const passos = pagina.funcoes.find((f) => f.id === "passo-a-passo")!.passos!;
  expect(passos).toHaveLength(14);
  expect(passos[0]).toMatch(/^ChatGPT, Copie o endereço no Ledgr: .+ Deu certo quando /);
});
```

O teste de 60.000 caracteres que já existe precisa continuar passando.

- [ ] **Passo 2:** `npx vitest run "app/(ajuda)/ajuda"` deve falhar nos testes novos.
- [ ] **Passo 3:** implementar os tipos, a página, o resumo em Configurações e o achatamento.
- [ ] **Passo 4:** `npx vitest run "app/(ajuda)/ajuda"` deve passar, incluindo o limite de 60.000 caracteres.
- [ ] **Passo 5:** commit `docs(ajuda): página Conectar o ChatGPT ou o Claude, com uma aba por IA`.

---

### Tarefa 4: a Central desenha a página em destaque

**Arquivos:**
- Modificar: `app/(ajuda)/ajuda/central.tsx`.
- Criar: `app/(ajuda)/ajuda/abas-do-passo.tsx`, com as abas e os passos numerados.
- Modificar: `app/(ajuda)/ajuda/[pagina]/page.tsx`, que passa `endereco={enderecoDoConector()}`.
- Modificar: `app/globals.css`, com classes `ajd-` novas (`ajd-grupo`, `ajd-colunas`, `ajd-abas`, `ajd-passo-num`, `ajd-certo`, `ajd-codigo`, `ajd-sanfona`).
- Teste: `app/(ajuda)/ajuda/central.test.tsx`.

**Interfaces:**
- Consome: os tipos da Tarefa 3 e `enderecoDoConector` e `ENDERECO_SEM_BASE` (Tarefa 1).
- Produz:
  - `CentralDeAjuda({ id, endereco }: { id: string; endereco?: string | null })`
  - `AbasDoPasso({ abas, endereco, aba, onAba }: { abas: AbaDoPasso[]; endereco: string | null; aba: AbaDoPasso["id"]; onAba: (id: AbaDoPasso["id"]) => void })`.
  - O estado da aba fica em `CentralDeAjuda`, porque o vídeo da Tarefa 5 também o lê.

**Como a Central passa a se comportar:**
- **Menu à esquerda:**
  - Um grupo "Destaque" com as páginas `destaque`, acima.
  - O rótulo "Telas" acima das demais.
  - As duas listas saem de `PAGINAS.filter`.
- **Anterior e próxima:** contam só as páginas sem `destaque`. Uma página em destaque não mostra nenhuma das duas.
- **Colunas:** `itens` vira colunas separadas por filete.
- **Sanfona:** `sanfona` vira `<details><summary>`.
- **Link:** `link` vira um `Link` com a classe `link-animado` e uma seta.
- **Abas:**
  - `abas` vira `role="tablist"`, com setas esquerda e direita e Home/End.
  - Os passos são numerados em Newsreader, os **negritos** passam por `Texto` e cada passo tem a linha "Deu certo quando …" com o check verde.
  - Embaixo vêm os links "ajuda do ChatGPT" e "ajuda do Claude", de `DOCUMENTACAO_DA_IA`, que abrem em nova aba.
- **Vídeo:**
  - Com `video === "conexao-ia"`, no lugar de `.ajd-video` entra `<VideoDaConexao ia={aba} />` (Tarefa 5).
  - Até a Tarefa 5 existir, entra um marcador vazio com a mesma altura, 520px.
  - Os capítulos de baixo do vídeo não aparecem nessa página, porque os botões de cena do vídeo já fazem esse papel.

- [ ] **Passo 1: testes que falham**

```tsx
it("a página em destaque fica num grupo próprio e sem anterior e próxima", () => {
  render(<CentralDeAjuda id="conectar-ia" endereco="https://api.x/mcp" />);
  expect(screen.getByText("Destaque")).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Outras telas" })?.querySelectorAll("a")).toHaveLength(0);
});
it("as abas trocam com as setas e mostram o comando com o endereço no Claude Code", async () => {
  render(<CentralDeAjuda id="conectar-ia" endereco="https://api.x/mcp" />);
  const chatgpt = screen.getByRole("tab", { name: "ChatGPT" });
  expect(chatgpt).toHaveAttribute("aria-selected", "true");
  chatgpt.focus();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Claude Code" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("claude mcp add --transport http ledgr https://api.x/mcp")).toBeInTheDocument();
});
it("sem endereço, o comando mostra onde achar o endereço", async () => {
  render(<CentralDeAjuda id="conectar-ia" endereco={null} />);
  await userEvent.click(screen.getByRole("tab", { name: "Claude Code" }));
  expect(screen.getByText(/ledgr <endereço do conector>$/)).toBeInTheDocument();
});
it("Quando não funciona abre cada problema numa sanfona", () => {
  render(<CentralDeAjuda id="conectar-ia" endereco={null} />);
  const secao = document.getElementById("problemas")!;
  expect(secao.querySelectorAll("details").length).toBeGreaterThanOrEqual(6);
});
it("Configurações leva ao passo a passo completo", () => {
  render(<CentralDeAjuda id="configuracoes" />);
  expect(screen.getByRole("link", { name: /Ver o passo a passo completo/ })).toHaveAttribute("href", "/ajuda/conectar-ia");
});
```

O teste que já existe, "anterior e próxima seguem a ordem das telas", tem de continuar passando sem mudanças.

- [ ] **Passo 2:** `npx vitest run "app/(ajuda)/ajuda/central.test.tsx"` deve falhar.
- [ ] **Passo 3:** implementar `abas-do-passo.tsx`, as mudanças de `central.tsx` e `[pagina]/page.tsx`, e o CSS.
- [ ] **Passo 4:** os testes devem passar.
- [ ] **Passo 5:** commit `feat(ajuda): grupo Destaque, abas por IA e sanfona na Central`.

---

### Tarefa 5: o vídeo da conexão, em HTML

**Arquivos:**
- Criar: `app/(ajuda)/ajuda/video-da-conexao.tsx` e `app/(ajuda)/ajuda/video-da-conexao.test.tsx`.
- Modificar: `app/(ajuda)/ajuda/central.tsx`, trocando o marcador da Tarefa 4 pelo player.
- Modificar: `app/globals.css`, com o bloco `/* vídeo da conexão */` e as classes `vdc-`.

**Interfaces:**
- Consome:
  - `JanelaDaIa`, `EstadoDoChat` (Tarefa 2).
  - `AbaDoPasso["id"]` (Tarefa 3).
  - `useMovimentoReduzido` de `app/reveal.tsx`.
  - `useInView` de `motion/react`.
- Produz:

```ts
export const INICIO_DAS_CENAS = [0, 5000, 13500, 18500] as const;
export const VOLTA = 36000;
export const NOMES_DAS_CENAS = ["1 · Copiar no Ledgr", "2 · Adicionar na IA", "3 · Autorizar no Ledgr", "4 · Perguntar"] as const;
/** O que está na tela no instante t (ms, 0..VOLTA) para a IA da aba; pura, sem relógio. */
export function quadroDoVideo(t: number, ia: "chatgpt" | "claude", endereco: string): QuadroDoVideo;
export type QuadroDoVideo = {
  cena: 0 | 1 | 2 | 3;
  copiado: boolean;                 // cena 0: "Copiar" → "Copiado" a partir de 2400
  modal: { aberto: boolean; nome: string; url: string; confirmou: boolean; conectou: boolean }; // cena 1
  autorizado: boolean;              // cena 2
  chat: EstadoDoChat;               // cena 3
  cursor: { x: number; y: number }; // px do palco, rota do anexo
};
export function VideoDaConexao(props: { ia: "chatgpt" | "claude" | "claude-code"; endereco: string | null }): JSX.Element;
```

**Os tempos da cena 1** (ms a partir de `INICIO_DAS_CENAS[1]`), copiados do anexo:
- O modal fica aberto de 1500 a 6000.
- O nome é digitado a partir de 2100, a 90 ms por letra.
- A URL é digitada a partir de 2900, a 45 ms por letra.
- Confirma em 5300 e conecta em 7200.

**A cena 3**, a partir de `INICIO_DAS_CENAS[3]`:
- A digitação começa em 2500 no ChatGPT e em 3300 no Claude, a 85 ms por letra.
- Envia 900 ms depois do fim da digitação.
- A ferramenta começa 900 ms depois do envio.
- A resposta começa 2200 ms depois da ferramenta, a 160 ms por palavra.

**A rota do cursor** está em `rota` no anexo.

**A cena 1 por IA:**
- **Claude:** "Conectores › Adicionar conector personalizado".
- **ChatGPT:** "Apps e conectores › Novo app", com OAuth e a caixa do aviso de risco.

**Comportamento:**
- **Palco:** fundo escuro com grão, 520px de altura e raio 16. O mascote `mascote-tomadas.webp` fica a 0.1 de opacidade, flutuando.
- **Janelas das cenas:** 4 janelas em `inset: 28px`, que trocam por esmaecimento de 1,1s, nunca por corte.
- **Controles:**
  - Tocar/pausar, com o nome "Pausar o vídeo" ou "Tocar o vídeo".
  - 4 botões de cena, com `NOMES_DAS_CENAS` e `aria-pressed`. Clicar leva `t` ao início da cena.
  - A linha "O vídeo segue a IA escolhida no passo a passo."
- **A aba Claude Code** toca o vídeo do Claude, com a legenda "No Claude Code, o passo 2 é o comando do terminal; o resto é igual."
- **Trocar de aba** com o vídeo na cena 3 volta `t` para `INICIO_DAS_CENAS[3]`.
- **Movimento reduzido:** sem relógio. Mostra a cena 3 completa e parada, e os botões de cena trocam o quadro estático.
- **Fora da tela:** pausa.
- **Acessibilidade:** o palco tem `aria-hidden`, e uma descrição `sr-only` resume os 4 passos.

- [ ] **Passo 1: testes que falham** (as funções puras primeiro)

```ts
it("cada cena começa no seu instante", () => {
  expect([0, 4999, 5000, 13500, 18500].map((t) => quadroDoVideo(t, "claude", "u").cena)).toEqual([0, 0, 1, 2, 3]);
});
it("na cena 1 a URL do conector é digitada inteira antes de confirmar", () => {
  const q = quadroDoVideo(5000 + 5300, "claude", "https://api.x/mcp");
  expect(q.modal.url).toBe("https://api.x/mcp");
  expect(q.modal.confirmou).toBe(true);
});
it("a resposta do Claude termina inteira antes da volta recomeçar", () => {
  const q = quadroDoVideo(VOLTA - 1, "claude", "u");
  expect(q.chat.resposta.every((p) => p.visivel)).toBe(true);
  expect(q.chat.resposta.map((p) => p.texto).join(" ")).toContain("157 ainda pedem revisão");
});
it("troca de aba refaz a conversa na IA nova", async () => { /* render com ia="chatgpt", clicar "4 · Perguntar", rerender com ia="claude": "Responder ao Claude…" ou "Como posso ajudar você hoje?" na tela e nenhum "Pergunte alguma coisa" */ });
it("a aba Claude Code toca o vídeo do Claude", () => { /* render ia="claude-code": a legenda do Claude Code aparece e o botão 2 · Adicionar na IA mostra "Adicionar conector personalizado" */ });
it("com movimento reduzido mostra a conversa inteira, parada", () => { /* mock de matchMedia reduzido, como app/reveal.test.tsx: a resposta inteira na tela e nenhum setInterval agendado (vi.useFakeTimers + vi.getTimerCount() === 0) */ });
```

- [ ] **Passo 2:** `npx vitest run "app/(ajuda)/ajuda/video-da-conexao.test.tsx"` deve falhar.
- [ ] **Passo 3:** implementar `quadroDoVideo`, que é a parte com algoritmo, depois o player e o CSS. O relógio é um `setInterval` de 40 ms, como no canvas, só com o quadro na tela e sem movimento reduzido.
- [ ] **Passo 4:** os testes devem passar, e também `npx vitest run "app/(ajuda)/ajuda"`.
- [ ] **Passo 5:** commit `feat(ajuda): vídeo em HTML da conexão com o ChatGPT e o Claude`.

---

### Tarefa 6: os links do app apontam para a página nova

**Arquivos:**
- Modificar: `app/(app)/e/[empresa]/conexoes-mcp/painel.tsx:167`.
- Modificar: `app/(auth)/autorizar-conexao/consentimento.tsx:230`.
- Testes: `painel.test.tsx:88` e `consentimento.test.tsx:79`.

- [ ] **Passo 1:** nos dois testes, trocar o esperado `"/ajuda/configuracoes#conexoes"` por `"/ajuda/conectar-ia#passo-a-passo"`.
- [ ] **Passo 2:** `npx vitest run "app/(app)/e/[empresa]/conexoes-mcp" "app/(auth)/autorizar-conexao"` deve falhar.
- [ ] **Passo 3:** trocar os dois `href`. O `target="_blank"` e o `rel` continuam.
- [ ] **Passo 4:** os mesmos testes devem passar.
- [ ] **Passo 5:** commit `fix(conexoes): o painel e o consentimento levam ao passo a passo da Central`.

---

### Tarefa 7: a seção da landing

**Arquivos:**
- Criar: `app/(marketing)/conexao-ia.tsx` e `app/(marketing)/conexao-ia.test.tsx`.
- Modificar: `app/(marketing)/page.tsx:477-480`. A seção entra entre `<PorQueOLedgr />` e `<section id="regra">`.
- Modificar: o rótulo de Preços, de "Cap. IV · Começar" para "Cap. V · Começar".
- Modificar: `app/(marketing)/cabecalho-site.tsx:8-10`, com o link novo `{ rotulo: "Com a sua IA", href: "#conexao-ia", capitulo: "Cap. IV" }` antes de Assinatura, que passa a "Cap. V".
- Testes: `app/(marketing)/page.test.tsx:60-67` passa a ter cinco capítulos, e `cabecalho-site.test.tsx`.
- Modificar: `app/globals.css`, com o bloco `/* conexão com IA */` e as classes `cia-`.

**Por que Cap. IV e não V como no canvas:** a seção vem antes de Preços, e os capítulos seguem a ordem da página. Preços passa a Cap. V.

**Interfaces:**
- Consome: `JanelaDoClaude`, `JanelaDoChatGpt`, `EstadoDoChat` (Tarefa 2), `useMovimentoReduzido`, `useInView`, `Reveal`, `fonteDestaque`.
- Produz:

```ts
export const TECLA = 85, PALAVRA = 160;
/** Os instantes de uma volta, em ms. Os valores do anexo, calculados: */
export function linhaDaConversa(): {
  menuIn: 2400; toggle: 3900; menuOut: 5100; dig1: 6000; dig1Fim: 8890; env1: 9790; cons1: 10690;
  resp1: 12990; resp1Fim: 15710; num1: 16210; divide: 18810; arroba: 21410; mencaoOk: 23210;
  dig2: 23810; dig2Fim: 25680; env2: 26580; cons2: 27480; resp2: 29780; resp2Fim: 32340; some: 37140; fim: 39140;
};
export function quadroDaLanding(t: number): { claude: EstadoDoChat; gpt: EstadoDoChat; dividida: boolean; numeros: boolean; some: boolean; cursor: { x: number; y: number } };
export function ConexaoIa(): JSX.Element; // <section id="conexao-ia" className="onda onda-escura grao">
```

**A seção** (textos e medidas do anexo `landing.dc.html`):
- **Coluna esquerda:**
  - Rótulo "Cap. IV · Conexão com IA".
  - `h2` com `className="titulo-misto"`: "Pergunte à sua IA como está <em>o seu mês.</em>"
  - O parágrafo de abertura do canvas.
  - A lista com os numerais I a III em Cormorant itálico dourado: "Só leitura", "A descrição dos lançamentos nunca sai" e "Você autoriza e você revoga", cada um com a frase do canvas.
- **Botão em destaque** "Ver como conectar →":
  - `Link` para `/ajuda/conectar-ia`, padding 18px 30px, borda de 1,5px dourada, fundo dourado a 16% e texto `var(--color-accent-300)` (`#facb8d`).
  - Ao passar o mouse, o fundo vai a 30% e a seta anda 4px. Ao apertar, `scale(.97)`.
  - Embaixo, a linha que diz que o passo a passo está na Central.
- **Coluna direita:**
  - O mascote `mascote-tomadas.webp` flutuando, com o logo do ChatGPT e o rótulo claro à esquerda e o do Claude à direita (76px).
  - A janela com 640px de altura, que se divide 50/50 em `divide` (largura com transição de 1,8s).
  - A nota da simulação.
- **Celular** (`@media (max-width: 760px)`): sem divisão. Até `divide` mostra o Claude e depois só o ChatGPT, com a mesma linha do tempo.

- [ ] **Passo 1: testes que falham**

```ts
it("a janela só se divide depois que o Claude termina de responder e mostra os números", () => {
  const L = linhaDaConversa();
  expect(L.divide).toBe(18810);
  expect(quadroDaLanding(L.divide - 1).dividida).toBe(false);
  expect(quadroDaLanding(L.divide).dividida).toBe(true);
  expect(quadroDaLanding(L.num1).numeros).toBe(true);
});
it("o ChatGPT só recebe a pergunta depois de mencionar o Ledgr com @", () => {
  const L = linhaDaConversa();
  expect(quadroDaLanding(L.dig2 - 1).gpt.ledgrLigado).toBe(true);
  expect(quadroDaLanding(L.dig2 - 1).gpt.digitado).toBe("");
});
it("o botão em destaque leva ao passo a passo da Central", () => {
  render(<ConexaoIa />);
  expect(screen.getByRole("link", { name: /Ver como conectar/ })).toHaveAttribute("href", "/ajuda/conectar-ia");
});
it("com movimento reduzido mostra as duas conversas inteiras, paradas", () => { /* mock de matchMedia: as duas respostas na tela, a janela dividida e nenhum timer */ });
```

Em `page.test.tsx`, o teste "labels only the four chapters" passa a esperar os cinco rótulos, com "Cap. IV · Conexão com IA" e "Cap. V · Começar". O de travessões e o "downloads each mascot once" continuam passando.

- [ ] **Passo 2:** `npx vitest run "app/(marketing)"` deve falhar.
- [ ] **Passo 3:** implementar `linhaDaConversa`, `quadroDaLanding` e o componente. Depois inserir no `page.tsx`, renumerar e escrever o CSS. O título da seção fica fora do player e é renderizado no servidor.
- [ ] **Passo 4:** `npx vitest run "app/(marketing)"` deve passar.
- [ ] **Passo 5:** commit `feat(landing): seção Conexão com IA com o Claude e o ChatGPT consultando o Ledgr`.

---

### Tarefa 8: conferir, revisar e abrir o PR

- [ ] **Passo 1:** `npm run test && npm run lint && npm run build` deve terminar sem falha. Na tabela de rotas, `/ajuda/[pagina]` aparece e `/` continua estática.
- [ ] **Passo 2: conferir na tela** com `preview_start` e o `backend-fake`:
  - **Landing:**
    - A volta inteira em 1440px.
    - Em 375px, uma IA por vez e sem rolagem horizontal.
    - Com movimento reduzido (`resize_window` + emulação), tudo parado e completo.
  - **`/ajuda/conectar-ia`:**
    - As 3 abas, com o vídeo seguindo a aba.
    - Os botões de cena.
    - "Nesta página" acompanhando a rolagem.
    - Uma captura de cada uma para o PR.
  - Ajustar as posições do cursor que não caírem nos botões. As do canvas foram calculadas, nunca vistas.
- [ ] **Passo 3: trava da landing** (guia V5, p. 41: "Não prometa").
  - Com o `LEDGR_API_URL` de produção, `curl -s -o /dev/null -w "%{http_code}" -X POST "$LEDGR_API_URL/mcp"` precisa dar `401`. Se der `404`, o `MCP_HABILITADO` está desligado.
  - Desligado: a página da Central entra no PR, mas a seção da landing espera.
    - Em `page.tsx`, ela fica comentada com `// ponytail: volta quando /mcp responder 401 em produção`.
    - O link do cabeçalho e a renumeração voltam ao que eram.
- [ ] **Passo 4:** rodar os subagentes `verificador` e `revisor` e corrigir o que o revisor apontar.
- [ ] **Passo 5:** atualizar `CLAUDE.md`:
  - No item "Connections with ChatGPT and Claude", dizer que a Central tem a página `/ajuda/conectar-ia` (destaque, vídeo em HTML) e que o painel e o consentimento levam até ela.
  - Dizer que a landing tem a seção `#conexao-ia`.
  - Tirar "and a mascot tutorial" apenas se ele tiver sido feito (não está neste plano).
- [ ] **Passo 6:** abrir o PR para `develop`, com as capturas e o resultado da trava do Passo 3. Não faz merge.

---

## Fora deste plano

- **Gravar `public/ajuda/conectar-ia.json` com `gravar.mjs`:** o vídeo é um componente, não uma réplica gravada. `demonstracao.test.ts` não se aplica a esta página.
- **Mudar o cartão `vg-conexao` da Visão geral:** ele continua abrindo Configurações › Conexões, que é o lugar de agir.
- **Um item "Funciona com o ChatGPT e o Claude?" nas Perguntas da landing:** só se a seção não bastar.
