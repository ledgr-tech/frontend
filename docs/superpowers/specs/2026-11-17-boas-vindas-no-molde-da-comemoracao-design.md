# Boas-vindas no molde da comemoração

Aprovado em 17/11 pelo Eduardo, depois de ver a janela da #410 rodando: centralizada, título pequeno, a frase principal em Inter grande e o mascote num quadrado branco. "Totalmente errado e fora do padrão".

## Abordagens

- **Molde da comemoração da assinatura (#300), escolhida.** É a única janela de "momento" do app: rótulo dourado com filete até o X, título em Newsreader com a imagem à direita e uma seção abaixo do divisor. Reaproveita as classes `comemoracao-*`, então não há CSS novo além da lista.
- Janela própria. Seria mais um desenho para manter e afastaria o app do padrão.

## O desenho

- **Rótulo:** "Boas-vindas". **Título:** "Boas-vindas, <primeiro nome>", ou "Boas-vindas ao Ledgr" sem nome. **Texto:** "Em poucos passos o seu mês fica conciliado."
- O mascote da bandeira fica à direita, com 132px, e mantém a entrada com salto (parado para quem pede menos movimento).
- A seção "Seus primeiros passos" traz os três passos de hoje, numerados em Newsreader dourado.
- **Botões:** "Agora não" (secundário) e "Começar" (principal), como na comemoração. O X, o Esc e o clique no fundo valem o mesmo que "Agora não".
- Ficam de fora o confete e as linhas pontilhadas de valor, que servem para o plano.
- No celular, o molde já empilha: o mascote sobe para cima do título e os botões ocupam a largura.

## O que não muda

Aparece uma vez por pessoa (`boasVindasVista` nas preferências), e "Começar" abre o tutorial da Visão geral.
