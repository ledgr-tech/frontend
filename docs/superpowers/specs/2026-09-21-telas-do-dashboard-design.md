# Ledgr — Telas ligadas à dashboard

## Contexto

A dashboard ficou pronta com três CTAs sem destino, porque as telas não existiam:
"Ver o caso" (detalhe da divergência), "Criar regra" e "Ver histórico". Este spec
cobre essas três, do bloco correspondente em `v2- informações simples/Ledgr.dc.html`:

| Tela | Rota | Linha no export |
|---|---|---|
| Detalhe da divergência | `/conciliacoes/[id]/[linha]` | 1114 |
| Regras aprendidas | `/regras` | 1944 |
| Histórico de conciliações | `/historico` | 1636 |

## Recorte

O export tem 18 telas no app. Foram escolhidas estas três porque são exatamente os
destinos que a dashboard já tentava linkar — não o menu inteiro, nem o resto do
MVP. As outras 12 (arquivo/galeria, folha a folha, fechamento, erro de importação,
mapeamento de colunas, configurações, equipe, integrações, avisos, assinatura,
auditoria, impressão) ficam para branches próprias.

O menu do app segue o do protótipo (Ledgr / Dashboard / Sair). O design tem um de
cinco itens com busca e avisos, mas três dos cinco destinos ainda não existem —
reescrever agora só trocaria CTA morto por item de menu morto.

## Decisões (21/09/2026)

1. **`Nivel` saiu de `dashboard/resumo.ts` para `lib/mock-data.ts`.** O nível de
   atenção é atributo do dado, não da tela, e agora três telas o consomem. Uma
   `lib/` não deve importar de `app/`.

2. **"Aceitar valor do banco" muda o dado de verdade.** No export o botão só volta
   para a dashboard — é protótipo estático. Aqui `aceitarValorDoBanco()` copia o
   valor do banco para o lado do sistema, marca a linha como batida e registra o
   evento no histórico. Sem isso o botão principal da tela seria decorativo, e os
   números da dashboard não acompanhariam a decisão. Verificado de ponta a ponta:
   25,0% → 50,0% e R$ 6.366 → R$ 6.330 depois de um clique.

3. **Os campos do detalhe são opcionais na `LinhaComparacao`.** `camposBanco`,
   `camposSistema`, `cronico` e `causa` só existem para a divergência que o design
   descreve por inteiro (`lc-2`, o boleto da Aço Norte). As outras linhas renderizam
   a mesma tela sem esses blocos, em vez de inventarmos documento e conta contábil
   para lançamento que o design não detalhou.

4. **O gráfico do histórico lê a mesma lista da tabela.** O export tinha dois
   arrays (`histMeses` e `histBarras`) e eles já estavam fora de sincronia:
   setembro aparecia com `taxa: '96,3%'` mas `v: 98.2`, ou seja, a barra mais alta
   das seis com o rótulo dizendo que era a terceira. O "subiu 6,4 pontos desde
   abril" vinha do mesmo 98,2. Aqui há uma lista só (`HISTORICO_MESES`), a altura
   da barra sai da taxa real e o ganho é calculado: **4,5 pontos**, não 6,4. Barra
   que não corresponde ao próprio rótulo é gráfico enganoso, não estilo.

5. **Botões sem tela ficam de fora.** Nas regras, o design tem "Ajustar tolerância
   geral" (→ configurações) e "Ver aplicações" (→ auditoria); no histórico,
   "Exportar histórico", que no próprio export não tem `onClick`. Nenhum foi
   renderizado.

6. **O diálogo da conciliação ganhou "Abrir detalhe".** O diálogo de linha em
   `/conciliacoes/[id]` foi inventado para o protótipo; o design resolve isso em
   tela cheia. Os dois mostram a mesma linha, então o diálogo ganhou só um link
   para a tela nova. Quando ficar claro que a tela basta, o diálogo pode sair.

7. **"Revisar agora" e "Ver o caso" apontam para a primeira divergência em aberto**,
   não para a lista da conciliação. O kicker numera o item entre as linhas em
   aberto ("item 01 de 3"), não entre todas — é a contagem que o design usa.

8. **Δ formatado como número, sem símbolo.** É o que o design mostra, e evita
   depender do espaço não-quebrável que o formato de moeda do pt-BR insere entre
   "R$" e o valor — foi exatamente o que quebrou o teste na primeira tentativa.

9. **Dois mascotes novos** (`mascote-lendo`, `mascote-dinheiro`) vieram do
   `assets/` do export, comprimidos de 509KB/782KB para 97KB/145KB, na faixa dos
   que já estavam em `public/mascotes/`.

## Verificado no navegador

- **Detalhe:** os dois extratos lado a lado, Δ 36,00, os quatro campos de cada
  lado, causa + explicação, os três meses crônicos com a diferença calculada por
  mês, e o histórico com a coluna Origem.
- **Regras:** 2 ativas · 3 sugeridas; desativar e criar movem a regra entre as
  listas e persistem.
- **Histórico:** 96,3% em setembro, "subiu 4,5 pontos desde abril", seis barras
  (48/65/84/102/108/97px — setembro menor que agosto, acompanhando a taxa).
- **Sem rolagem lateral** em 320, 375 e 768px nas quatro rotas.
