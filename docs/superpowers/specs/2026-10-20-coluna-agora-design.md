# Coluna "Agora" à direita, com o tutorial dentro

Aprovado em 20/10/2026, em conversa. Origem: o cartão do tutorial fica preso no canto e tapa a tela que ele explica (na fila de Conciliações, cobria a coluna Situação), é pequeno e ruim de ler; e o "Continue de onde parou" ocupa o topo de Conciliações. A ideia do Eduardo: trabalhar ao máximo com uma coluna à direita que diz ao usuário o que fazer, sempre no mesmo lugar, para padronizar.

A Central de ajuda (explicações melhores, páginas de todas as telas, seta nas miniaturas, transições entre páginas, menu do fluxo) fica para uma segunda spec, logo depois desta. Ela reaproveita o fio em onda desenhado aqui.

## O que foi decidido

### A coluna

- **Onde:** nas sete telas que já têm tutorial: Visão geral, Conciliações (`/dashboard`), Nova conciliação, Comparação, Extratos, Histórico e Fechamentos. Fica de fora da Divergência (já abre em painel), das Configurações (janela), da Assinatura, da Central de ajuda e do relatório do fechamento.
- **Telas largas (≥ 1280px):** sempre aberta, 340px fixos à direita do conteúdo, que perde essa largura. O conteúdo da coluna fica grudado abaixo da barra do topo, com rolagem própria se passar da altura da tela, para o cartão do tutorial (e o começo do fio) nunca sair da vista. As colunas Progresso e Última atividade da fila de Conciliações ficam mais compactas para caber no notebook.
- **Recolher:** um botão no topo da coluna deixa só uma faixa estreita com o ícone de reabrir. A escolha fica no navegador (`localStorage` + atributo no `<html>`, como o menu da esquerda recolhido: `data-coluna="recolhida"`), sem piscar na carga.
- **Telas menores (< 1280px):** a coluna some. A barra do topo ganha o botão "Agora", ao lado de "Ajuda", com um ponto dourado quando o "Agora" tem algo pendente. Ele abre a mesma coluna como painel por cima: da direita no tablet, de baixo (folha) no celular. Não é modal; Esc e o X fecham.
- **Conteúdo, de cima para baixo:**
  1. **Agora:** a próxima ação da tela (tabela abaixo).
  2. **Tutorial**, quando ativo.
  3. **Ajuda da tela:** os passos curtos que hoje abrem no painel "Ajuda desta tela" e o link "Abrir na Central". Hoje só Nova conciliação e Comparação têm página (`ajudaDaTela`); nas outras cinco, o bloco mostra só o link "Central de ajuda", até a segunda spec criar as páginas delas. Nessas sete telas, o painel separado deixa de existir: o item "Ajuda desta tela" do menu Ajuda rola a coluna até esse bloco (e abre o painel nas telas menores). Nas telas sem coluna (a linha da comparação, por exemplo), o menu Ajuda continua como está.

### Como entra no código (abordagem A)

- A moldura do app (`app/(app)/shell.tsx`) passa a ter a coluna: o espaço, o recolher, o painel das telas menores e a lembrança do estado. Ela decide pela rota se a tela tem coluna, como `telaDoCaminho` já faz para o tutorial.
- Cada tela diz o que vai no "Agora" com um componente `<ColunaDaTela>` que desenha, por portal, dentro do espaço da moldura. Assim o "Agora" pode usar o estado que só a tela tem (o arquivo escolhido em Extratos, o mês escolhido em Fechamentos) sem subir esse estado para a moldura.
- O tutorial (`TutorialDaRota`) e a ajuda da tela já moram na moldura: passam a desenhar dentro da coluna, sem mudar de dono.
- Descartadas: rota paralela `@coluna` por tela (arquivos extras em cada pasta, e o "Agora" teria de buscar de novo o que a página já carregou) e cada tela com a própria coluna (sete cópias do mesmo comportamento, o oposto de padronizar).

### O tutorial dentro da coluna

- O cartão sai do canto (`position: fixed`) e fica na coluna, logo abaixo do "Agora", com a largura dela. Texto em 16px (era 14,5px) e título maior.
- **O fio em onda** liga o cartão ao alvo: sai da borda esquerda do cartão e termina no elemento destacado. É o mesmo traço do fio da landing e da linha das rodadas: `--color-accent`, período de 17px, 1,2px de espessura. Termina numa ponta de dois traços curtos no mesmo dourado, sem triângulo cheio.
  - Desenhado em SVG numa camada fixa por cima da página. Segue a rolagem e o redimensionamento quadro a quadro, como o recorte do destaque já faz (`requestAnimationFrame`, só reescreve quando a posição muda).
  - A cada passo, o fio se desenha da coluna até o alvo (como `.rodadas-fio` ao abrir). Com `prefers-reduced-motion: reduce`, aparece pronto.
  - Alvo fora da tela ou escondido (a coluna Conferida some no celular): sem fio, como hoje fica sem destaque.
