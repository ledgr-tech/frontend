# Ledgr — o que falta de design

Levantamento de 22/09/2026, sobre o app autenticado (`app/(app)`), revisto em 02/11/2026.
Ranqueado por **impacto neste produto × aderência ao estilo classical**, não por tendência.
Desde 21/10 as telas moram em `app/(app)/e/[empresa]/` (a empresa ativa vai na URL); os
caminhos abaixo que começam em `app/(app)/` ficam lá dentro.

O sistema visual está descrito em `AGENTS.md` e em
`v2- informações simples/_ds/classical-.../readme.md`. O resumo que importa aqui:
fundo claro quente, um acento dourado, cor aplicada como **traço e não
preenchimento**, filete carregando a estrutura, identidade tipográfica.

**Regras de 24/09/2026** (ver `docs/superpowers/specs/2026-09-24-refino-visual-design.md`):

- **O dourado é para seis coisas:** a ação principal (`.btn-primary`, "Nova
  conciliação"), o foco do teclado, o status "atenção", desde 27/09 o rótulo
  de cartão flutuante (o `h6` do cartão de lançamento e o do assistente, que
  aparecem por cima da tela), desde 02/10 o fio da linha das rodadas e, desde
  29/10, o envio dos extratos (as folhas da Nova conciliação e o "Enviar nova
  versão", que é o primário da casa). A lista oficial fica no comentário do
  `.app-shell`, em `globals.css`. Texto em dourado usa o tom 700: o base
  (`#b68235`) tem só 3:1 sobre o fundo. Hover e seleção usam `--tinta-hover` /
  `--tinta-ativa`, neutros. Cabeçalho de tabela, aba selecionada, rótulo pequeno
  (`h6`) fora de cartão flutuante, item ativo do menu, botão fantasma
  (`.btn-ghost`), link de ação dentro de lista ("Revisar") e numeral decorativo
  não são dourados.
- **Duas fontes:** títulos (`h1`–`h3` a partir de ~20px) e números em destaque em
  Newsreader (`--font-titulo`, com tamanho óptico); o resto em Inter. A Cormorant
  Garamond (`--font-display`) fica só na landing, e a itálica dela só no trecho em
  destaque de cada título principal da landing (`.titulo-misto` + `<em>`). Desde 02/10, a fonte nunca vai em
  `style={{}}`: número ou título grande que não é `h1`–`h3` leva `.font-titulo`, e
  rótulo pequeno em caixa alta leva `.rotulo` (12px, +0,08em; o `h6` de 14px é o
  rótulo de seção). Os ícones Lucide têm traço 1,75 (`TRACO_ICONE`, que o Shell
  passa a todos). `app/(app)/e/[empresa]/guia-de-estilo.test.ts` confere essas regras,
  e também a régua do rótulo em caixa alta (+0,08em, em 11, 12 ou 14px) e a entrada
  suave das janelas.
- **Banco e sistema são duas folhas** de canto arredondado: `--folha-banco` (papel
  claro) e `--folha-sistema` (cinza quente) — mesmo matiz, só a claridade muda;
  outra cor diria "outra coisa", não "outra folha". Com o ícone de origem
  (`IconeOrigem`).
- **Hover e seleção na cor do veredito:** linha de tabela com `data-tom` e cartão
  de extrato acendem no tom do seu status (verde, terracota, dourado, cinza).
- **Filtros de duas a quatro opções em controle segmentado** (`.pills.segmentado`),
  como o da Apple.
- **Texto gerado por IA leva selo neutro** ("Gerada por IA · confira antes de
  decidir", com o ícone `Sparkles`), nunca dourado: a IA explica, quem decide é
  quem concilia. Texto que não veio da IA não leva selo. A geração só acontece no
  clique, porque custa e tem limite diário (`ExplicacaoDaDivergencia`).
- **A comparação também decide, desde 02/10** (ver
  `docs/superpowers/specs/2026-10-02-conciliacao-em-rodadas-design.md`). Desde 03/10 a
  conferência tem coluna própria, "Conferida", no fim da linha, depois da folha do sistema: um
  círculo (`aria-pressed`, alcançável por teclado), não uma caixa ao lado do selo, que parecia
  "selecionar a linha" e entortava o eixo. Vazio a conferir, cheio com ✓ conferida; a linha
  conferida e a justificada saem da cor da categoria (selo neutro, `data-tom="neutro"`), e a
  conferida fica apagada (texto a 70%, que segura 4,5:1 nas duas folhas). Na justificada,
  "Justificada" toma o lugar do rótulo curto, sem círculo. Quando a versão nova do extrato do
  sistema não resolve uma linha conferida numa rodada passada, o círculo volta vazio com um ↻
  dourado dentro (status de atenção). O eixo leva só o veredito, **alinhado à esquerda** como o
  texto das folhas, e fica nos 9rem de sempre.
- **Gráfico é fio, não bloco (03/10).** A taxa de match mês a mês (Histórico e visão geral) é
  uma linha fina no verde dos acertos, com pontos vazados e o mês de agora cheio; os 100% num
  tracejado claro e a base num filete. Um ponto por mês do extrato, como Fechamentos, com a taxa
  pesada pelos lançamentos do mês. A linha se desenha uma vez ao abrir, como o fio das rodadas, e
  aparece inteira com movimento reduzido.
- **A linha das rodadas é o quinto uso do dourado**, pedido em 02/10. Ela fica na
  faixa da rodada e liga os quadrados das rodadas com o fio em onda de "Por
  dentro" da landing, deitado. O fio se desenha uma vez ao abrir a tela, e aparece
  inteiro com movimento reduzido. O trecho até o fechamento fica tracejado enquanto
  alguma linha pede decisão.

**Regras de 15/10 a 30/10** (revisões de estilo de 15/10 e 27/10 e de animações de 29/10):

- **Lista à esquerda, painel da escolhida à direita.** Conciliações, Histórico, Empresas e,
  desde 30/10, a Nova conciliação seguem o mesmo arranjo: `.conc-mesa` com a lista (7 partes)
  e o `.conc-previa` (5 partes, mínimo de 320px), que fica parado abaixo da faixa de filtros.
  Abaixo de 1100px o painel sobe para antes da lista. Conciliações e Histórico mostram cada
  conciliação como o par de folhas do banco e do sistema (`.conc-folha`), agrupado pelo mês do
  extrato do banco; a primeira que pede decisão já vem escolhida. Sem quadradinhos de número no
  topo: o painel diz o que importa.
- **Escolher numa tabela é neutro.** Em `.tabela-escolha` (Empresas, Equipe) a linha
  escolhida fica na `--tinta-ativa` com um filete de 2px na cor do texto à esquerda, nunca no
  dourado nem no verde. Um clique escolhe; dois cliques abrem.
- **O detalhe da linha abre num painel lateral** (`.painel-lateral`, rota interceptada), sobre
  a comparação, com anterior e próxima e Esc para fechar. O fundo escurece menos que o de janela
  modal (`rgb(12 11 10 / 0.32)`) e não desfoca, porque a comparação continua sendo lida atrás. A
  URL e a página inteira continuam existindo.
- **Janela modal entra suave.** As janelas das telas (`ModalDaTela`, `<dialog>` nativo com
  `showModal`) usam `.modal-suave`: sobem 12px e crescem de 97% em 0,24 s, e o fundo aparece
  junto. Só para quem não pediu menos movimento. O fundo segue a regra de 27/09.
- **Uma curva só para entrar e sair** (29/10): `--ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`),
  e `CURVA_DE_SAIDA` em `lib/troca-suave.ts` no JS. A troca de tela é uma `ViewTransition`: a
  tela que sai some em 120ms e a nova sobe em 200ms. Por isso, **dentro do app e da Central de
  ajuda os blocos não entram mais em cascata** (`MotionRoot revelar={false}`): a cascata por
  cima da troca de tela fazia o conteúdo levar quase um segundo para assentar. O `Reveal`
  continua na landing.
- **Tutorial do mascote é cartão no canto, não janela** (15/10): o destaque do passo é traço
  neutro, nunca dourado, e a tela continua usável por trás.

## Tier 1 — buracos, não polimento

### 1. Estados de carregamento — ✅ feito

Todas as telas do app faziam `return null` e estalavam o conteúdo. Era a primeira
impressão de toda navegação.

Resolvido com esqueletos de filete (sem shimmer — gradiente animado quebraria a
calma editorial) e `aria-busy`, em `app/(app)/esqueleto.tsx`.

> **Nota estrutural:** isso existe porque o mock é `localStorage`, logo client-only.
> Quando o backend entrar, Server Components + Suspense elimina o problema em vez
> de mascará-lo. O esqueleto é ponte consciente, não solução final.

### 2. Undo em vez de confirmação — ✅ feito

"Aceitar valor do banco" reclassificava dinheiro sem volta. O mercado convergiu
forte aqui (Gmail → Linear): ação otimista com desfazer ganha de diálogo de
confirmação, porque confirmação treina a pessoa a clicar "sim" sem ler.

Resolvido: o aceite acontece **na própria tela** (não navega mais), o cartão passa
a "Conciliado" na hora e uma barra de desfazer aparece com o estado anterior
guardado. O design já previa um estado `desfazer` que nunca tinha sido usado.

### 3. Tabela que aguenta 4.218 linhas — ✅ feito

A comparação em `/conciliacoes/[id]` renderizava **todas** as linhas, sem
ordenação, filtro ou paginação, e a dashboard mostrava 7 de 4.218.

Resolvido: pills de filtro (as do próprio design), ordenação por coluna e
paginação. Virtualização ficou de fora de propósito — paginação resolve, e
virtualizar antes de ter dado real é otimizar no escuro.

## Tier 2 — é a régua atual para ferramenta de trabalho

### 4. Dark mode — ✅ feito

As rampas escuras não foram escolhidas a dedo: `scripts/gerar-escuro.mjs` lê a
escala do tema claro e **espelha a luminosidade**, mantendo matiz e o arco de
croma (com o croma 15% menor, porque cor saturada sobre fundo escuro vibra). O
passo 100 passa a ser o mais escuro e o 900 o mais claro, e é isso que permite
**nenhum componente mudar de passo**: quem pedia `--color-ok-700` para texto
continua pedindo e recebe um verde claro legível.

O bloco de CSS é gerado, não escrito à mão, e sai em duas cópias — uma para quem
pediu escuro no sistema, outra para quem escolheu no app — geradas juntas para
não divergirem.

**Escopo: só o app autenticado (`.app-shell`).** A landing e as telas de acesso
seguem claras porque o `logo-barras` é 63% de pixels escuros e sumiria no fundo
escuro. Levar o escuro para o site inteiro exige uma variante clara do logo, que
não existe. Os mascotes, esses, são 60–79% de pixels claros e sobrevivem.

> **Armadilha anotada:** o `.app-shell` precisa declarar `color` explicitamente.
> Redefinir `--color-text` dentro dele não conserta texto herdado do `<body>`,
> que já computou a cor clara lá em cima. Sem isso o fundo escurece e o texto
> continua preto.

### 5. Teclado — parcial

- ✅ **Bug corrigido:** a busca agora é um `combobox` de verdade, com
  `aria-expanded`, `aria-controls`, `aria-activedescendant` e um `listbox` de
  `option`s. Setas andam pela lista (dando a volta nas pontas), Enter abre o
  resultado apontado, Escape fecha.
- ⬜ **Falta:** paleta com **ações** (não só busca), `j/k` na tabela, `?` abrindo
  a folha de atalhos. São decisões de produto maiores que um ajuste de foco.

### 6. Controle de densidade — ✅ feito

Duas densidades de tabela, ao lado dos filtros da comparação, lembradas entre
sessões.

O design resolve isso com `zoom` em quatro níveis. Não copiei: `zoom` escala a
página inteira, incluindo o menu sticky e os painéis posicionados, que passariam
a calcular posição sobre um layout escalado. O controle aqui é só das linhas de
tabela, que é onde a densidade paga numa ferramenta de conciliação.

## Tier 3 — refinamento que cai bem neste estilo

### 7. Animar a consequência, não a entrada — ✅ feito

Dois lugares onde algo muda de verdade no lugar:

- **O valor do cartão no detalhe** interpola quando você aceita o valor do banco
  (`app/(app)/numero-animado.tsx`). O componente **não anima ao montar**, de
  propósito: um número que sobe do zero toda vez que a tela abre é decoração;
  um número que sai de 12.604 para 12.640 é a resposta ao seu clique.
- ~~**A regra que troca de lista** chega com um realce que apaga.~~ Saiu em
  26/09: as regras são de demonstração, então "Desativar" e "Criar regra" ficam
  desligados, com o aviso da tela (como na Assinatura), e não há mais troca de
  lista para realçar. Volta junto com a rota de regras no backend.

**Regra de 26/09: toda tela abre com o `Cabecalho`** (`app/(app)/cabecalho.tsx`).
O título é o nome que o menu dá à tela ("Conciliações", não o nome da empresa);
a linha de baixo começa sempre pela empresa e segue com o contexto da tela
("Telha Certa · competência setembro/2026 · 140 lançamentos"); à direita, só as
ações da própria tela. "Nova conciliação" mora no menu e não se repete no
cabeçalho. Tela de detalhe troca a linha por um sobretítulo que diz onde o item
está ("Valor diverge na mesma data · item 31 de 42").

**Regra de 26/09: tela com dado de demonstração avisa.** Assinatura e Regras
mostram `.aviso-demonstracao` no topo, e toda ação que gravaria algo aparece
desligada, com `aria-describedby` apontando para o aviso. Onde o dado real existe
(avisos, busca), a tela usa ele e nunca uma lista inventada.

**Regra de 27/09: toda janela modal escurece e desfoca o fundo**, como as
Configurações: `rgb(12 11 10 / 0.55)` com `backdrop-filter: blur(3px)`. A regra
mora num lugar só em `globals.css` e vale para o `<dialog>` nativo aberto com
`showModal` (`dialog::backdrop`: Configurações, espia da linha) e para o
`.dialog-backdrop` das janelas montadas à mão (cancelar assinatura). Janela nova
não declara fundo próprio. A exceção é o "recuperar senha" do login, que tem o
fundo claro desfocado da tela de acesso (`.recuperar-fundo`).

> **O que não fiz:** o scroll-reveal na chegada dos blocos continua. Removê-lo é
> a outra metade do argumento, mas é mudança de gosto sobre algo que vocês já
> viram e aprovaram — fica como decisão de vocês, não minha.
>
> **Decidido em 27/09:** o scroll-reveal fica, e vale para todas as telas do app.
> Os blocos abaixo do cabeçalho entram com `Reveal`, em sequência
> (0, 0,08, 0,16 s); os mascotes das telas levam o rastro de tinta (`InkHover`).
> O `MotionRoot` está no template do app (`app/(app)/template.tsx`), então tela
> nova só usa o `Reveal` de `app/reveal.tsx`. O `NumeroAnimado` continua
> animando só a consequência, nunca a chegada.
>
> **Mudado em 29/09:** o `Reveal` anima uma vez só em todo lugar, landing
> inclusive (antes a landing reanimava a cada passagem: quem voltava rolando
> esperava o fade de novo), e entra subindo 16px em vez de crescer de 96%, que
> borrava o texto dos blocos grandes. É o que fazem Linear, Stripe e Vercel. O
> prop `once` saiu, porque virou o único comportamento.
>
> **Mudado em 29/10:** dentro do app os blocos não entram mais em cascata; a troca de tela
> já anima a chegada (ver "Regras de 15/10 a 30/10", no topo). O `Reveal` fica na landing.

### 8. Divulgação progressiva no detalhe da divergência — ✅ feito

"Crônico, não pontual" abre por padrão (é a leitura que muda o que você faz a
seguir) e "Histórico do lançamento" vem fechado (procedência é consulta).

Usa `<details>`/`<summary>` nativo, o mesmo que o FAQ da landing já usava: abre
sem JS, entra no Ctrl+F do navegador e já vem com teclado. O CTA "Criar regra"
saiu do `summary` para o corpo — botão dentro de `summary` vira dois alvos
disputando o mesmo clique.

### 9. Tabela em cartões no celular — ✅ feito

Abaixo de 680px cada linha vira um cartão, com a descrição de título e os demais
campos rotulados.

> **Armadilha:** `display: block` numa tabela **apaga o papel implícito de
> tabela** e o leitor de tela passa a ler uma pilha de textos soltos. As linhas e
> células declaram `role` explicitamente para a grade sobreviver.

> **Vale dizer:** o spec da landing registra que "o sistema é usado no desktop".
> Isto é polimento de menor valor aqui do que seria num produto mobile-first.

## O que eu não traria

Metade do que o mercado "aprova" destruiria esta identidade.

- **Glassmorphism.** A barra superior do app tinha `backdrop-filter: blur(6px)`, a
  coisa mais "SaaS 2021" do código; desde 15/10 ela é opaca (`.app-topo`). O
  desfoque atrás de janela modal, regra de 27/09, é outra coisa: ele tira a tela de
  trás de foco. O que fica de fora é superfície de vidro. Ainda há um resto: a barra
  da Central de ajuda (`.ajd-barra`) tem fundo a 92% com `blur(8px)`.
- **Bento grid, gradiente mesh, glow / neon.** Briga direto com "cor como traço,
  sem preenchimentos grandes".
- **Soft UI, tudo arredondado.** O sistema é filete e raio pequeno; inflar apaga o
  caráter.
- **Ícones em tudo.** O readme do design system sugere Lucide. O app usa ícone
  (Lucide, na cor do texto) para duas coisas só, regra revista em 27/09/2026:
  - **navegar:** o menu lateral, porque menu que recolhe precisa de algo no
    lugar do nome; os atalhos da visão geral; as seções e a busca das
    Configurações;
  - **dizer estado:** a origem do extrato (prédio do banco, base de dados do
    sistema), porque banco e sistema precisam se distinguir num relance; os
    passos de Fechamentos; o selo de texto gerado por IA.

  Botão de ação tem rótulo, não ícone ("Enviar", "Exportar histórico", "Sair",
  "Explicar esta divergência"). A exceção é o X de fechar janela, que é controle
  e não ação. Decisões de 24/09/2026 em
  `docs/superpowers/specs/2026-09-24-menu-lateral-recolhivel-design.md` e
  `2026-09-24-refino-visual-design.md`.
- **Sparkle de IA.** O assistente existe no design como conversa com o mascote,
  que é da marca. Um botão ✨ genérico não é.

## Dívidas pontuais anotadas pelo caminho

- ~~`--color-erro` (`#a94f33`) está fora da rampa de `risco`.~~ Resolvido em 15/10: é
  o passo 700 da terracota (`#8a4934`, 5,1:1 sobre o fundo claro), e dentro do
  `.app-shell` aponta para `--color-risco-700`, que o tema escuro espelha.
- ~~O `eslint-disable` de `react-hooks/set-state-in-effect` no login gera warning.~~
  O lint não acusa mais nada no app; o comentário continua no login.
- ~~O `AGENTS.md` dizia Cormorant e Lora enquanto o código carregava Inter.~~
  Resolvido em 24/09/2026: o `AGENTS.md` descreve o que o código faz (Inter no
  corpo e na interface, Newsreader nos títulos do app, Cormorant nos destaques da
  landing).
- **Corrigido depois de um diagnóstico errado:** eu tinha anotado aqui que o
  `data-tema` sumia por causa do HMR. Não era. O script inline escreve o atributo
  antes da hidratação, o HTML do servidor não o tem, e o React trata como
  incompatibilidade — avisando literalmente que "won't be patched up" e
  descartando o atributo. A correção é `suppressHydrationWarning` no `<html>`,
  que existe exatamente para atributos escritos antes da hidratação. O teste em
  produção passou porque lá eu cliquei o toggle *depois* da hidratação, que é um
  caminho que nunca quebrou.
- O diálogo de linha em `/conciliacoes/[id]` e a tela de detalhe mostram a mesma
  informação. Quando a tela provar que basta, o diálogo sai.
- ~~**Pendente (27/09): as explicações da demonstração da landing.**~~ **Decidido em
  01/10/2026:** ficam as explicações escritas no estilo da IA ("O banco descontou
  R$ 36,00 de juros por atraso no boleto…"), porque a IA estará ligada no
  lançamento e a landing mostra o produto pronto, não o estado de hoje. Elas vêm
  com o selo neutro de IA (`SeloIa`, em `app/(app)/selo-ia.tsx`) no cartão de
  hover da comparação e no cartão aberto da miniatura de "Por dentro", como o
  produto marca texto da IA e como os Termos prometem. Se o lançamento acontecer
  com a IA ainda desligada, a saída volta a ser trocar os textos pelos motivos
  fixos do motor (`_MOTIVOS_DETERMINISTICOS`, no backend).
