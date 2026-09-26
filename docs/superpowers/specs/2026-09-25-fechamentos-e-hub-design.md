# Ledgr — Fechamentos refeito e a visão geral como hub

## Contexto

Pedido de 25/09/2026: refazer a tela de Fechamentos ("não gostei dela") e fazer da
visão geral um hub central, que leve a pessoa a qualquer tela com facilidade, no
estilo do app. A referência de estilo mandada junto foi a tela de Extratos
(galeria de folhas com painel ao lado).

## Fechamentos

A versão anterior mostrava só o mês da conciliação mais recente: um mascote
grande, uma frase, três números e um único marco (os outros não têm fonte). Com o
backend sem registro de fechamento, sobrava pouco para a tela fazer.

**Decisões**

1. **Mesa de meses, no desenho da galeria de Extratos.** Cada competência é uma
   folha (mês, ano, taxa conciliada, barra), com selo embaixo ("Pronto para
   fechar", "84 pendências", "Linhas não lidas"); a selecionada abre no painel ao
   lado. Filtro segmentado: Todos, Prontos para fechar, Com pendência.
2. **Um mês é todos os pares de extratos dele.** O mês de cada par vem da primeira
   data do extrato (`GET /conciliacoes/{id}?limit=1`); sem ela, do dia em que foi
   conciliado, no fuso de Brasília. Só as rodadas atuais.
3. **O painel é o caminho até fechar**, em passos: extratos conciliados (com link
   para cada par), divergências decididas (por categoria, na régua das cores de
   status), arquivos lidos por inteiro, e o relatório para o contador (o CSV da
   conciliação, que existe). A ação principal muda com o estado: "Começar
   outubro", "Revisar pendências" ou "Ver extratos".
4. **Nada finge que fechou.** O backend não registra o encerramento; o painel diz
   que o mês fica pronto quando nada pede decisão.
5. **As contagens vêm de `/execucoes`.** `Execucao` passou a guardar as
   divergências por categoria (`divergencias`), que o adaptador descartava. Por
   par, mais três chamadas: a primeira linha e os dois arquivos. Somem com o
   período em `/execucoes` e com `GET /extratos` (backend #70).
6. **Saíram:** o herói com mascote grande e os marcos. O mascote comemorando fica
   pequeno, no painel do mês pronto.

## Visão geral como hub

A decisão 8 da spec de 24/09 deixava de fora "atalhos que repetiriam o menu". O
pedido agora é o contrário, e a saída é o atalho não repetir o menu: cada cartão
diz o estado da tela.

- **Extratos:** quantos arquivos, quantos do banco e do sistema, os dois da última
  conciliação e as linhas não lidas.
- **Conciliações:** quantos pares conciliados e quando foi a última.
- **Fechamentos:** a competência e as pendências **da última conciliação** — a home
  não carrega os outros pares do mês, e somar o mês é da tela de Fechamentos.
- **Histórico:** quantas execuções e o match da última.

Tudo sai do que a visão geral já carregava: nenhuma chamada a mais. Os cartões
ficam logo abaixo do estado do mês, antes de "Pede sua atenção".

## Verificado no navegador (backend falso)

- 1440px, tema escuro: folha de setembro com 70,0%, painel com os quatro passos e
  as cinco categorias, os dois CSVs e "Revisar pendências"; hub com os quatro
  cartões.
- 375px: sem rolagem lateral; folhas e painel empilhados.
