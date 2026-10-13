# Ledgr: Cap. II como "Ache as diferenças", e a comparação em "Por que o Ledgr"

> **Revisão de 13/10/2026, depois de ver no navegador:** o jogo "Ache as diferenças" saiu. A landing
> é uma página de leitura, e um jogo pede uma interação que ninguém veio fazer. **Vale desta spec só a
> seção "Por que o Ledgr"** (a comparação numa tabela, entre "Por dentro" e "Regra de ouro"). O Cap. II,
> para mostrar a dor só com leitura, ficou assim (aprovado no chat em 13/10, a partir da Ramp, que
> mostra o jeito velho como ele é, e do Pilot, que fala a dor na voz de quem lê):
>
> - as duas telas de agosto como chegam à mão, sem a coluna do status, com "… mais 4.213 lançamentos"
>   no fim do banco (`conferencia-a-mao.tsx`);
> - três dores numeradas, com o número na margem da linha por trás de cada uma: "Horas que não voltam"
>   (a escala, 4.218 lançamentos), "O olho cansa" (R$ 7.912,45 e R$ 7.912,40) e "O que passa aparece
>   depois" (a tarifa de R$ 45,00). Os números saem das constantes de agosto do `page.tsx`, as mesmas
>   do hero (`LANCAMENTOS_DE_AGOSTO`);
> - a ponte "O Ledgr confere todas as linhas e aponta só as que não batem, com o motivo.", com o link
>   "Veja como funciona";
> - "Na prática", a demonstração com as marcas do Ledgr, foi para o fim do Cap. III, depois dos três
>   passos, como o resultado de "Receba as divergências".

## Contexto

Pedido de 13/10/2026. O Cap. II da landing (`#problema`, "O problema" no menu) incomodava como um
todo, e a seção precisava de uma revisão de conceito: mostrar a dor, deixar claro que a pessoa
perde tempo conferindo à mão, que cansa, que o erro humano deixa passar coisa. A dúvida era se o
capítulo devia mostrar o Ledgr ou só dizer que ele faz isso.

Hoje a seção junta três partes: a dor (título e um parágrafo), a comparação "Hoje × Com o Ledgr"
(três colunas, quatro perguntas) e "Na prática" (a demonstração das duas folhas já conferidas, com
o cartão do hover). Os problemas vistos nos prints de 13/10, em 1440 px e 390 px:

- é a única seção sem âncora visual perto do título: depois dele vêm 12 respostas de mesmo peso;
- a comparação parece tabela sem ser: a pergunta se repete três vezes, as colunas de "Hoje" são
  caixas invisíveis e a caixa dourada do Ledgr passa da margem direita (`margin-inline: -25px`);
- dois títulos competem ("Duas telas abertas…" e "As mesmas duas telas, conferidas pelo Ledgr.");
- no celular a seção tem cerca de 3.700 px.

Não há número medido de tempo ou de erro: a pesquisa de requisitos do `ledgr-docs`
(`03-pesquisa/2026-08-11-pesquisa-de-requisitos-iniciais.md`) é um modelo vazio, e a pesquisa de
mercado só fala em "risco máximo de erro humano" das planilhas. A dor aparece pela experiência, sem
estatística.

O conceito e os três desenhos (textos e estrutura, comportamento do jogo, "Por que o Ledgr") foram
aprovados no chat em 13/10, com um protótipo interativo do jogo.

## Decisões

1. **O Cap. II é só a dor, e termina numa ponte.** Padrão PAS (problema, agitação, solução): a
   solução no meio da dor tira a força dela, e a landing já mostra o Ledgr trabalhando no Cap. III e
   em "Por dentro". O capítulo fecha com uma frase dizendo que o Ledgr faz isso e um link para o
   Cap. III.
2. **A dor é um jogo: "Ache as diferenças".** As mesmas duas folhas de agosto, **sem** as marcações
   do Ledgr; o visitante marca as linhas do banco que acha que não batem e pede para ver o que
   passou. As diferenças dos dados de agosto já são sutis de verdade: R$ 36,00, R$ 0,05, uma tarifa
   que o sistema não tem e uma data um dia depois. Foi preferido a "dor em texto com três cartões"
   (mais simples, mas só afirma a dor) e a "antes e depois na mesma seção" (é o que dilui a dor hoje).
3. **A comparação sai do Cap. II e vira a seção "Por que o Ledgr"**, entre "Por dentro" e "Regra de
   ouro", como tabela de verdade. É o padrão das páginas de comparação (Pilot, Bench): depois de o
   produto estar explicado e antes de preço e perguntas. A última linha ("O que custa") prepara a
   Assinatura. Os textos da comparação não mudam.
4. **Os dados são os de agosto que a landing já usa** (`EXTRATO_BANCO` e `EXTRATO_SISTEMA` em
   `page.tsx`), os mesmos do hero, de "Por dentro" e de Preços. Cada linha divergente ganha um
   `fato`, o que os próprios números dizem. Os números do texto (cinco lançamentos, as 4 diferenças)
   saem dos dados, o de lançamentos por extenso, como a landing já faz com as categorias.
