# Ledgr — Dashboard

## Contexto

A `/dashboard` do protótipo navegável (spec de 01/09) era o mínimo para o fluxo
click-through: cabeçalho, estado vazio e uma tabela de conciliações. O design
aprovado (`v2- informações simples/Ledgr.dc.html`, bloco `<!-- DASHBOARD -->`,
linha 659) tem quatro blocos que não existiam ainda:

- três colunas de resumo da competência;
- "O que o Ledgr sugere" — leituras de padrão entre meses;
- um card do mascote apontando por onde começar a revisão;
- a tabela de lançamentos com status por nível de atenção.

## Decisões (21/09/2026)

1. **Números do resumo são derivados, não copiados.** O design mostra 4.218
   lançamentos e 96,3% de match, que vêm do dataset dele. Copiar isso deixaria o
   cabeçalho brigando com a tabela logo abaixo, que mostra os lançamentos reais do
   mock. `resumo.ts` calcula tudo a partir das `linhas` das conciliações no
   `localStorage`, então cabeçalho e tabela nunca se contradizem.
   - **Valor em divergência:** diferença entre os dois lados quando ambos
     existem; o valor inteiro quando a linha só existe num extrato.
   - **Consequência aceita:** com as 5 linhas de `linhasMock()` o painel mostra
     "5 · 40,0% · R$ 6.366" em vez dos números do design. É dado de demo pobre,
     não erro de cálculo — enriquecer `linhasMock()` com os 11 lançamentos do
     design é mudança separada.
2. **Status: rótulo e nível vêm do design** (`NIVEL_STATUS`/`NIVEIS`). Os quatro
   `StatusLinha` do mock mapeiam para os rótulos correspondentes; os outros três
   do design (data divergente, possível duplicidade, match com tolerância) entram
   quando a conciliação real souber calculá-los.
3. **Sugestões são copy fixa.** São comparações entre competências e o mock tem
   uma só. Só a primeira tem CTA — "Criar regra" e "Ver histórico" apontariam
   para `/regras` e `/historico`, que não existem nesta branch, e botão que não
   leva a lugar nenhum é pior que botão ausente.
4. **Card do mascote aparece só quando há linhas sem correspondente**, já que o
   texto dele é sobre elas.
5. **"Conciliações recentes" passa a listar lançamentos**, como no design. A
   lista de conciliações não desapareceu: virou "Conciliações anteriores", que só
   aparece quando existe mais de uma. O design pensa numa competência só; o mock
   cria uma conciliação por upload, e as antigas precisam continuar alcançáveis.
6. **Selos** viraram `.selo` + `.selo-{leve,medio,forte}` em `globals.css`, com as
   cores dos `NIVEIS` do design. Ficaram fora do `.tag` existente porque `.tag`
   tem só duas variantes e outro peso tipográfico.
7. **Resumo reaproveita `.grade-colunas`** (3 colunas com filete, 1 por linha até
   760px), a mesma classe das grades da landing.
8. **Tabela de 5 colunas rola na horizontal** dentro do próprio container abaixo
   de 680px, em vez de espremer a descrição. Até 480px o contador
   "3 observações" sai, porque brigava com o título em duas linhas.

## Fora desta branch

- `/conciliacoes/[id]/detalhe`, `/regras`, `/historico` — destinos dos CTAs II e III.
- Enriquecer `linhasMock()` para os números do resumo ficarem parecidos com o design.
- "atualizado há 12 minutos" no cabeçalho: exige timestamp real de processamento.

## Verificado no navegador

- **Estado vazio:** mascote sentado, sem blocos de resumo/sugestões.
- **Estado povoado:** 5 · 40,0% · R$ 6.366 · 3 lançamentos; card "Comece pelas 2
  sem correspondente · R$ 6.330 dos R$ 6.366"; cinco linhas com os quatro selos.
- **Sem rolagem lateral:** 320x568, 375x812 e 1280x900. A tabela rola dentro do
  container; o resumo vira uma coluna por linha.
