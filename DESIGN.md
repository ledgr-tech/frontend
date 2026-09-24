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

### 7. Animar a consequência, não a entrada — ✅ feito

Dois lugares onde algo muda de verdade no lugar:

- **O valor do cartão no detalhe** interpola quando você aceita o valor do banco
  (`app/(app)/numero-animado.tsx`). O componente **não anima ao montar**, de
  propósito: um número que sobe do zero toda vez que a tela abre é decoração;
  um número que sai de 12.604 para 12.640 é a resposta ao seu clique.
- **A regra que troca de lista** chega com um realce que apaga. Sem isso ela
  sumia de uma lista e aparecia na outra sem nada ligar as duas pontas.

> **O que não fiz:** o scroll-reveal na chegada dos blocos continua. Removê-lo é
> a outra metade do argumento, mas é mudança de gosto sobre algo que vocês já
> viram e aprovaram — fica como decisão de vocês, não minha.

### 8. Divulgação progressiva no detalhe da divergência — ✅ feito

"Crônico, não pontual" abre por padrão (é a leitura que muda o que você faz a
seguir) e "Histórico do lançamento" vem fechado (procedência é consulta).

Usa `<details>`/`<summary>` nativo, o mesmo que o FAQ da landing já usava: abre
sem JS, entra no Ctrl+F do navegador e já vem com teclado. O CTA "Criar regra"
saiu do `summary` para o corpo — botão dentro de `summary` vira dois alvos
disputando o mesmo clique.

### 9. Tabela em cartões no celular — ✅ feito

Abaixo de 680px cada linha vira um cartão, com a descrição de título e os demais
campos rotulados.

> **Armadilha:** `display: block` numa tabela **apaga o papel implícito de
> tabela** e o leitor de tela passa a ler uma pilha de textos soltos. As linhas e
> células declaram `role` explicitamente para a grade sobreviver.

> **Vale dizer:** o spec da landing registra que "o sistema é usado no desktop".
> Isto é polimento de menor valor aqui do que seria num produto mobile-first.

## O que eu não traria

Metade do que o mercado "aprova" destruiria esta identidade.

- **Glassmorphism.** E aqui tem dívida nossa: o `backdrop-filter: blur(6px)` da
  barra superior é a coisa mais "SaaS 2021" do código. Trocar por barra opaca.
- **Bento grid, gradiente mesh, glow / neon.** Briga direto com "cor como traço,
  sem preenchimentos grandes".
- **Soft UI, tudo arredondado.** O sistema é filete e raio pequeno; inflar apaga o
  caráter.
- **Ícones em tudo.** O readme do design system sugere Lucide. O app usa ícone
  **só no menu lateral** (Lucide, traço 1,5, na cor do texto), porque menu que
  recolhe precisa de algo no lugar do nome (decisão de 24/09/2026, ver
  `docs/superpowers/specs/2026-09-24-menu-lateral-recolhivel-design.md`). Fora
  dele a identidade continua tipográfica: botão tem rótulo, não ícone.
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
- **Corrigido depois de um diagnóstico errado:** eu tinha anotado aqui que o
  `data-tema` sumia por causa do HMR. Não era. O script inline escreve o atributo
  antes da hidratação, o HTML do servidor não o tem, e o React trata como
  incompatibilidade — avisando literalmente que "won't be patched up" e
  descartando o atributo. A correção é `suppressHydrationWarning` no `<html>`,
  que existe exatamente para atributos escritos antes da hidratação. O teste em
  produção passou porque lá eu cliquei o toggle *depois* da hidratação, que é um
  caminho que nunca quebrou.
- O diálogo de linha em `/conciliacoes/[id]` e a tela de detalhe mostram a mesma
  informação. Quando a tela provar que basta, o diálogo sai.
