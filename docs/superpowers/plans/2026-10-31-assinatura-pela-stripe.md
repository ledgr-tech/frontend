# Assinatura pela Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin assina um plano pelo cartão na tela Assinatura (checkout da Stripe, backend PR #180), e o app trata o teste, o pagamento pendente e a assinatura encerrada pelo `GET /me`.

**Architecture:** Regras puras em `lib/assinatura.ts` e `lib/limites.ts`; duas Server Actions em `assinatura/acoes.ts` (preços públicos e checkout); a página da Assinatura vira Server Component que entrega os preços a um painel cliente. O backend-fake imita as rotas do PR #180 para o fluxo rodar local.

**Tech Stack:** Next.js (App Router, a versão de `node_modules/next`, ler `node_modules/next/dist/docs/` antes de API nova), React, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-31-assinatura-pela-stripe-design.md`

## Global Constraints

- Nenhum `fetch` do navegador: tudo pelo `lib/backend.ts` em Server Action (`chamarBackend`, `publica: true` para `/assinatura/precos`).
- Links, pushes e redirects do app só por `LinkDoApp`, `useRoteador()` e `redirecionarNoApp()` (`lib/rotas.guarda.test.ts`). Endereços sem empresa (`/assinatura`, `/plano`) passam pelo redirect de URL antiga.
- Nenhum preço da cobrança escrito no front: os valores vêm de `/assinatura/precos`; `lib/planos` só no fallback com a cobrança desligada.
- O front nunca libera acesso: a situação só muda pelo `/me`.
- Textos em pt-BR, sem travessão entre orações (#75). Classes de `app/globals.css`, nada de estilo inventado para o que já existe.
- Antes de cada commit: `npm run test && npm run lint && npm run build`.
- Períodos: `mensal` (1 mês), `trimestral` (3), `semestral` (6), `anual` (12). Planos: `essencial`, `padrao`, `avancado`.

## Review Focus

1. `teste_termina_em` perto da meia-noite UTC (`2026-11-14T02:30:00Z` é dia 13 em São Paulo): o dia mostrado e o "faltam N dias" usam o dia de SP. Teste na Task 1.
2. `/assinatura/precos` com um período faltando para um plano (chave ausente some): o cartão desse plano mostra "Indisponível neste período" com Assinar desligado, sem quebrar os outros. Teste na Task 4.
3. Voltar da Stripe com `?checkout=sucesso` numa conta que já era `ativo` (recarregou a página): confirma de imediato, sem esperar 30 s. Teste na Task 6.
4. A `url` do checkout fora de `https://checkout.stripe.com/` (ou do caminho do fake fora de produção): a ação recusa e não redireciona. Teste na Task 3.
5. `situacao` desconhecida ou `assinatura` malformado no `/me` (backend mais novo): `adaptarAssinatura` não quebra; situação desconhecida segue `null` (nada bloqueia), `cobranca` malformada vira `null`. Teste na Task 1.

---

### Task 1: Regras da assinatura em `lib/assinatura.ts`

**Files:**
- Modify: `lib/assinatura.ts`
- Test: `lib/assinatura.test.ts`

**Interfaces:**
- Produces:
  - `type Periodo = "mensal" | "trimestral" | "semestral" | "anual"`; `const PERIODOS: Periodo[]` (nessa ordem); `const MESES_DO_PERIODO: Record<Periodo, number>`.
  - `SituacaoDaConta` ganha `"pagamento_pendente" | "assinatura_encerrada"`.
  - `type Cobranca = { status: string; plano: PlanoId; periodo: Periodo; periodoAtualFim: string | null; cancelaNoFim: boolean }` (`periodoAtualFim` = dia em SP, `AAAA-MM-DD`).
  - `type Assinatura = { situacao; plano; testeTerminaEm: string | null /* dia em SP */; fimDoTeste: string | null /* instante ISO */; cobranca: Cobranca | null }`.
  - `diaEmSaoPaulo(iso: string): string | null` (`AAAA-MM-DD` passa como está; data e hora ISO vira o dia em SP; outro texto, null).
  - `bloqueiaConciliacao(situacao: SituacaoDaConta): boolean` (true para `teste_encerrado` e `assinatura_encerrada`).
  - `cobrancaImediata(assinatura: Assinatura, agora: Date): boolean` (true fora de `teste`, sem `fimDoTeste`, ou com menos de 48 h até ele).
  - `formatarDiaCurto(dia: string): string` (`"2026-12-14"` → `"14/12"`).

