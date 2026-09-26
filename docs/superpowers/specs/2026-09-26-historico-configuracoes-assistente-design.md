# Ledgr — Histórico novo, Configurações e o assistente

## Contexto

Pedidos de 25–26/09/2026: uma nova versão do Histórico; um botão que leve às
configurações, abertas numa janela no meio da tela "como o Claude faz", a partir
do nome "Financeiro" no menu; e a tela do assistente ("Fale com o Ledgr"), que
estava como "em breve". No estilo do app e com boas práticas.

A regra de sempre vale para as três: só dado real, e nenhum controle que finja
salvar o que o backend não guarda.

## Histórico

1. **Linha do tempo, não tabela.** As execuções saem agrupadas pelo mês em que
   rodaram (fuso de Brasília), cada uma num cartão com os dois arquivos, o match,
   a tolerância daquela rodada e uma barra do que casou e do que pediu revisão,
   pelos tons de status (verde, terracota, dourado, cinza). A rodada refeita
   depois fica com borda tracejada e "Ver atual".
2. **Paginação de verdade.** O backend aceita `offset`, e a tela mostrava só as
   50 mais recentes. `?pagina=N`, com "Mais recentes" e "Mais antigas".
3. **Resumo das conciliações atuais** (a refeita não soma de novo) e o gráfico de
   taxa de match, que não mudou.
4. **Exportar histórico** (do design): CSV montado no navegador, no padrão Excel
   BR (BOM, ponto e vírgula, CRLF). Nome de arquivo que começa com `=`, `+`, `-`
   ou `@` ganha apóstrofo, como o backend faz no CSV da conciliação.
5. `Execucao` ganhou `toleranciaDias`, que `/execucoes` já mandava.

## Configurações

1. **Janela no meio da tela**, como a do Claude: `<dialog>` nativo com
   `showModal()` (prende o foco, fecha no Esc, põe o fundo inerte). Seções à
   esquerda, com busca que ignora acento; linhas de ajuste à direita.
2. **Entrada:** o item "Configurações" no menu da conta (o "Financeiro") e
   `Ctrl+,` (`⌘,` no Mac). Ao fechar, o foco volta ao nome da conta.
3. **O que entra:**
   - Conta: e-mail, duração da sessão, sair.
   - Aparência: tema (claro, escuro ou seguir o sistema), densidade das tabelas
     e menu lateral — preferências deste navegador, que mudam na hora.
   - Conciliação: a tolerância de data **como o backend usou na última
     conciliação**, só leitura (a tabela `configuracoes` existe no backend, mas
     não tem rota); a fonte da verdade; como funcionam as explicações por IA.
   - Atalhos de teclado que existem, Privacidade e Sobre.
4. **O que ficou de fora**, por não ter onde salvar: dados da empresa,
   tolerância de valor, as chaves de regra do design, tipografia, paleta, papel
   de fundo e assinatura (que tem tela própria).

## Assistente

1. **Tela própria em `/assistente`**, e o cartão "Fale com o Ledgr" do menu vira
   link para ela (deixa de ser "em breve").
2. **O roteiro do design, com números reais.** O design responde por
   palavra-chave com dados de mentira; aqui o roteiro é o mesmo (resumo, o que
   sobrou, o que falta para fechar, tarifas, duplicidades), calculado das linhas
   da última conciliação, com o link para a tela que tem o detalhe. Não há
   backend de conversa; quando houver, `responder` vira a chamada a ele.
3. **Só a explicação usa IA:** "Explique a maior divergência" chama
   `POST /explicacoes` para a linha que mais deixa dinheiro em aberto. É a única
   resposta com espera ("lendo o extrato…"), e o selo "Gerada por IA · confira
   antes de decidir" só aparece quando o texto veio do modelo.
4. **Pergunta fora do roteiro** recebe o que o assistente sabe responder, em vez
   de uma resposta inventada. As palavras-chave casam no começo da palavra
   ("previsão" não é pergunta sobre revisão).
5. Tudo como texto: a explicação vem de descrição de extrato de terceiro.

## Verificado no navegador (backend falso)

- Histórico a 1440px: resumo, gráfico, setembro com dois cartões e as barras.
- Configurações: abertas pelo `Ctrl+,`, tolerância "1 dia" lida do backend, tema
  claro e de volta ao sistema, busca por "atalho" juntando duas seções, foco de
  volta ao "Financeiro" ao fechar.
- Assistente: saudação com os números do mês, "Por que sobrou R$ 14.398?" e a
  explicação vinda de `/explicacoes`.
