# Ledgr — o que falta de design

Levantamento de 22/09/2026, sobre o app autenticado (`app/(app)`). Ranqueado por
**impacto neste produto × aderência ao estilo classical**, não por tendência.

O sistema visual está descrito em `AGENTS.md` e em
`v2- informações simples/_ds/classical-.../readme.md`. O resumo que importa aqui:
fundo claro quente, um acento dourado, cor aplicada como **traço e não
preenchimento**, filete carregando a estrutura, identidade tipográfica.

## Tier 1 — buracos, não polimento

### 1. Estados de carregamento — ✅ feito

Todas as telas do app faziam `return null` e estalavam o conteúdo. Era a primeira
impressão de toda navegação.

Resolvido com esqueletos de filete (sem shimmer — gradiente animado quebraria a
calma editorial) e `aria-busy`, em `app/(app)/esqueleto.tsx`.

> **Nota estrutural:** isso existe porque o mock é `localStorage`, logo client-only.
> Quando o backend entrar, Server Components + Suspense elimina o problema em vez
> de mascará-lo. O esqueleto é ponte consciente, não solução final.

### 2. Undo em vez de confirmação — ✅ feito

"Aceitar valor do banco" reclassificava dinheiro sem volta. O mercado convergiu
forte aqui (Gmail → Linear): ação otimista com desfazer ganha de diálogo de
confirmação, porque confirmação treina a pessoa a clicar "sim" sem ler.

Resolvido: o aceite acontece **na própria tela** (não navega mais), o cartão passa
a "Conciliado" na hora e uma barra de desfazer aparece com o estado anterior
guardado. O design já previa um estado `desfazer` que nunca tinha sido usado.

### 3. Tabela que aguenta 4.218 linhas — ✅ feito

A comparação em `/conciliacoes/[id]` renderizava **todas** as linhas, sem
ordenação, filtro ou paginação, e a dashboard mostrava 7 de 4.218.

Resolvido: pills de filtro (as do próprio design), ordenação por coluna e
paginação. Virtualização ficou de fora de propósito — paginação resolve, e
virtualizar antes de ter dado real é otimizar no escuro.

## Tier 2 — é a régua atual para ferramenta de trabalho

### 4. Dark mode — ✅ feito

As rampas escuras não foram escolhidas a dedo: `scripts/gerar-escuro.mjs` lê a
escala do tema claro e **espelha a luminosidade**, mantendo matiz e o arco de
croma (com o croma 15% menor, porque cor saturada sobre fundo escuro vibra). O
passo 100 passa a ser o mais escuro e o 900 o mais claro, e é isso que permite
**nenhum componente mudar de passo**: quem pedia `--color-ok-700` para texto
continua pedindo e recebe um verde claro legível.

O bloco de CSS é gerado, não escrito à mão, e sai em duas cópias — uma para quem
pediu escuro no sistema, outra para quem escolheu no app — geradas juntas para
não divergirem.

**Escopo: só o app autenticado (`.app-shell`).** A landing e as telas de acesso
seguem claras porque o `logo-barras` é 63% de pixels escuros e sumiria no fundo
escuro. Levar o escuro para o site inteiro exige uma variante clara do logo, que
não existe. Os mascotes, esses, são 60–79% de pixels claros e sobrevivem.

> **Armadilha anotada:** o `.app-shell` precisa declarar `color` explicitamente.
> Redefinir `--color-text` dentro dele não conserta texto herdado do `<body>`,
> que já computou a cor clara lá em cima. Sem isso o fundo escurece e o texto
> continua preto.

### 5. Teclado — parcial

- ✅ **Bug corrigido:** a busca agora é um `combobox` de verdade, com
  `aria-expanded`, `aria-controls`, `aria-activedescendant` e um `listbox` de
  `option`s. Setas andam pela lista (dando a volta nas pontas), Enter abre o
  resultado apontado, Escape fecha.
- ⬜ **Falta:** paleta com **ações** (não só busca), `j/k` na tabela, `?` abrindo
  a folha de atalhos. São decisões de produto maiores que um ajuste de foco.

### 6. Controle de densidade — ✅ feito

Duas densidades de tabela, ao lado dos filtros da comparação, lembradas entre
sessões.

O design resolve isso com `zoom` em quatro níveis. Não copiei: `zoom` escala a
página inteira, incluindo o menu sticky e os painéis posicionados, que passariam
a calcular posição sobre um layout escalado. O controle aqui é só das linhas de
tabela, que é onde a densidade paga numa ferramenta de conciliação.

## Tier 3 — refinamento que cai bem neste estilo

### 7. Animar a consequência, não a entrada

Está invertido: o scroll-reveal anima a **chegada** dos blocos (padrão de
marketing), enquanto a mudança que importa — a taxa de match saltando depois de
uma decisão — acontece em corte seco. Numa ferramenta, motion se paga mostrando
efeito: número interpolando, linha saindo da lista ao ser resolvida.

### 8. Divulgação progressiva no detalhe da divergência

É um scroll longo. "Crônico, não pontual" e "Histórico do lançamento" podiam vir
recolhidos.

### 9. Tabela em cartões no celular

Abaixo de 680px a tabela rola na horizontal. O padrão de mercado é um cartão por
linha.

## O que eu não traria

Metade do que o mercado "aprova" destruiria esta identidade.

- **Glassmorphism.** E aqui tem dívida nossa: o `backdrop-filter: blur(6px)` da
  barra superior é a coisa mais "SaaS 2021" do código. Trocar por barra opaca.
- **Bento grid, gradiente mesh, glow / neon.** Briga direto com "cor como traço,
  sem preenchimentos grandes".
- **Soft UI, tudo arredondado.** O sistema é filete e raio pequeno; inflar apaga o
  caráter.
- **Ícones em tudo.** O readme do design system sugere Lucide, mas o app usa
  **zero ícone** hoje e fica melhor assim: a identidade é tipográfica.
- **Sparkle de IA.** O assistente existe no design como conversa com o mascote,
  que é da marca. Um botão ✨ genérico não é.

## Dívidas pontuais anotadas pelo caminho

- `--color-erro` (`#a94f33`) está fora da rampa de `risco`, entre o 600 e o 700.
  É a cor de erro dos formulários de login e cadastro. Alinhar para
  `var(--color-risco-600)` é uma linha, mas mexe em duas telas já verificadas.
- O `eslint-disable` de `react-hooks/set-state-in-effect` em
  `app/(auth)/login/page.tsx:122` não é mais necessário e gera o único warning do
  lint.
- O `AGENTS.md` diz que os títulos são Cormorant Garamond e o corpo é Lora. O
  `app/layout.tsx` carrega **Inter** para os dois, com Cormorant só como
  `--font-display`. A doc ficou para trás do código.
- Em desenvolvimento, o HMR às vezes apaga o `data-tema` do `<html>` e o tema
  parece não trocar até recarregar. Verificado contra `next start`: em produção
  o toggle responde na hora. É artefato do dev, não do código.
- O diálogo de linha em `/conciliacoes/[id]` e a tela de detalhe mostram a mesma
  informação. Quando a tela provar que basta, o diálogo sai.