- [ ] **Step 1: Write the failing tests** em `lib/assinatura.test.ts`:
  - `adaptarAssinatura({ situacao: "teste", plano: null, teste_termina_em: "2026-11-14T13:00:00Z" })` → `testeTerminaEm: "2026-11-14"`, `fimDoTeste: "2026-11-14T13:00:00Z"`, `cobranca: null`.
  - `"2026-11-14T02:30:00Z"` → `testeTerminaEm: "2026-11-13"`.
  - `"2026-11-14"` (o formato antigo) → `testeTerminaEm: "2026-11-14"`, `fimDoTeste: "2026-11-14T00:00:00-03:00"`.
  - `situacao: "pagamento_pendente"` e `"assinatura_encerrada"` são aceitas; `situacao: "outra"` → `null`.
  - `assinatura: { status: "active", plano: "padrao", periodo: "anual", periodo_atual_fim: "2027-10-31T15:00:00Z", cancelar_no_fim_do_periodo: false }` → `cobranca: { status: "active", plano: "padrao", periodo: "anual", periodoAtualFim: "2027-10-31", cancelaNoFim: false }`; com `periodo: "bienal"` ou `plano: "volume"` → `cobranca: null`.
  - `bloqueiaConciliacao`: true só para `teste_encerrado` e `assinatura_encerrada`.
  - `cobrancaImediata`: `teste` com fim em 49 h → false; em 47 h → true; `teste_encerrado` → true; `teste` com `fimDoTeste: null` → true.
  - `formatarDiaCurto("2026-12-14")` → `"14/12"`.

- [ ] **Step 2: Run** `npx vitest run lib/assinatura.test.ts` — Expected: FAIL (funções e campos não existem).

- [ ] **Step 3: Implement** em `lib/assinatura.ts`. `diaEmSaoPaulo` reaproveita o `HOJE_EM_SP` que já existe. `diasRestantes` passa a receber o dia já convertido (sem mudar a assinatura). O dia `AAAA-MM-DD` sozinho vira `fimDoTeste` à meia-noite de SP (`-03:00`, São Paulo não tem horário de verão desde 2019).

- [ ] **Step 4: Run** `npx vitest run lib/assinatura.test.ts` — Expected: PASS. Rodar também `npx vitest run 'app/(app)/e/[empresa]/barra-superior.test.tsx' 'app/(app)/e/[empresa]/assinatura'` — Expected: PASS (o formato antigo continua aceito).

- [ ] **Step 5: Commit** `fix(assinatura): fim do teste em data e hora, situações e cobrança do /me (#230)`.

### Task 2: Preços e franquia de conciliações

**Files:**
- Modify: `lib/assinatura.ts`, `lib/limites.ts`
- Test: `lib/assinatura.test.ts`, `lib/limites.test.ts`

**Interfaces:**
- Consumes: `Periodo`, `MESES_DO_PERIODO`, `PlanoId` (Task 1).
- Produces:
  - `type PrecoDoPlano = { plano: PlanoId; periodo: Periodo; centavos: number; valor: string /* "R$ 1.520,00" */; porMes: string | null /* null no mensal */; desconto: number | null /* % inteiro, null se ≤ 0 ou sem mensal */ }`.
  - `adaptarPrecos(bruto: unknown): PrecoDoPlano[] | null` (null se não for lista ou sem nenhum item válido; item com plano, período ou `valor_centavos` inválido sai).
  - `LimitesDaConta` ganha `conciliacoes: Limite | null` (lido de `limites.conciliacoes.usadas`); `textoDoLimite` aceita `"conciliacoes"`.

- [ ] **Step 1: Write the failing tests:**
  - `adaptarPrecos([{ plano: "essencial", periodo: "mensal", valor_centavos: 14900, moeda: "brl" }, { plano: "essencial", periodo: "anual", valor_centavos: 152000, moeda: "brl" }])` → mensal `{ valor: "R$ 149,00", porMes: null, desconto: null }`; anual `{ valor: "R$ 1.520,00", porMes: "R$ 126,67", desconto: 15 }` (152000 / (14900 × 12) = 0,850 → 15%).
  - Anual sem o mensal do mesmo plano → `desconto: null`, `porMes` ainda calculado.
  - Item `{ plano: "volume", ... }` ou `valor_centavos: -1` sai; `adaptarPrecos({})` e `adaptarPrecos([])` → `null`.
  - `adaptarLimites({ conciliacoes: { usadas: 3, maximo: 20 } })` → `conciliacoes: { usadas: 3, maximo: 20 }`; sem o campo, `conciliacoes: null` e os outros como antes.
  - `textoDoLimite("conciliacoes", { usadas: 20, maximo: 20 })` → `"O plano chegou ao limite de 20 conciliações neste mês. A franquia recomeça no dia 1º."`; `{ usadas: 19, maximo: 20 }` → `"Falta 1 conciliação para o limite do plano neste mês."`.

