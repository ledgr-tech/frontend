# Ledgr — Relatório agrupado pelas 5 categorias (issue #6)

## Contexto

A issue #6 pede o relatório agrupado pelas cinco categorias de divergência, com
contadores e drill-down, "navegável exibindo os dados reais do backend". O
backend já aceitava o filtro `status` em `GET /conciliacoes/{id}` e em
`/exportar`, e o front não usava.

## Decisões

1. **O relatório mora na tela da conciliação**, em cima da tabela, e não numa
   rota nova. A tabela, a ordenação, a paginação, o CSV e o detalhe da linha já
   estão ali; uma segunda tela repetiria tudo isso para mostrar as mesmas linhas.
2. **Sempre as cinco categorias, sempre na mesma ordem** (a régua das cores: o que
   custa dinheiro primeiro, tarifa por último), com a quantidade e o valor em
   aberto. Categoria sem linha fica apagada: num relatório, o zero também informa.
3. **Drill-down:** clicar numa categoria filtra a tabela nela; a linha abre o
   diálogo e o detalhe. Clicar de novo volta ao "Só revisão", que é o que as cinco
   juntam.
4. **A categoria vai para a URL** (`?status=`), com `history.replaceState`: o Next
   sincroniza o `useSearchParams` sem remontar a página nem buscar as linhas de
   novo. Voltar do detalhe de uma linha reabre o mesmo recorte, e o link pode ser
   compartilhado. Status que não é uma das cinco divergências é ignorado.
5. **O CSV passa a sair filtrado pelo backend** quando há uma categoria escolhida:
   o arquivo bate com a tela e ganha a categoria no nome. A rota do servidor
   confere o `status` contra as cinco antes de repassá-lo (400 se não for uma
   delas). O "Só revisão" continua exportando todas as linhas, com o aviso no
   botão, porque o backend filtra um status por vez.

## O que ficou de fora

- Links do hub (Visão geral, Fechamentos, assistente) direto para a categoria:
  hoje "Revisar" abre o primeiro caso do grupo. Troca pequena, se o uso pedir.
- Separar "sem correspondência" pelo lado que falta no relatório: o selo de cada
  linha já diz qual é.
