# Travamento da landing no celular: o que foi medido (04/11)

Continuação do PR #313. A ideia era reduzir a hidratação trocando os `Reveal` da landing por CSS. **Nenhuma variante testada teve ganho comprovado, então nenhuma mudança de código entrou.** Este registro existe para ninguém repetir o caminho.

## Como foi medido

- Build de produção (`next start`) sobre `79e1b45` (a branch do #313), no Chrome com viewport de 412 × 823.
- 1,6 Mbps, 150 ms de RTT e CPU 4x pelo DevTools Protocol, navegador novo e sem cache a cada carga.
- Versões alternadas em ordem ABCD/DCBA. Cada diferença compara duas cargas da mesma rodada.
- Travamento é a soma de `duração - 50 ms` das tarefas depois do FCP, no trace. Intervalo de 95% por bootstrap da mediana dos pares.
- Quatro séries: três de 11 rodadas e uma de 21. A primeira inclui uma tarefa artificial do fim do trace, e a de 21 tinha janela de 10 s, então parte das tarefas pode ter ficado de fora. Isso afeta os dois lados de cada par, mas é uma limitação real.

## Resultado

Base: mediana da própria base nos pares de cada variante. Δ negativo é melhor.

| Variante | Pares | Travamento (base → variante) | Δ travamento [IC 95%] | Δ maior tarefa [IC 95%] | Δ layout [IC 95%] | Δ script [IC 95%] | Δ LCP [IC 95%] | CLS |
|---|---|---|---|---|---|---|---|---|
| `Reveal` → CSS + um observador | 54 | 1.899 → 2.056 ms | +46 [−195, +363] | 0 [−90, +53] | +58 [−118, +169] | −10 [−187, +83] | +28 [−188, +150] | 0 |
| `Reveal` e `Cena` sem `motion`, com observador único | 11 | 2.474 → 2.365 ms | +23 [−495, +781] | −78 [−253, +86] | −107 [−417, +127] | −146 [−267, +5] | +108 [−164, +424] | 0 |
| `Intl.DateTimeFormat` criado no primeiro uso | 43 | 1.660 → 1.868 ms | +51 [−235, +152] | +13 [−50, +100] | +99 [−46, +219] | +22 [−91, +63] | +128 [0, +268] | 0 |
| Janela do hero medida em `useEffect` (fora da hidratação) | 43 | 1.660 → 1.743 ms | −278 [−408, +184] | −32 [−127, +26] | −11 [−125, +153] | +11 [−84, +22] | −8 [−152, +140] | 0 |

Nenhum intervalo indica melhora: todos incluem o zero ou, no LCP do `Intl`, só o tocam pelo lado da piora. A comparação A/A dá a escala do ruído: `Intl` contra `useEffect`, com o mesmo HTML, variou de −650 a +740 ms no travamento e de −328 a +228 ms no LCP.

Tempo de CPU da thread (`tdur` × 4), que sofre menos com a disputa de CPU, na última série (11 rodadas):

| | Base | `Reveal` → CSS | `Intl` | `useEffect` |
|---|---:|---:|---:|---:|
| Travamento | 1.123 ms | 1.213 ms | 991 ms | 987 ms |
| Total da thread | 3.486 ms | 3.655 ms | 3.542 ms | 3.369 ms |
| Layout | 879 ms | 890 ms | 934 ms | 868 ms |
| Estilo | 411 ms | 410 ms | 401 ms | 410 ms |

Todas as diferenças pareadas dessa tabela têm intervalo incluindo zero.

## Por que não melhorou

- **`Reveal`:** o React continua hidratando cada `<div>` vinda do servidor. Sai só a parte do `motion` por bloco, pequena perto do resto. O `motion` continua no bundle porque o hero, as trilhas, o "Por que" e o mockup usam `useScroll`.
- **`Intl`:** o perfil atribuía 188 ms ao módulo, em uma carga. A hipótese não testada é que a primeira carga do ICU só muda de lugar, porque a landing usa `toLocaleString` na contagem.
- **`useEffect` na janela:** o layout é o mesmo, só pode cair em outra tarefa. A maior tarefa caiu de 944 para 719 ms na primeira série em que apareceu, mas isso não se repetiu.
- **Adiar a montagem da janela até ela se aproximar da tela:** não foi construído. Em 412 × 823 a janela começa em y = 594, dentro da primeira tela, então nada seria adiado na carga.

## Para onde vai o tempo

Uma carga perfilada da variante `Reveal` → CSS, em tempo de relógio. A página tinha 1.197 elementos, 20.306 px de altura, 250 KB de JavaScript comprimido e 280 KB de CSS (47,6 KB comprimidos).

| Momento | Tarefa | O que tem dentro |
|---|---|---|
| 1,3 a 2,2 s | 3 tarefas de 250 a 310 ms | Layout de 160 a 230 ms em cada, conforme o HTML chega |
| 3,1 s | 645 ms | Avaliação do chunk do React e do Next |
| 4,4 a 5,0 s | 147 e 301 ms | Funções, sem detalhamento por módulo |
| 5,5 s | 951 ms | Cerca de 320 ms de script e 630 ms de layout e estilo. O layout mede a janela do hero, com 483 objetos sujos |

## O que sobra, por decisão de design

Não foi testado aqui. Os números são da sessão anterior, em uma remoção de cada vez, contra cerca de 2.500 ms da página inteira:

| Mudança | Travamento depois | Ganho estimado |
|---|---|---:|
| Sem as fontes | ~1.676 ms | ~820 ms |
| Sem as janelas do app | ~1.790 ms | ~710 ms |
| Só o topo, sem a janela | ~410 ms | referência do piso |

No perfil acima, o layout da janela do hero custa cerca de 630 ms em uma tarefa, o que é compatível com a estimativa, mas é uma carga só. Trocar a janela por imagem e reduzir as fontes são decisões do usuário e não foram feitas.

Candidatos ainda não testados, sem nenhuma estimativa de ganho:

- Separar da landing o CSS do app: `globals.css` tem 280 KB e o estilo custa cerca de 410 ms de CPU por carga.
- Tirar `motion` da landing: o chunk dele tem 142 KB, mas as animações presas à rolagem precisariam de outra solução, e isso pode mudar o visual nos navegadores sem `animation-timeline`.

Uma diferença abaixo de uns 300 ms não aparece nesta máquina nem com 40 pares. Medir melhorias menores pede um ambiente sem disputa de CPU.
