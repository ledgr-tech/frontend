# Ledgr — Preços: o que vem em todo plano, numa trilha

## Contexto

Pedido de 01/10/2026: uma visualização nova na seção de preços (`#preco`, "Cap. IV · Começar")
para o que a pessoa recebe e o valor, por enquanto sem o valor. A referência foram os cards
"Recomendado para sua empresa" do Mailchimp: em repouso, a lista de benefícios vai apagando
embaixo; no hover o card muda de cor, a lista aparece inteira e a imagem da direita se aproxima.
No nosso estilo, no fundo escuro, com os cards aparecendo ao rolar como em "Por dentro" ("Cada
lançamento, do extrato ao seu sistema").

Os dois mockups (o card e a seção inteira) foram aprovados no navegador em 01/10. O conteúdo ficou
a nosso critério ("faça como achar melhor").

## Decisões

1. **Os cards são o que vem em todo plano, não um card por plano.** Os cinco planos de
   `lib/planos.ts` só diferem no volume, e não existe lista de benefícios por plano em lugar
   nenhum: nem no código, nem na tela de Assinatura, nem no export do Claude Design (que ainda traz
   o modelo antigo de R$ 149 por mês por empresa). Um hover que abrisse a mesma lista em cinco cards
   seria ruído. Os planos viram uma régua de volume no fim da trilha.
2. **Quatro cards, com o texto que a landing já usa.** I. Só o que não bate · II. O motivo de cada
   diferença · III. Sem trocar de sistema · IV. O relatório para o contador. Os itens saem do hero,
   de "Na prática", dos passos, de "Por dentro", da Regra de ouro e da FAQ. O número de categorias
   vem do motor (`DIVERGENCIAS`, hoje cinco), como na faixa de números: o site não promete uma lista
   e o produto entrega outra. Um quinto card ("sem fidelidade nem taxa de implantação") repetia o
   parágrafo ao lado do título e saiu; com quatro a trilha tem o ritmo de "Por dentro".
3. **O hover é "a folha acende" (opção A).** O card vira papel, o mesmo claro das folhas de
   extrato do app, com o filete e os checks em dourado. Foi preferido ao "filete dourado" (B, só
   traço, discreto demais) e ao "dourado chapado" (C, o mais perto da referência, mas um
   preenchimento grande de cor, que o `DESIGN.md` evita). A lista está sempre inteira no HTML: em
   repouso uma máscara apaga o fim dela, e o card não muda de altura ao abrir.
4. **A trilha é a de "Por dentro".** O mesmo `FioDaTrilha` (agora com `className`), a ponta a 60%
   da tela, cada card entrando quando a ponta chega nele, o título parado à esquerda no desktop
   (`position: sticky`, por isso a seção usa `overflow: clip`). O fio termina na borda de cima da
   régua, como o de "Por dentro" termina na janela do app.
5. **A régua mostra os planos pelo volume, sem preço.** Campo novo `volume` em `lib/planos.ts` (o
   número grande: 100, 200, 350, 5.000, 5.000+). O Padrão segue em destaque, em dourado; o Volume,
   aberto para cima, é tracejado. O preço continua em `lib/planos.ts` para a Assinatura do app e
   volta para a landing quando a cobrança existir.
6. **Cada card tem uma demonstração do produto à direita, com os dados da própria landing:** as
   linhas de agosto marcadas (um veredito de cada, com os selos do app), a explicação da #1082 com
   o selo de IA, as duas folhas (banco e sistema, com os formatos aceitos) e o resumo do mês, o
   mesmo do cartão do hero (`AGOSTO` em `page.tsx`, compartilhado pelos dois).
7. **Acessibilidade.** O leitor de tela lê a lista inteira e não lê as demonstrações
   (`aria-hidden`). O card recebe foco (`tabIndex={0}`, nomeado pelo título) e abre no foco como no
   hover. No toque (`hover: none`) o card já vem aberto e a dica do mouse some. Com movimento
   reduzido, nada anima e o fio aparece inteiro; sem JavaScript, o `noscript` do `MotionRoot`
   mostra tudo.
8. **O mascote comemorando continua como marca d'água**, só desceu para trás dos botões: no meio da
   seção ele ficaria atrás dos cards.

## Texto novo

O resto é texto que a landing já tinha. Estes são novos e valem uma revisão:

| Onde | Texto |
|---|---|
| Títulos dos cards | "Só o que não bate", "O motivo de cada diferença", "Sem trocar de sistema", "O relatório para o contador" |
| Rótulo da trilha | "Em todo plano" |
| Rótulo da régua | "Os planos" · "pelo volume de lançamentos do mês" |
| Dica, só com mouse | "Passe o mouse sobre um card para ver tudo o que vem nele" |
| Volume na régua | 100 · 200 · 350 · 5.000 · 5.000+ |

Dois textos dos cards repetem frases inteiras de outras seções: a descrição do card II é a etapa
III de "Por dentro", e a do card I encurta a frase do hero. Ficaram como no mockup aprovado.

## Fora do escopo

- O preço nos cards e na régua (espera a cobrança).
- Diferenças de recurso entre os planos (decisão de negócio, ainda não tomada).
- Um link por card, como o "Veja nossas ferramentas" da referência: não há página de recurso para
  onde levar. O convite é o "Começar agora" embaixo da régua.

## Arquivos

- `app/(marketing)/precos.tsx`: a seção (cards, demonstrações, régua)
- `app/(marketing)/categorias.ts`: as categorias do motor, para a faixa de números, os passos e os cards
- `app/(marketing)/dica-do-mouse.tsx`: a dica do mouse, agora usada em "O problema" e em Preços
- `app/(marketing)/fio-da-trilha.tsx`: `className` para o fio de cada trilha
- `app/reveal.tsx`: sai o `PlanCard` (só a grade antiga usava); o `noscript` mostra o fio de Preços
- `lib/planos.ts`: campo `volume`
- `app/globals.css`: bloco "Preços"; sai o CSS da grade antiga de planos

## Verificado no navegador (build de produção, Edge headless)

- 1600px: o título fica parado a 120px do topo enquanto a trilha passa; o fio desenha até a ponta e
  cada card entra com ela; o card aberto (hover forçado) vira papel e mostra a lista inteira.
- 1180px: a coluna dos cards fica estreita e a demonstração desce para baixo do texto (container
  query de 800px).
- 390px com toque: título em cima, cards abertos, demonstração na largura do card, régua de pé, sem
  rolagem horizontal.
- Movimento reduzido: os dois fios (de "Por dentro" e de Preços) aparecem inteiros.
