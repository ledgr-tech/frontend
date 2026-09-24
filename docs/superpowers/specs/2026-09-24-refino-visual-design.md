# Ledgr — Refino visual: menos dourado, duas fontes, duas folhas

## Contexto

Retorno de 24/09/2026, olhando a comparação direta e a tela de extratos:

- "tem muito da cor amarela";
- "a fonte ser sempre a mesma me incomoda";
- na comparação, uma divisão de folha com cor levemente diferente, para mostrar
  que banco e sistema são duas coisas diferentes;
- usar o ícone do banco ou do sistema.

## Decisões

1. **O dourado ficou com três papéis:** ação principal, foco do teclado e o status
   "atenção". É o que Stripe, Linear e Mercury fazem com a cor da marca. Saíram do
   dourado: cabeçalhos de tabela, abas e pílulas selecionadas, rótulos pequenos
   (`h6`), hover de itens, item ativo do menu, contorno dos painéis flutuantes,
   cartão de extrato selecionado e o card do assistente. No lugar, dois tons
   neutros declarados no `.app-shell` (`--tinta-hover`, `--tinta-ativa`), que herdam o
   `--color-text` do tema escuro.

2. **Um bug escondia o excesso.** Todo cabeçalho ordenável tem `aria-sort`, inclusive
   `"none"`, e a regra `th[aria-sort]` pintava todas as colunas de dourado, não só a
   ordenada. Agora só `ascending`/`descending` ganham cor — e a cor é a do texto.

3. **Títulos em Cormorant Garamond, o resto em Inter.** É a serifada do design
   system e a que a landing já usa. Só a partir de ~20px: abaixo disso ela fica
   frágil, então listas, tabelas, botões e o título dos passos (18px) seguem em
   Inter. `font-size-adjust: 0.46` aproxima a altura das minúsculas da Inter — sem
   isso a Cormorant parece um corpo menor no mesmo px. Algarismos alinhados
   (`lining-nums`): os de estilo antigo sobem e descem, e em valor atrapalham. O
   peso 400 passou a ser carregado para os números grandes e manchetes.

4. **Comparação em duas folhas**, como a "folha a folha" do design (`isFolhas` em
   `Ledgr.dc.html`): uma linha de cabeçalho a mais, "Extrato do banco · Fonte da
   verdade" sobre data, descrição e valor, e "Sistema de gestão" sobre o valor do
   sistema. Banco em papel quente (`--folha-banco`), sistema em tom frio
   (`--folha-sistema`, sem amarelo), um vão de 14px da cor da página entre as duas.
   O status fica fora das folhas: é o veredito da comparação. No celular a tabela já
   vira cartões; lá o vão some e as folhas perdem o tom.

5. **Os mesmos tons em todo lugar que mostra banco e sistema:** os cartões do
   detalhe da divergência (antes o do banco tinha contorno dourado) e as miniaturas
   de folha na tela de extratos.

6. **Ícone de origem genérico** (`IconeOrigem`: `Landmark` para o banco, `Database`
   para o sistema) no cartão e no painel do extrato, no cabeçalho das folhas, nos
   cartões do detalhe, no diálogo da linha e na coluna Origem da dashboard. O logo
   do banco de verdade depende de o backend dizer qual banco é: o OFX traz o código
   (`BANKID`), mas a API só devolve "banco" ou "sistema". Adivinhar pelo nome do
   arquivo erraria. Fica anotado para o backend; o ponto de troca está num
   `ponytail:` em `icone-origem.tsx`.

## Verificado no navegador (backend falso)

- **Comparação, 1280px, claro:** duas folhas com tons distintos e o vão; título das
  folhas numa linha só; só a coluna ordenada com cor cheia; pílulas em neutro.
- **Dashboard:** "Telha Certa" e os três números em Cormorant, com algarismos
  alinhados.
- **Extratos:** ícone ao lado do nome em cada cartão e à direita do nome no painel;
  miniaturas no tom da origem; rótulo "Arquivo · conciliado" em neutro.
- **Detalhe, escuro:** cartão do banco `#25231f`, do sistema `#1f2429`, cada um com
  o ícone; item ativo do menu em cinza.
- **375px:** comparação em cartões, sem vão nem rolagem lateral.

## Segunda rodada (mesmo dia)

Retorno: o azul do sistema "não faz sentido, azul é outra coisa"; as bordas
quadradas não combinam com o sistema; "o hover deve ser da cor do match"; e um
desenho mais próximo do nosso, inspirado na Apple.

7. **Sem azul.** As duas folhas ficam no mesmo matiz quente e neutro e mudam só de
   claridade: banco em papel claro (`#fdfcfa`, escuro `#2c2a27`), sistema em cinza
   quente (`#ebe8e3`, escuro `#232120`). Outro matiz carrega outro significado
   (link, informação); aqui a diferença é de folha, não de natureza.

8. **Folhas arredondadas**, como as listas agrupadas da Apple, com o raio do
   sistema (`--radius-md`, 16px). A tabela passou a `border-collapse: separate`,
   única forma de a célula do canto aceitar `border-radius`. A coluna do status
   perdeu o filete próprio: a estrutura é das folhas. O vão foi para 16px.

9. **Hover na cor do veredito.** Interpretei "a cor do match" como a cor do
   resultado de cada linha: a linha acende em verde se casou, terracota se o valor
   diverge ou há duplicidade, dourado se falta par, cinza na tarifa. `data-tom` na
   linha da comparação e da dashboard; o cartão de extrato faz o mesmo no hover e na
   seleção, na cor do selo embaixo dele.

10. **Controle segmentado** no lugar das pílulas soltas ("Todos / Só revisão",
    "Padrão / Compacta", filtros dos extratos): um trilho neutro com a opção
    escolhida levantada (`--superficie-elevada` e `--shadow-sm`), como no iOS e no
    macOS.

Verificado no navegador: folhas nos dois temas sem azul, os quatro cantos de cada
folha a 16px, hover terracota na linha do "Boleto Aço Norte" atravessando as duas
folhas e o status, cartão selecionado de extrato com contorno verde, controles
segmentados nas duas telas.

## Terceira rodada (mesmo dia)

Retorno: não gostou da Cormorant nos títulos; "vamos usar outra variação". A outra
serifada da maquete de comparação era a Newsreader.

11. **Títulos do app em Newsreader**, num token próprio (`--font-titulo`). É a
    mesma ideia da Apple, que põe a New York (serifada com tamanhos ópticos) ao
    lado da SF: a Newsreader vem com o eixo `opsz`, então o título de 30px ganha
    mais contraste e o de 20px fica mais firme, sem arquivo a mais. A Cormorant,
    delicada e de olho pequeno, pedia `font-size-adjust` para não parecer menor;
    a Newsreader tem altura de minúscula perto da Inter (0,52 contra 0,55) e
    dispensa o ajuste. Os algarismos já são tabulares e alinhados.
12. **A landing continua em Cormorant** (`--font-display`), que volta a carregar
    só os pesos 500 e 600 de antes: o 400 tinha vindo para o app.

Verificado no navegador: "Telha Certa", os três números da dashboard, a visão geral
e o cabeçalho das folhas em Newsreader, nos dois temas; a landing em Cormorant;
console limpo numa aba nova.
