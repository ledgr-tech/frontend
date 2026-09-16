# Ledgr — Landing no celular e no tablet

## Contexto

O sistema é usado no desktop, mas a landing é o cartão de visitas e precisa funcionar em qualquer tela. Nos prints de 393x852 (iPhone 14 Pro) e 480x1040 (Pixel 7 Pro) havia três problemas:

- o menu quebrava em duas ou três linhas;
- "Em números" e os planos ficavam em grades 2+1, com divisórias fora do lugar;
- o mascote do preço ficava por trás dos valores.

## Decisões (15/09/2026)

1. **Cabeçalho (`app/(marketing)/cabecalho-site.tsx`).**
   - **Até 960px:** a navegação completa sai. As barras do logo vão para a direita e viram o botão de um menu de opções.
   - **Menu:** traz as seções com o capítulo ao lado ("O problema · Cap. II", "Como funciona · Cap. III", "Assinatura · Cap. IV"), mais Entrar e Começar.
   - **Animação:** ao abrir, a barra do meio some e as outras duas cruzam em X.
   - **Fechamento:** o menu fecha ao escolher uma opção, com Esc (devolvendo o foco ao botão), com um toque fora ou quando a tela passa de 960px.
   - **Espaço:** até 380px o slogan "Conciliação bancária" sai.
2. **Quebras de texto.**
   - **Títulos:** `text-wrap: balance`.
   - **Parágrafos:** `text-wrap: pretty`.
   - **Justificados:** passam a alinhar à esquerda até 680px.
   - **Tamanhos:** o título do hero desce até 44px e os números até 36px.
   - **Âncoras:** as seções têm `scroll-margin-top`, para não ficarem por baixo do cabeçalho fixo.
3. **Grades com divisória** (provas do hero, em números, passos), via classe `.grade-colunas`.
   - **Acima de 760px:** 3 colunas com linha vertical entre elas.
   - **Até 760px:** um item por linha, com a linha em cima e sem recuo.
   - **Provas do hero no celular:** valor e explicação na mesma linha.
4. **Planos (`.planos-grade`).**
   - **Acima de 1100px:** 5 colunas.
   - **Até 1100px:** 2 colunas, com "Volume" ocupando a linha inteira.
   - **Até 600px:** 1 coluna, com o card em linha (nome e limite à esquerda, preço à direita).
5. **Imagens.** Marcas d'água e mascotes diminuem até 760px. O mascote do preço sobe para trás do título, e o do convite fica centralizado acima do texto.
6. **Comparativo de extratos.**
   - **Grade:** usa `minmax(0, 1fr)`, porque antes estourava 113px na tela de 320px.
   - **Descrição:** no celular quebra em linhas em vez de ser cortada.
   - **Dica:** em telas de toque diz "Toque nas linhas para ver os detalhes".
7. **Hero.** Empilha até 900px (antes era 680px), para a coluna do texto não ficar espremida no tablet.

## Verificado no navegador

- **Sem rolagem lateral:** 320x568, 393x852, 480x1040, 768x1024, 852x393 (deitado) e 1280x800.
- **Menu:** cabe na tela em 320x568 e em 852x393.
- **Detalhe do comparativo:** fica dentro da tela em 320px.