- [ ] **Step 2: Run** `npx vitest run lib/assinatura.test.ts lib/limites.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** Valor com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`; desconto `Math.round((1 - centavos / (mensal × meses)) × 100)`. Em `lib/limites.ts`, `PALAVRAS.conciliacoes = { um: "conciliação", varias: "conciliações", maisDe: "mais conciliações" }`, e as frases de `perto`/`no-limite`/`acima` de conciliações dizem "neste mês" (acima: `"A conta fez mais conciliações (N) do que o plano permite neste mês (M). As próximas esperam o dia 1º."`).

- [ ] **Step 4: Run** os mesmos testes — Expected: PASS.

- [ ] **Step 5: Commit** `feat(assinatura): preços por período e franquia de conciliações (#230)`.

### Task 3: Ações `carregarPrecos` e `iniciarCheckout`

**Files:**
- Create: `app/(app)/e/[empresa]/assinatura/acoes.ts`
- Test: `app/(app)/e/[empresa]/assinatura/acoes.test.ts`

**Interfaces:**
- Consumes: `adaptarPrecos`, `PrecoDoPlano`, `Periodo`, `PERIODOS` (Tasks 1-2); `Resultado`/`Falha` de `../conciliacoes/acoes`; `contaDaSessao`; `emailDaSessao`, `ehContaDeDemonstracao`, `RECUSA_DEMONSTRACAO` (padrão de `chaves-api/acoes.ts`).
- Produces:
  - `carregarPrecos(): Promise<PrecoDoPlano[] | null>` (qualquer erro → `null`).
  - `iniciarCheckout(plano: PlanoId, periodo: Periodo): Promise<Resultado<{ url: string }>>`.
  - `urlDeCheckoutValida(url: string, producao: boolean): boolean` em `lib/assinatura.ts` (aceita `https://checkout.stripe.com/...`; fora de produção, também um caminho que começa com `/assinatura?checkout=`).

- [ ] **Step 1: Write the failing tests** (mock de `@/lib/backend`, `contaDaSessao` e `emailDaSessao`, como em `chaves-api/acoes.test.ts`):
  - `carregarPrecos` chama `chamarBackend("/assinatura/precos", { publica: true })` e adapta; com `ErroBackend(503)` → `null`.
  - `iniciarCheckout("padrao", "anual")` envia `POST /assinatura/checkout` com `corpo: { plano: "padrao", periodo: "anual" }` e devolve `{ ok: true, dados: { url } }`.
  - `"volume"` ou `"bienal"` → `{ ok: false, status: 422, erro: "Esse plano não está disponível." }` sem chamar o backend.
  - Papel `gestor` → 403 "Só o administrador da conta assina." sem chamar o backend; conta de demonstração → `RECUSA_DEMONSTRACAO`.
  - Erros: 409 → `detalhe` do backend; 503 → "A assinatura não está disponível agora. Tente de novo mais tarde."; 429 com `segundosParaTentar: 120` → "Muitas tentativas. Tente de novo em 2 minutos."; 401 → "Sua sessão expirou. Entre de novo para continuar."; erro que não é `ErroBackend` → "Não foi possível falar com o servidor.".
  - Resposta com `url: "https://evil.example/x"` → `{ ok: false, status: 502, erro: "A assinatura não está disponível agora. Tente de novo mais tarde." }`.
  - `urlDeCheckoutValida("/assinatura?checkout=sucesso", true)` → false; `(…, false)` → true.

