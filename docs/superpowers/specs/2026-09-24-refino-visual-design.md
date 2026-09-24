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