- O destaque continua: tela desfocada com um recorte nítido em volta do alvo.
- **Coluna recolhida:** se o tutorial abre sozinho na primeira visita, ou pelo "Rever o tutorial", a coluna se abre para mostrá-lo e volta a recolher quando ele fecha.
- **Telas menores:** o tutorial abre o painel da coluna na metade de baixo da tela; a página rola o alvo para a metade de cima, e o fio sobe do topo do painel até ele.
- **Não muda:** os textos (`tutorial/roteiros.ts`), "Não mostrar de novo", Esc, abrir sozinho só na primeira visita da sessão e só quando a tela mostra algum alvo.

### O "Agora" de cada tela

Nenhuma tela busca dado novo para isto: o "Agora" usa só o que a página já carregou. Sem nada a fazer, mostra um estado tranquilo ("Tudo em dia"), para a coluna ter sempre o mesmo formato.

| Tela | O que o "Agora" mostra | De onde vem |
|---|---|---|
| Visão geral | O próximo passo não feito do roteiro de primeiros passos, com o botão dele. Depois que o roteiro sai (primeiro mês fechado ou "Já sei usar"), a conciliação que ainda pede decisão. O roteiro inteiro continua na página. | `passosDoRoteiro`, `roteiroVisivel` (`visao-geral/roteiro.ts`); pendências de `visao-geral/pendencias.ts` |
| Conciliações | O "Continue de onde parou", que **sai do topo da página**: mês, arquivos, "N linhas pedem decisão · X de N conferidas · rodada", botão Continuar. Sem pendência: o mês pronto para fechar ("Fechamento de setembro") ou, sem nenhum, "Nova conciliação". | `ContinueDeOndeParou` (`dashboard/em-andamento.tsx`) e `ListaDeConciliacoes.emAndamento` |
| Nova conciliação | Lista de conferência que se marca sozinha: extrato do banco, extrato do sistema, conciliar. | o estado de envio que a tela já tem |
| Comparação | Quantas linhas pedem decisão e quantas foram conferidas, com "Mostrar só o que pede decisão" (liga o filtro que já existe). Tudo resolvido: "Mês pronto para fechar", com link para Fechamentos. Mês fechado: o cadeado e o link para reabrir em Fechamentos. | contagens e `ConciliacaoEmRodadas.fechamento` que a tela já lê |
| Extratos | O painel do arquivo escolhido (`.extrato-painel`), que **muda de lugar para a coluna**. Lista vazia: "Envie o primeiro extrato", com link para Nova conciliação. Se algum arquivo teve problema de leitura, um atalho para esse filtro. | `galeria.tsx` (o escolhido começa no primeiro visível) |
| Histórico | A conciliação que ainda pede revisão, com link para a comparação dela. Sem nenhuma, "Tudo em dia". | `paraRevisar` e `porConciliacao` (`historico/execucoes.ts`) |
| Fechamentos | O painel do mês escolhido (o que falta, PDF, "Fechar o mês"), que **muda de lugar para a coluna**. | `mesa.tsx` (o escolhido começa no primeiro visível) |

## Testes

- A coluna aparece nas sete telas e não nas outras; recolher e reabrir fica lembrado; nas telas menores, o botão "Agora" abre o painel e mostra o ponto quando há pendência.
- O "Agora" de cada tela nos estados da tabela (com pendência, sem pendência, mês pronto, mês fechado, lista vazia), com os mesmos dados falsos dos testes atuais das telas.
- Tutorial: os testes atuais continuam, com o cartão dentro da coluna. Novos: a coluna recolhida se abre para o tutorial e volta a recolher; o fio liga o cartão ao alvo; com movimento reduzido, o fio aparece pronto; sem alvo visível, sem fio.
- Conciliações: os três testes que procuram a região "Continue de onde parou" passam a achá-la na coluna. Extratos e Fechamentos: os testes do painel continuam passando com o painel na coluna.
- Menu Ajuda: nas sete telas, "Ajuda desta tela" leva ao bloco da coluna; nas outras, abre o painel como hoje.
- No navegador, antes do PR: desktop largo, notebook (1280px), tablet e celular, nos temas claro e escuro.

## Fora desta entrega

- A Central de ajuda (segunda spec).
- A coluna na Divergência e nas Configurações.
- Qualquer dado novo do backend.