- [ ] **Step 2: Run** `npx vitest run 'app/(app)/e/[empresa]/assinatura/acoes.test.ts' lib/assinatura.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** com `"use server"`. `producao` é `process.env.NODE_ENV === "production"`. O texto do 429 usa os minutos arredondados para cima (1 minuto no singular).

- [ ] **Step 4: Run** os mesmos testes — Expected: PASS.

- [ ] **Step 5: Commit** `feat(assinatura): ações dos preços e do checkout da Stripe (#230)`.

### Task 4: Backend-fake com as rotas do PR #180

**Files:**
- Modify: `scripts/backend-fake.mjs` (está fora do git na raiz do repositório principal: copiar de `../../scripts/backend-fake.mjs` para o worktree antes de editar, e adicioná-lo ao commit; conferir com o Eduardo se ele deve entrar no repositório ou continuar local, e seguir a resposta)

**Interfaces:**
- Produces (contrato do PR #180, para as Tasks 5-8 rodarem local):
  - `GET /assinatura/precos` (sem token): os 12 preços de `scripts/stripe_precos.json` do PR (essencial 14900/42500/80500/152000, padrao 29900/85500/161500/305000, avancado 59900/171000/323000/610000), cada um `{ plano, periodo, valor_centavos, moeda: "brl", intervalo, quantidade_de_intervalos, nome_do_produto }`.
  - `POST /assinatura/checkout` `{ plano, periodo }`: 403 se não admin, 422 fora das listas, 409 com assinatura viva; senão `{ url: "/assinatura?checkout=sucesso" }`, e 5 s depois a conta vira `situacao: "ativo"` com `assinatura: { status: "active", plano, periodo, periodo_atual_fim: <hoje + meses do período, ISO>, cancelar_no_fim_do_periodo: false }`.
  - `GET /me`: `teste_termina_em` em data e hora ISO (`emDias` devolve `toISOString()`), `assinatura` (null por padrão) e `limites.conciliacoes`.
  - O cadastro (`/register`) começa em `situacao: "teste"`, `plano: null`, fim do teste em 14 dias.

- [ ] **Step 1:** Implementar as rotas. Sem teste automatizado (é um script de desenvolvimento): a verificação é manual.

- [ ] **Step 2: Verify** com o fake rodando (`preview_start` `backend-fake`): `curl -s localhost:8000/assinatura/precos | head -c 300` mostra os preços; login da conta `teste@docesabor.com.br` (senha de teste do seed) e `GET /me` traz `teste_termina_em` com hora.

- [ ] **Step 3: Commit** `chore(backend-fake): preços, checkout e assinatura do backend #180`.

### Task 5: A tela de Assinatura por situação, com o seletor de período

**Files:**
- Modify: `app/(app)/e/[empresa]/assinatura/page.tsx` (vira Server Component)
- Create: `app/(app)/e/[empresa]/assinatura/painel.tsx` (cliente: `PainelDaAssinatura`), `app/(app)/e/[empresa]/assinatura/seletor-de-periodo.tsx`
- Modify: `app/globals.css` (pílulas e linha de desconto, reaproveitando as pílulas de Empresas e `ass-*`)
- Test: `app/(app)/e/[empresa]/assinatura/page.test.tsx`

**Interfaces:**
- Consumes: `carregarPrecos` (Task 3), `PrecoDoPlano`, `Assinatura`, `formatarDiaCurto`, `fraseDoTeste`, `diasRestantes` (Tasks 1-2), `useAssinatura`, `usePapel`, `useLimites` de `../conta`, `FaixaDoPlano` de `../empresas/faixa-do-plano`.
- Produces:
  - `PainelDaAssinatura({ precos }: { precos: PrecoDoPlano[] | null })`.
  - `SeletorDePeriodo({ periodo, onMudar }: { periodo: Periodo; onMudar: (periodo: Periodo) => void })`: Mensal e Anual sempre; "Ver outros períodos" acrescenta Trimestral e Semestral (fica aberto se o escolhido for um deles).
  - Um ponto onde a Task 6 pluga o botão: cada cartão renderiza `<AssinarPlano plano={...} periodo={...} preco={...} />`, que nesta task é só o botão (ligado/desligado com o motivo) e na Task 6 ganha o clique.

- [ ] **Step 1: Write the failing tests** (render `await AssinaturaPage()` dentro de `ProvedorDaConta` com `assinatura`, `papel` e `limites`, mock de `./acoes`):
  - Uma por linha da tabela de situações da spec: o contexto do cabeçalho (`"teste grátis · faltam 9 dias"`, `"teste grátis encerrado"`, `"assinatura encerrada"`, `"plano Padrão · anual · renova em 31/10"`, com `cancelaNoFim` `"plano Padrão · anual · termina em 31/10"`, `"pagamento pendente"`) e o corpo (pendente mostra "O último pagamento não passou. A Stripe vai tentar de novo nos próximos dias; para trocar o cartão, fale com a gente."; `ativo` sem `cobranca` mostra a demonstração como hoje).
  - Seletor: começa em Mensal; Anual troca os três cartões para "R$ 1.520,00", "R$ 126,67 por mês" e "15% a menos que o mensal"; "Ver outros períodos" mostra Trimestral e Semestral.
  - Com `precos: null`: preços mensais de `lib/planos`, sem seletor, Assinar desligado e "A assinatura pelo cartão ainda não está no ar.".
  - Período faltando para um plano: esse cartão diz "Indisponível neste período" e o botão vem desligado (Review Focus 2).
  - `papel: "gestor"`: Assinar desligado com "Só o administrador da conta assina.".
  - `ativo` com `cobranca` padrao: o cartão Padrão diz "Plano atual" e os outros não têm Assinar.
  - `limites.conciliacoes { usadas: 3, maximo: 20 }`: a faixa "3 de 20 conciliações este mês".

- [ ] **Step 2: Run** `npx vitest run 'app/(app)/e/[empresa]/assinatura'` — Expected: FAIL.

- [ ] **Step 3: Implement.** `page.tsx`: `export default async function AssinaturaPage() { return <PainelDaAssinatura precos={await carregarPrecos()} /> }`. O que hoje está em `page.tsx` (demonstração, faturas, cancelar) passa para o painel e só aparece para `ativo` sem `cobranca` ou sem `/me`. O Volume continua "Fale com a gente".

- [ ] **Step 4: Run** os testes da pasta e `npx vitest run lib/rotas.guarda.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(assinatura): planos por período e situação da conta na Assinatura (#230, #232)`.

### Task 6: Assinar: o aviso das 48 horas, o checkout e a volta da Stripe

**Files:**
- Modify: `app/(app)/e/[empresa]/assinatura/painel.tsx` (`AssinarPlano` ganha o clique)
- Create: `app/(app)/e/[empresa]/assinatura/volta-da-stripe.tsx`
- Test: `app/(app)/e/[empresa]/assinatura/page.test.tsx`

**Interfaces:**
- Consumes: `iniciarCheckout`, `cobrancaImediata`, `formatarDiaCurto`, `useRoteador`, `useSearchParams`, `useAssinatura`.
- Produces: `VoltaDaStripe()` (sem props; lê `?checkout`), renderizado no topo do painel.

- [ ] **Step 1: Write the failing tests** (`vi.useFakeTimers` para o polling; mock de `window.location.assign`):
  - `teste` com fim em 9 dias: sob o botão, "Você só paga em 14/11, quando o teste acaba."; o clique chama `iniciarCheckout("padrao", "mensal")` e `location.assign` com a `url`; o botão diz "Abrindo a Stripe…".
  - Fim em 47 h: o primeiro clique não chama nada e mostra "A cobrança é feita agora. Os dias de teste que sobraram não ficam para depois." com o botão "Assinar e pagar agora"; o segundo clique chama. `teste_encerrado` também começa por esse aviso.
  - Dois cliques rápidos chamam `iniciarCheckout` uma vez.
  - Falha 409: mostra o texto na linha do cartão e chama `router.refresh()`; 503 mostra o texto da ação.
  - `?checkout=sucesso` com `situacao: "teste"`: "Confirmando seu pagamento…" (`role="status"`), `refresh()` a cada 3 s; o provedor passa a `ativo` com `cobranca` padrao mensal → "Assinatura confirmada: plano Padrão, mensal." e a URL fica sem `?checkout`. Sem mudança em 30 s: "A Stripe ainda não confirmou o pagamento. Isso pode levar alguns minutos; esta tela mostra quando confirmar." e o polling para.
  - `?checkout=sucesso` com a conta já `ativo` (Review Focus 3): confirma na hora, sem `refresh()`.
  - `?checkout=cancelado`: "Você voltou sem assinar. Nada foi cobrado." e a URL fica sem `?checkout`.

- [ ] **Step 2: Run** `npx vitest run 'app/(app)/e/[empresa]/assinatura'` — Expected: FAIL.

- [ ] **Step 3: Implement.** A trava é uma `ref` posta antes do primeiro `await`. A query sai com `window.history.replaceState` (como a aba de Empresas). O polling para ao desmontar.

- [ ] **Step 4: Run** os testes da pasta — Expected: PASS.

- [ ] **Step 5: Commit** `feat(assinatura): checkout da Stripe e volta com a confirmação do webhook (#230, #231)`.

### Task 7: Topo, `/plano`, bloqueio da nova conciliação e o layout

**Files:**
- Modify: `app/(app)/e/[empresa]/barra-superior.tsx:205-215`, `app/(auth)/plano/page.tsx`, `app/(auth)/plano/escolher-plano.tsx` (sai a prop `encerrado`), `app/(app)/e/[empresa]/conciliacoes/nova/page.tsx:214`, `app/(app)/e/[empresa]/conciliacoes/nova/planos-bloqueados.tsx`
- Test: `app/(app)/e/[empresa]/barra-superior.test.tsx`, `app/(auth)/plano/escolher-plano.test.tsx`, `app/(app)/e/[empresa]/conciliacoes/nova/page.test.tsx`

**Interfaces:**
- Consumes: `bloqueiaConciliacao`, `SituacaoDaConta` (Task 1).
- Produces: `PlanosBloqueados({ motivo, situacao }: { motivo?: string; situacao?: SituacaoDaConta })`.

- [ ] **Step 1: Write the failing tests:**
  - Topo: `teste_encerrado` → selo "Seu teste acabou · assinar um plano" com `href` `/assinatura`; `assinatura_encerrada` → "Assinatura encerrada · assinar de novo" (curta "Encerrada"), `/assinatura`; `pagamento_pendente` → "Pagamento pendente" (curta "Pagamento"), `/assinatura`, com risco; `teste` com `teste_termina_em` em data e hora mostra os dias.
  - Nova conciliação: `assinatura_encerrada` mostra "Sua assinatura foi encerrada." no lugar do envio; `pagamento_pendente` não bloqueia; os botões dos planos levam a `/assinatura`.
  - `escolher-plano.test.tsx`: o caso `encerrado` sai.

- [ ] **Step 2: Run** `npx vitest run 'app/(app)/e/[empresa]/barra-superior.test.tsx' 'app/(auth)/plano' 'app/(app)/e/[empresa]/conciliacoes/nova/page.test.tsx'` — Expected: FAIL.

- [ ] **Step 3: Implement.** `/plano` aceita só `sem_plano` (ou sem `/me`, como hoje) e redireciona as outras situações para `/assinatura`; marca com `// ponytail: some junto com o POST /empresa/plano, obsoleto desde o backend #180`. A Nova conciliação troca o `=== "teste_encerrado"` por `bloqueiaConciliacao(...)` e passa a `situacao` ao bloqueio.

- [ ] **Step 4: Run** os mesmos testes e `npx vitest run lib/rotas.guarda.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(assinatura): topo, bloqueio e /plano levam à Assinatura (#231)`.

### Task 8: Ajuda, CLAUDE.md e verificação de ponta a ponta

**Files:**
- Modify: `app/(ajuda)/ajuda/paginas.ts` (página `assinatura`), `CLAUDE.md`

- [ ] **Step 1:** Na página `assinatura` de `paginas.ts`, escrever as funções "Assinar um plano" e "Período e desconto" num bloco comentado com `// ponytail: publicar no dia em que o backend ligar STRIPE_HABILITADO (#180)`, para não entrarem no `conteudo.json` antes.
- [ ] **Step 2:** `CLAUDE.md`: no "Still mocked", a assinatura deixa de ser só mock (o checkout é real atrás da flag; cancelar, trocar e faturas seguem mock até o PR 2 do backend); no bullet "First use", a parte do teste aponta para esta spec, para as situações novas e para a `/plano` só com `sem_plano`.
- [ ] **Step 3: Verify:** `npm run test && npm run lint && npm run build` — Expected: tudo verde, e a tabela de rotas do build com `/e/[empresa]/assinatura` e `/plano`.
- [ ] **Step 4: Verify no navegador** com `backend-fake` e `dev` (em `.claude/launch.json`, com `--prefix .worktrees/assinatura-stripe` numa entrada nova, porta 3980): entrar com a conta de teste em teste, abrir a Assinatura, escolher Anual, Assinar → volta em `?checkout=sucesso` → "Confirmando…" → "Assinatura confirmada" em até ~5 s; a barra do topo deixa de mostrar o teste. Screenshot como prova.
- [ ] **Step 5: Commit** `docs(assinatura): ajuda pronta para a flag e CLAUDE.md (#230)`.
