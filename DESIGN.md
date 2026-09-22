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

### 4. Dark mode

Zero token de dark mode hoje. Conciliação é tela que se encara por horas, e o
design tem um `ledgr-noite` como referência.

O caminho é mecânico, não criativo: as rampas estão estruturadas em OKLCH numa
escala de luminosidade compartilhada (ver `docs/superpowers/specs/2026-09-22-cores-de-status-design.md`),
então as rampas escuras se **derivam** invertendo a escala, em vez de serem
escolhidas a dedo. Depois é revisar as sete telas.

### 5. Teclado primeiro

O ⌘K foca a caixa de busca e para aí.

- **Bug a corrigir:** os resultados não navegam por seta e não têm
  `role="combobox"`/`listbox`, então leitor de tela não anuncia que apareceram
  opções. Isso é regressão de acessibilidade introduzida junto com a barra.
- Depois: paleta com **ações** (não só busca), `j/k` na tabela, `?` abrindo a
  folha de atalhos.

Para um time que repete o mesmo ciclo todo mês, é diferencial real.

### 6. Controle de densidade

O app herdou o espaçamento arejado do site (density 1.15×), ótimo para landing e
caro para planilha. O design tem `cfgEscala` (Compacto / Padrão / Ampliado).

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
- O diálogo de linha em `/conciliacoes/[id]` e a tela de detalhe mostram a mesma
  informação. Quando a tela provar que basta, o diálogo sai.
