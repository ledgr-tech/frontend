# Landing animada (03/11/2026)

Aprovado no artefato "Landing Ledgr animada" (canvas do Claude Design), versão a versão com o Eduardo.
Ponto de partida: a landing "parecia gerada por IA", sem movimento e sem o produto à vista. A
referência de movimento foi o gsap.com; o guia de estilo v4 continua valendo para cor, tipografia e
selos.

## O que mudou

- **Hero** (`hero.tsx`): o título grande (9vw, até 148px) entra letra por letra, com giro pequeno e
  fixo por letra (o servidor e o navegador batem). Depois do título, e só depois, entram os adesivos
  "Conciliado" e "Valor diverge", o sublinhado dourado em "à mão." e o adesivo escuro "O Ledgr confere
  por você.". Sublinhado, e não risco: riscado, o título se lia "Pare de conciliar extrato com o
  Ledgr". Os adesivos flutuam e seguem o mouse e a rolagem. Saíram o mascote, a logo à direita e o
  adesivo do R$ (o colega achou o primeiro corte "poluído", "muita info ao mesmo tempo"). Embaixo, a
  Comparação direta numa janela (`Vitrine` compacta, sem o menu lateral), que se endireita com a
  rolagem; as linhas, os selos e o cartão entram quando ela chega.
- **Barra do topo**: completa sempre (padrão de Stripe, Linear, Notion, Conta Azul); transparente no
  começo da página, com fundo e filete depois de 40px de rolagem. Esconder itens no hero foi tentado e
  descartado: o "Entrar" fazia falta e a barra ficava estranha.
- **Cap. II**: as duas telas chegam de lados opostos, as linhas descem, os marcadores e as dores
  estalam e o 4.218 conta. Os números das dores na Inter (a voz do hero), o "R$" pequeno; os
  marcadores 1, 2, 3 como selo do guia (traço, não preenchimento). O fecho ganha o traço dourado e o
  grifo "só as que não batem".
- **Como funciona**: o formato de cada arquivo numa etiqueta; no passo III, os cinco selos do app
  (`seloDoStatus`) no lugar da lista por extenso; "Na prática" com as duas vozes.
- **Por dentro**: o vídeo do produto (`public/landing/conciliacao.webm`, 35 s, 1 MB, gravado em 03/11
  com a conta de teste) no lugar da réplica, que subiu para o hero. `preload="none"`, capa, toca só na
  tela, pausa fora; com movimento reduzido não toca sozinho.
- **Por que o Ledgr** (`por-que.tsx`): a tabela virou uma faixa lateral, como no gsap.com. A seção
  fica presa (sticky) e a rolagem empurra os painéis para o lado: abertura, um painel por pergunta (a
  resposta do Ledgr grande, as duas saídas de hoje embaixo) e o fim com "Começar agora". A linha
  ondulada do progresso só desce em seta para a próxima seção depois do último painel. Sem JS, com
  movimento reduzido ou sem ResizeObserver, é uma tira que se arrasta de lado.
- **Detalhes**: o traço dourado na regra de ouro; o "+" das perguntas vira "×" com mola; a setinha
  dos botões principais anda no hover; cada perfil de "Para quem é" ganha "Ver o meu plano", que
  desce até a régua no plano dele (Usuário único e Empresa no Essencial, Consultor no Padrão,
  Escritório no Avançado, pelos "para quem" de cada plano em `medidor-de-planos.ts`).

## Como

- A `motion`, que a landing já carregava (`MotionRoot`), faz o hero, a janela, o vídeo e a faixa
  lateral; o GSAP do protótipo não entrou no projeto.
- As cenas menores são CSS (`globals.css`, bloco "Landing animada") disparadas pelo `<Cena>`
  (`cena.tsx`), que põe `data-cena="nao"`/`"sim"` quando o bloco entra na tela. Sem JS o atributo não
  existe e tudo aparece parado; todas as entradas ficam dentro de `prefers-reduced-motion:
  no-preference`.
- O guia v4 pede entrada calma, uma vez; aqui o hero e a faixa lateral vão além disso de propósito, a
  pedido. O resto da página continua só subindo 16px.

## Desempenho (medido em 03/11, build de produção, contra a landing da develop)

- Peso na primeira tela: 702 KB contra 635 KB (+13 KB de JS, o resto imagens). O vídeo (979 KB) só baixa
  quando chega perto da tela. CLS 0 no desktop e no celular.
- Três armadilhas achadas no perfil e corrigidas, com o porquê no código: o `fill-mode: both` das cenas em
  CSS (com ele, cada elemento animado ficava numa camada para sempre: 82 camadas contra 31, e o navegador
  reorganizava todas a cada quadro; agora `backwards`, 22 camadas); a barra do topo lendo
  `window.scrollY` na rolagem (forçava o layout a cada quadro; agora um IntersectionObserver); e a
  réplica do hero encolhendo depois do HTML do servidor (CLS 0,17 no celular; agora fica invisível até
  ser medida). As janelas 3D viram `transform: none` quando endireitam.
- Rolagem: sem limitar a CPU, igual à da develop (0 a 9% de quadros lentos por seção nas duas). Com a
  CPU 4x mais lenta, a média segue em 60 fps, mas há mais quadros lentos nas seções que animam enquanto
  se rola (hero, Cap. II, vídeo, faixa lateral).

## Fora daqui

- Depoimentos reais: a seção existe e só aparece com depoimento em `lib/depoimentos.ts`.
- Atualizar o guia de estilo com o movimento novo.