5. **A revelação fala a língua do app.** O selo de cada linha é o `rotuloCurto` do app, e o que
   diverge é o que `estaResolvida` não aceita: o site não ensina um nome e o produto mostra outro.

## Cap. II, de cima para baixo

### Abertura

- Rótulo: `Cap. II · O jeito de hoje` (sem mudança; o menu continua "O problema · Cap. II").
- Título: "Duas telas abertas, um dedo em *cada linha.*" (sem mudança: é do pitch, e é o que o jogo
  faz o visitante viver).
- Texto, novo: ver a tabela "Texto novo".

### O jogo

- Rótulo `Tente você`, a instrução e, à direita, o cronômetro (`0:00`).
- Duas folhas lado a lado, no desenho das folhas de hoje: banco em fundo claro (`folha-banco`),
  sistema tingido (`folha-sistema`), cada uma com Data, Descrição e Valor. **Sem a coluna de status
  no meio**: ela é o trabalho do Ledgr, e é o que falta na conferência à mão.
- O banco tem 5 linhas e o sistema 4 (a tarifa não está no sistema), então as linhas desalinham a
  partir da tarifa, como na vida real:

  | Banco | Sistema |
  |---|---|
  | 03/08 Recebimento cliente Alfa Comércio · R$ 3.250,00 | 03/08 Recebimento cliente Alfa Comércio · R$ 3.250,00 |
  | 04/08 Pagamento fornecedor #1082 · R$ 12.640,00 | 04/08 Pagamento fornecedor #1082 · R$ 12.604,00 |
  | 05/08 Crédito cartão D+30 · R$ 7.912,45 | 05/08 Crédito cartão D+30 · R$ 7.912,40 |
  | 06/08 Tarifa de manutenção da conta · R$ 45,00 | 12/08 Aluguel sede agosto · R$ 9.800,00 |
  | 11/08 Aluguel sede agosto · R$ 9.800,00 | |

