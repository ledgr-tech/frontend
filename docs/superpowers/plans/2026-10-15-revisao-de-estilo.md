# Revisão de estilo das telas (15/10/2026)

Origem: a revisão feita no canvas do Claude Design "Ledgr · revisão de estilo das telas"
(https://claude.ai/artifact/G5yRpdZ6FKWZ8vTcqhz6tY), com as propostas desenhadas lá e a lista da
revisão na nota laranja. Este plano aplica o que depende só do front, num branch
(`feat/revisao-estilo`), antes da release para a `main`.

## Entra

1. **Dívidas do guia v3** (`app/globals.css`, `app/layout.tsx`, `public/`)
   - barra superior opaca (sem `backdrop-filter`);
   - confirmação de salvo das Configurações (`.cfg-feito`) fora do dourado;
   - `--color-erro` na rampa da terracota;
   - favicon do Ledgr (arquivos de `public/favicon_io`) no lugar do padrão do Next;
   - comentário do `.app-shell` com os seis usos do dourado.
2. **Coluna Conferida**: cabeçalho em texto ("Conferida"), coluna mais larga, dica no `title`.
3. **Balão da comparação com os dois lados**: o lançamento do outro lado achado pela mesma regra
   do backend (`app/services/ia/contexto.py`): valor diverge = mesma data, valor diferente; data
   diverge = mesmo valor, outra data; sem os já pareados; o mais próximo. Quando o backend mandar
   o candidato e a explicação na lista (combinado em 15/10), o cartão passa a usar os dele.
4. **Detalhe da divergência**
   - match em cor neutra (valor e Δ), tipo "Crédito"/"Débito", sem "Identificador", texto do match
     em português ("Bateu com 1 dia de diferença…");
   - painel lateral sobre a comparação (rota interceptada), com anterior/próxima e Esc; a URL e a
     página inteira continuam.
5. **Conciliações** como no quadro "Proposta · Conciliações": agrupada por mês, uma situação por
   linha, faixa "Continue de onde parou", filtros Pedem decisão / Sem pendência / Mês fechado /
   Todas, linha inteira clicável.
6. **Visão geral pelo mês aberto**: o número do topo, "Pede sua atenção" e o atalho de Fechamentos
   passam a olhar todas as conciliações do mês aberto, não só a última.
7. **Extratos**: seleção neutra (sem verde), sem o UUID no painel, "Conciliar" no arquivo não
   conciliado.

## Fica de fora (depende de outra coisa)

- Explicação da IA no balão e no detalhe: o backend gera na conciliação (pedido de 15/10).
- Saldo final (#118), cota de conciliações e tela de upgrade, planos novos, vincular à mão,
  convites, login pelo Google, desativar conta: backend ou decisão pendente.
- Logo de adesivo em SVG no menu: falta o arquivo vetorizado no repositório.

## Verificação

`npm run test && npm run lint && npm run build`, e as telas no app local contra o backend local.
