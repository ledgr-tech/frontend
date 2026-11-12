# Ajustes da cobrança (#295, #296, #298, #299)

Bugs achados na homologação da Stripe de 03/11. Um PR só, numa worktree `.worktrees/fix-ajustes-cobranca`, branch `fix/ajustes-cobranca` a partir da `develop`. Fora daqui: #297 (espera o backend definir as franquias) e #300 (comemoração, feature à parte).

Antes de fechar: `npm run test && npm run lint && npm run build`.

## 1. #299 — aviso de cobrança imediata (menor, começar por ele)

- `app/(app)/e/[empresa]/assinatura/painel.tsx:182` — `AVISO_IMEDIATO` vira duas frases:
  - teste em andamento (`situacao === "teste"`) com menos de 48 h: o texto atual;
  - qualquer outra situação (`teste_encerrado`, `assinatura_encerrada`, sem `fimDoTeste`): só "A cobrança é feita agora."
- A escolha fica no painel, em `:226`, pela `assinatura.situacao`; `cobrancaImediata` (`lib/assinatura.ts:76`) não muda.
- Teste no `painel.test.tsx`: as três situações (teste < 48 h, teste encerrado, assinatura encerrada).

## 2. #298 — renovação sem o ano

- `lib/assinatura.ts:83` `formatarDiaCurto` → ganha uma irmã (ou um parâmetro `agora`) que devolve `DD/MM/AAAA` quando o ano da data não é o ano corrente em São Paulo (`HOJE_EM_SP` já existe no arquivo).
- Usar em `painel.tsx:37` (o "renova em" e o "termina em" saem da mesma linha, então os dois ficam cobertos).
- O "Você só paga em" (`:228`) é do teste de 14 dias, fica no ano corrente quase sempre; usar a mesma função por coerência (cobre a virada de dezembro).
- Teste em `lib/assinatura.test.ts`: data no ano corrente → `03/11`; no ano seguinte → `03/11/2027`; virada 20/12 → 03/01.
- Decisão tomada: regra pelo ano, não pelo período (a issue aceita as duas; a do ano cobre o trimestral que vira o ano).

## 3. #295 — título do bloqueio pela franquia

- `app/(app)/e/[empresa]/conciliacoes/nova/planos-bloqueados.tsx`: hoje o título cai em "Seu teste de 14 dias acabou." sempre que a situação não está em `TITULOS`, inclusive `teste` com o 402 da franquia e sem situação nenhuma.
- Regra nova do título:
  - `teste_encerrado` → "Seu teste de 14 dias acabou." (o atual);
  - `assinatura_encerrada` → o atual;
  - qualquer outra situação **com `motivo`** (o 402) → "Sua conta chegou ao limite de conciliações deste mês.", e abaixo do texto do backend uma linha: "A franquia recomeça no dia 1º. Para conciliar antes, troque de plano.";
  - sem situação e sem motivo não acontece (a página só mostra o bloqueio com um dos dois); manter o título do teste como fallback.
- Tirar `ativo`/`pagamento_pendente` de `TITULOS`, que passam a cair na regra do 402.
- Teste novo `planos-bloqueados.test.tsx` (ou no `nova/page.test.tsx`, que já monta o 402 em `:181`): teste + 402, teste encerrado, assinatura encerrada.

## 4. #296 — preços da tela de bloqueio

- Hoje `planos-bloqueados.tsx` lista `planosDoTeste()` com `plano.preco` de `lib/planos` (R$ 49,90…), e a Assinatura mostra os da Stripe.
- `nova/page.tsx` é client: ao entrar no bloqueio, chamar a Server Action `carregarPrecos` (`assinatura/acoes.ts:21`) num `useEffect` e passar `precos` para `PlanosBloqueados`.
- No cartão: `precos.find(p => p.plano === id && p.periodo === "mensal")?.valor` + "/mês" (mesma busca do `doPeriodo` do painel, `painel.tsx:62`). Enquanto carrega, ou com `precos === null`, **sem preço**: só nome, limite e o botão.
- "Assinar o X" → `/assinatura?plano=<id>` via `LinkDoApp`. Na Assinatura, ler `plano` com `useSearchParams` e marcar/rolar até o cartão daquele plano (o `plano={plano.id}` de `painel.tsx:138` já identifica o cartão).
- Testes: bloqueio com preços da Stripe mostra o valor dela; sem preços não mostra nenhum `R$`; o link leva `?plano=`.

### Decidido com o rklein (03/11)

- Opção (a): sem os preços da Stripe, nem a Assinatura nem o bloqueio mostram valor; `lib/planos` perde o campo `preco` (fica nome, faixa e o resto).
- A landing fica fora: os preços dela ficaram numa constante em `regua-que-mede.tsx` (`ponytail:`), e a migração para `GET /assinatura/precos` vira issue nova.
- A Assinatura de demonstração (piloto e backend antigo) é mock: os preços dela foram para `dados.ts` (`PRECO_DE_DEMONSTRACAO`), como as faturas.
- A `/plano` (obsoleta) deixou de mostrar preço.
- "Assinar o X" vai a `/assinatura#plano-<id>`: o cartão tem esse `id` e o `:target` o destaca como o plano atual, sem JS.
- #298: o ano aparece sempre que a data não cai no ano corrente em São Paulo, também no "termina em".

## Ordem dos commits

1. `fix(assinatura): ano na renovação e aviso de cobrança sem dias de teste` (#298, #299)
2. `fix(cobranca): bloqueio pela franquia e só os preços da Stripe` (#295, #296)

PR para `develop` com `Closes #295, #296, #298, #299`.