- Cada linha do banco é um botão de alternar (`aria-pressed`), com o nome inteiro ("04/08, Pagamento
  fornecedor #1082, R$ 12.640,00"). Marcada, ganha o filete dourado e o tom dourado claro da seleção
  do app. As linhas do sistema são só texto.
- O cronômetro começa no primeiro toque numa linha e para na revelação, em `m:ss`, com algarismos
  tabulares. Não é anunciado a cada segundo (fica fora da região viva).
- Embaixo: o botão **Ver o que passou**, que funciona mesmo sem nada marcado.

### A revelação

- As linhas do banco deixam de ser botões e viram texto com uma nota embaixo, que entra em sequência,
  uma linha depois da outra (cerca de 150 ms cada; com movimento reduzido, tudo de uma vez):
  - divergente e marcada: "Você achou." no verde de status (`--color-ok`);
  - divergente e não marcada: "Passou." no terracota (`--color-erro`);
  - marcada e que bate: "Esta bate.", no tom do texto de apoio;
  - a nota da divergente traz o selo e o fato: "Valor diverge · R$ 36,00 a mais no banco",
    "Valor diverge · R$ 0,05 de diferença", "Tarifa · não está no sistema",
    "Data diverge · no sistema, 12/08".
- A linha par no sistema (casada pela descrição, como na `TabelaFolhas`) acende no mesmo tom, para o
  par ficar à vista. A tarifa não tem par.
- O resultado entra numa região viva (`aria-live="polite"`), anunciado uma vez, e com ele a ponte e
  as duas ações: o link **Ver como funciona** (`#como`) e o botão **Tentar de novo**, que desmarca
  tudo, zera o cronômetro, esconde as notas e devolve o foco para a primeira linha do banco.
- Nada fica guardado: recarregar a página começa o jogo do zero.

### No celular

- As folhas **continuam lado a lado** (comparar é o jogo; empilhadas, o visitante rolaria para cima e
  para baixo). Abaixo de 600 px cada linha vira duas: data e valor em cima, descrição embaixo, menor,
  cortada com reticências. Em 390 px cada folha tem cerca de 175 px.
- No toque, a instrução diz "Toque" no lugar de "Marque" (`so-mouse` / `so-toque`, como a dica de
  hover já faz).

### O que sai do Cap. II

- A comparação "Hoje × Com o Ledgr" (vai para "Por que o Ledgr").
- "Na prática": o título "As mesmas duas telas, conferidas pelo Ledgr.", o texto dele, a
  demonstração com o cartão do hover (`ExtratoComparacao`) e a `DicaDoMouse` embaixo dela.
- `ExtratoComparacao` só servia ao Cap. II: sai com o teste dele, e sai também o que só ele usava (o
  caminho `interacao` da `TabelaFolhas` e o CSS do hover da demonstração), se a janela de "Por
  dentro" não usar. O tipo `LinhaExtrato` continua.

## "Por que o Ledgr"

- Seção `id="por-que"` entre `#por-dentro` e `#regra`, em fundo de superfície (`--color-surface`,
  o de "Como funciona"), com a onda da faixa clara de cima (`onda onda-faixa-clara`). A Regra de
  ouro passa a ter a onda da superfície (`onda-superficie`). As faixas seguem alternando: faixa
  clara (Por dentro), superfície (Por que o Ledgr), papel (Regra de ouro).
- Rótulo `Por que o Ledgr`, no estilo dos rótulos de capítulo, e o título (`titulo-misto`): "Sem
  trocar de sistema, *e sem voltar para o manual.*" Sem texto de apoio.
- Uma `<table>` com legenda escondida para leitor de tela; em `<thead>`, "Hoje" sobre as duas
  primeiras colunas (`scope="colgroup"`) e "Com o Ledgr" sobre a última; depois "Conferir à mão",
  "Migrar para um sistema com conciliação" e "Ledgr", com o `LogoBarras` (`scope="col"`). Cada
  pergunta de `ASPECTOS` é um `<th scope="row">`, uma vez só.
- As respostas são as de `SAIDAS_DE_HOJE` e `SAIDA_LEDGR`, como hoje: o destaque em negrito, o resto
  um tom abaixo.
- A coluna do Ledgr tem o filete dourado de cima a baixo, sem preenchimento (cor como traço, como na
  Regra de ouro e nos cards de Preços), e fica dentro da margem da página.
- A partir de 760 px é tabela. Abaixo, cada pergunta vira um bloco com as três respostas, o nome da
  opção pequeno acima de cada uma (`data-rotulo`), e a do Ledgr por último, com o filete. É o padrão
  que o app usa nas tabelas no celular (`tabela-cartoes`), com os `role` que mantêm a tabela para o
  leitor de tela, e sem conteúdo duplicado no HTML.
- O link "Por que o Ledgr" do rodapé continua em `#por-que`, agora para a seção nova. Os títulos
  aparecem com `Reveal`, como no resto da landing.

## Texto novo

O resto é texto que a landing já tinha. Estes foram aprovados no chat em 13/10:

| Onde | Texto |
|---|---|
| Cap. II, texto da abertura | "Todo fim de mês, alguém confere o extrato do banco contra o do sistema de gestão, item por item. É lento, cansa e um erro passa sem ninguém ver. Quanto maior o volume de lançamentos, pior fica, e o mês fecha sempre no aperto." |
| Rótulo do jogo | "Tente você" |
| Instrução, com mouse | "Cinco lançamentos de agosto. Marque os do banco que não batem com o sistema." |
| Instrução, no toque | "Cinco lançamentos de agosto. Toque nos do banco que não batem com o sistema." |
| Botão | "Ver o que passou" |
| Notas | "Você achou." · "Passou." · "Esta bate." |
| Fatos | "R$ 36,00 a mais no banco" · "R$ 0,05 de diferença" · "não está no sistema" · "no sistema, 12/08" |
| Resultado | "Você achou 2 de 4, em 0:42." (com os números do jogo) · sem nada marcado: "Você não marcou nenhuma: passaram as 4." |
| Ponte | "Num fechamento real são centenas de linhas, todo mês. O Ledgr confere todas e aponta só as que não batem, com o motivo." |
| Ações | "Ver como funciona" · "Tentar de novo" |
| Por que o Ledgr, título | "Sem trocar de sistema, *e sem voltar para o manual.*" |
| Por que o Ledgr, legenda (só leitor de tela) | "As saídas de hoje e o Ledgr, pergunta por pergunta" |

Sem travessão, como o resto da landing.

## Testes e verificação

- `app/(marketing)/ache-as-diferencas.test.tsx`, novo: cinco botões no banco, com o nome inteiro, e
  quatro linhas no sistema; marcar alterna `aria-pressed`; o cronômetro começa no primeiro toque e
  para na revelação (relógio falso); as notas de achou, passou e bate, com o selo e o fato; o par do
  sistema acende; o resultado na região viva, com e sem nada marcado; depois da revelação não há
  botão de linha; "Tentar de novo" zera e devolve o foco; os números saem dos dados.
- `app/(marketing)/page.test.tsx`: o Cap. II com o título e o texto novos, o jogo, a ponte para
  `#como`, e sem "Na prática" nem comparação; "Por que o Ledgr" entre `#por-dentro` e `#regra`, com
  cabeçalhos de coluna e de linha, a coluna do Ledgr em destaque, sem nome de concorrente e com o
  link do rodapé; as ondas (`#por-que` com `onda-faixa-clara`, `#regra` com `onda-superficie`). Sai o
  teste que comparava a demonstração do Cap. II com a janela de "Por dentro".
- `npm run test && npm run lint && npm run build`.
- No navegador: 1440, 768 e 390 px, no tema claro (a landing não tem tema escuro: o escuro do
  `globals.css` vale só para o `.app-shell`); jogar com mouse, com teclado e no toque;
  movimento reduzido; a coluna do Ledgr dentro da margem; a altura do Cap. II no celular comparada
  com os ~3.700 px de hoje.

## Fora do escopo

- Qualquer número de tempo ou de erro que não esteja medido.
- Guardar o resultado do jogo, ou medir quem joga.
- Mudanças no Cap. III, em "Por dentro" ou nos textos da comparação.
