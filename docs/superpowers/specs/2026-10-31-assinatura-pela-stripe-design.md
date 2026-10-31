# Assinatura pela Stripe (#230, #231, #232)

Data: 31/10/2026 · Backend: ledgr-tech/backend#166 (parte 1) e #167, PR #180 (`feat/166-167-stripe-checkout-webhook`, aberto; ADR-026 no ledgr-docs) · Fecha: frontend#230, o critério que faltava da #231 (assinar ao fim do teste) e o terceiro da #232 (valores dos planos). Fica para o PR 2 do backend: cancelar, trocar de plano, trocar o cartão e as faturas.

## Objetivo

O administrador assina um plano pelo cartão, na tela Assinatura, com o período que escolher, e volta da Stripe para uma tela que espera a confirmação do backend. O teste de 14 dias leva à assinatura, e a conta que deixou de pagar ou encerrou a assinatura é tratada como o teste encerrado. Com a cobrança desligada, nada fica pior do que hoje.

Fora: cancelar, trocar de plano ou de cartão, faturas reais (PR 2 do backend); cupom e painel de pagamentos (#169/#236); a escolha guiada por conciliações (#167, espera os preços); a landing lendo os preços.

## O que o backend dá (lido no PR #180)

Tudo atrás de `STRIPE_HABILITADO`, desligada em produção.

- `POST /assinatura/checkout` `{ plano: "essencial" | "padrao" | "avancado", periodo: "mensal" | "trimestral" | "semestral" | "anual" }`, só admin (403), conta inteira (ignora `X-Ledgr-Empresa`), rate limit por conta (429). Responde `{ url }` da Checkout Session. 409 "Sua conta já tem uma assinatura..." com assinatura `active`, `trialing`, `past_due` ou `incomplete`; 503 com a cobrança desligada, sem a chave, sem o preço no catálogo ou sem `FRONTEND_URL`; 422 fora das listas. Cliques repetidos em 10 minutos devolvem a mesma sessão.
- Volta da Stripe: `{FRONTEND_URL}/assinatura?checkout=sucesso` e `?checkout=cancelado`. A rota antiga `/assinatura` já redireciona para `/e/<empresa>/assinatura` mantendo a query (`destinoDaUrlAntiga`).
- **Teste e cobrança:** quem assina no teste só paga no fim dele (`trial_end` = `teste_termina_em`). A Stripe exige o `trial_end` 48 horas no futuro: faltando menos, ou com o teste encerrado, **a cobrança é na hora** e o que sobrava do teste se perde. O front avisa antes.
- `GET /assinatura/precos`, pública (sem JWT), rate limit por IP, cache de 10 minutos: lista de `{ plano, periodo, valor_centavos, moeda, intervalo, quantidade_de_intervalos, nome_do_produto }`, ordenada por plano e período; chave ausente no catálogo some. 503 desligada, 502 com a Stripe fora e nada em cache. Os valores atuais são **provisórios** (`scripts/stripe_precos.json`).
- `GET /me`: `situacao` ganha `pagamento_pendente` (`past_due`, o acesso segue) e `assinatura_encerrada` (`canceled`, `unpaid`, `incomplete_expired`, `paused`; barra nova conciliação como o teste encerrado). `plano` é o da assinatura quando existe. Bloco novo `assinatura`: `null` antes de assinar; senão `{ status, plano, periodo, periodo_atual_fim, cancelar_no_fim_do_periodo }`. `limites.conciliacoes` `{ usadas, maximo }` (a franquia do mês civil de São Paulo, todas as empresas). `teste_termina_em` é data e hora em UTC (já era antes do #180).
- O cadastro começa o teste (`situacao: "teste"`, `plano: null`). `POST /empresa/plano` fica obsoleto: só grava a preferência, sem iniciar o teste, e responde 409 com assinatura viva.

## Decisões

- **Assinar é na tela Assinatura**, dentro do app. O bloqueio da Nova conciliação e o topo levam para lá. A `/plano` fica só para a conta `sem_plano` do backend antigo (a produção de hoje escolhe o plano do teste por ela) e redireciona as outras situações para a Assinatura; sai junto com o `POST /empresa/plano`.
- **Períodos:** Mensal e Anual em destaque, como pílulas segmentadas; "Ver outros períodos" acrescenta Trimestral e Semestral. O desconto é calculado dos preços da Stripe, contra o mensal do mesmo plano vezes os meses do período, e só aparece acima de zero. Nenhum preço é escrito no front para a cobrança.
- **Cobrança desligada** (preços com 503, 404, 502 ou falha): os cartões mostram o preço mensal de `lib/planos`, sem seletor de período, e o Assinar vem desligado com "A assinatura pelo cartão ainda não está no ar."
- **Só o admin assina:** gestor e analista veem os planos com o botão desligado e "Só o administrador da conta assina." A conta de demonstração é recusada antes do backend.
- **O front nunca libera acesso:** a situação só muda pelo `/me`, que só muda pelo webhook.
- O medidor guiado da `/plano` não vem para a Assinatura (muda com a #167).

## A tela

`page.tsx` vira Server Component: lê os preços por `carregarPrecos` e entrega a `PainelDaAssinatura` (cliente). O cabeçalho diz a situação no contexto:

| situação | contexto | corpo |
|---|---|---|
| `teste` | "teste grátis · faltam N dias" | planos para assinar |
| `teste_encerrado` | "teste grátis encerrado" | planos, com "O que você já fez continua aqui" |
| `assinatura_encerrada` | "assinatura encerrada" | idem |
| `ativo` com `cobranca` | "plano Padrão · mensal · renova em 14/12" (com `cancelaNoFim`, "termina em 14/12") | o plano atual marcado ("Plano atual"), os outros sem Assinar (trocar é do PR 2) |
| `pagamento_pendente` | "pagamento pendente" | aviso: "O último pagamento não passou. A Stripe vai tentar de novo nos próximos dias; para trocar o cartão, fale com a gente." e o plano atual |
| `ativo` sem `cobranca` (piloto ativado à mão) ou `/me` sem situação | como hoje | a tela de demonstração inteira |

Cada cartão mostra o preço do período, o equivalente por mês fora do mensal ("R$ 126,67 por mês") e o desconto ("15% a menos que o mensal"). O Volume segue "Fale com a gente".

**Assinar (admin, cobrança ligada):**
- Com `testeTerminaEm` mais de 48 horas à frente, a linha sob o botão diz "Você só paga em 14/11, quando o teste acaba."
- Com menos de 48 horas, ou com a situação `teste_encerrado`/`assinatura_encerrada`, o primeiro clique não chama nada: abre na própria linha "A cobrança é feita agora. Os dias de teste que sobraram não ficam para depois." e o botão vira "Assinar e pagar agora".
- O clique chama `iniciarCheckout(plano, periodo)`; uma `ref` trava antes do primeiro `await` (duplo clique sai uma vez); o botão diz "Abrindo a Stripe…" e o navegador vai para a `url` (`window.location.assign`), conferida como `https://checkout.stripe.com/` ou, fora de produção, mesma origem (o backend-fake).
- Erros na linha do cartão: 409 com o texto do backend e `router.refresh()`; 503 "A assinatura não está disponível agora. Tente de novo mais tarde."; 429 "Muitas tentativas. Tente de novo em N minutos." (`Retry-After`); 403 "Só o administrador da conta assina." e relê; 422 "Esse plano não está disponível."; 401 "Sua sessão expirou. Entre de novo para continuar."; rede fora, "Não foi possível falar com o servidor.".

**Volta da Stripe:**
- `?checkout=sucesso`: aviso `role="status"` "Confirmando seu pagamento…"; `router.refresh()` a cada 3 segundos, até 30 segundos, até a situação ser `ativo` ou `pagamento_pendente`. Confirmado: "Assinatura confirmada: plano Padrão, mensal." e a query sai da URL (`replaceState`). Sem confirmação em 30 segundos: "A Stripe ainda não confirmou o pagamento. Isso pode levar alguns minutos; esta tela mostra quando confirmar."
- `?checkout=cancelado`: "Você voltou sem assinar. Nada foi cobrado." e a query sai da URL.
- Cartão recusado não volta: a Stripe trata na página dela. A recusa numa renovação chega como `pagamento_pendente` ou `assinatura_encerrada`.

Continuam desligados, com o aviso de demonstração: "Trocar forma de pagamento", "Cancelar" e as faturas (só para o piloto).

## O resto do app

- **Topo:** `teste` mostra os dias (passa a funcionar em produção com a correção do adaptador); `pagamento_pendente` ganha a etiqueta "Pagamento pendente"; todos levam à Assinatura. `teste_encerrado` e `assinatura_encerrada` também levam à Assinatura, não à `/plano`.
- **Bloqueio da Nova conciliação** (`PlanosBloqueados`): vale para `teste_encerrado` e `assinatura_encerrada` (e o 402); o título acompanha ("Seu teste de 14 dias acabou." ou "Sua assinatura foi encerrada.") e os botões levam à Assinatura. `pagamento_pendente` não bloqueia.
- **Franquia:** `limites.conciliacoes` entra em `adaptarLimites` e aparece na Assinatura como `FaixaDoPlano` ("3 de 20 conciliações este mês"). Sem o campo, nada.
- **Central de ajuda:** a página Assinatura ganha "Assinar um plano" e "Período e desconto", escritos e guardados atrás de um comentário para publicar no dia em que a Stripe ligar, como os outros textos que dependem de flag.

## Arquitetura

- `lib/assinatura.ts`: `adaptarAssinatura` aceita `teste_termina_em` em data e hora ISO (convertido para o dia em São Paulo) além de `AAAA-MM-DD`; as duas situações novas; `cobranca: { status, plano, periodo, periodoAtualFim, cancelaNoFim } | null` do bloco `assinatura`. `adaptarPrecos` (lista do backend → por plano e período, com valor formatado, por mês e desconto). `bloqueiaConciliacao(situacao)` e `cobrancaImediata(assinatura, agora)` (as 48 horas), funções puras.
- `lib/limites.ts`: `conciliacoes`.
- `app/(app)/e/[empresa]/assinatura/acoes.ts`: `carregarPrecos()` (`publica: true`) e `iniciarCheckout(plano, periodo)` (valida as duas listas, recusa a demonstração e quem não é admin antes do backend, traduz os erros, confere a `url`).
- `assinatura/page.tsx` (servidor), `assinatura/painel.tsx` (cliente: estados, período, checkout, volta), `assinatura/periodo.tsx` (as pílulas). `dados.ts` fica só para o piloto.
- `(auth)/plano/page.tsx`: só `sem_plano`; o resto redireciona para a Assinatura.
- `barra-superior.tsx` (o aviso do teste) e `conciliacoes/nova/planos-bloqueados.tsx`: destinos e textos novos.
- `scripts/backend-fake.mjs`: `GET /assinatura/precos` (os provisórios do PR), `POST /assinatura/checkout` (admin, 409 com assinatura viva; `url` = `/assinatura?checkout=sucesso` do próprio front; a conta vira `ativo` com o bloco `assinatura` 5 segundos depois), `teste_termina_em` em data e hora e `limites.conciliacoes`.
- CSS em `app/globals.css`, reaproveitando as pílulas de Empresas e as classes `ass-*`. `CLAUDE.md`: o bullet do primeiro uso e o "Still mocked" deixam de dizer que a assinatura é só mock.

## Testes

- `lib/assinatura.test.ts`: data e hora ISO viram o dia de São Paulo (inclusive perto da meia-noite UTC); situações novas; `cobranca`; `adaptarPrecos` com desconto, por mês e período ausente; `cobrancaImediata` de um lado e do outro das 48 horas; `bloqueiaConciliacao`.
- `assinatura/acoes.test.ts`: corpo enviado; plano ou período fora da lista recusados; demonstração e não admin recusados antes do backend; cada status de erro; `url` fora do permitido recusada.
- `assinatura/page.test.tsx`: cada linha da tabela de situações; seletor (mensal e anual, "Ver outros períodos", preço, por mês e desconto mudam juntos); sem preços, botão desligado e sem seletor; gestor e analista desligados; o aviso das 48 horas; duplo clique sai uma vez; `sucesso` confirmando e expirando; `cancelado`.
- Topo, `/plano` e bloqueio: os destinos e textos novos; `pagamento_pendente` não bloqueia.
- No navegador, com o backend-fake: assinar de ponta a ponta (teste → Assinatura → "Stripe" → confirmando → ativo).
