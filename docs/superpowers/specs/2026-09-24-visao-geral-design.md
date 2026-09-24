# Ledgr — Visão geral (home do app)

## Contexto

Pedido de 24/09/2026: "uma tela de visão geral, como um menu home", com boas
práticas e no estilo do app. O export do Claude Design não tem essa tela (as telas
são landing, login, onboarding, dashboard, conciliação, galeria, mapa, detalhe,
fechamento, histórico e assinatura). Por isso ela é montada com peças e textos que
já existem, e só com dado real.

## O que a tela responde

Referências de mercado para a home de um produto financeiro: o dashboard do Xero
("reconcile N items"), a Home do Stripe (números e tendência), o "Início" de ERPs
brasileiros (atalho para a próxima ação). Quatro perguntas, nesta ordem:

1. **Onde o mês está?** "6 de 12 lançamentos conciliados", barra de progresso,
   o valor em aberto e a última conciliação (quando, quais arquivos, link).
2. **O que pede decisão?** "Pede sua atenção": o que está em aberto agrupado pelo
   rótulo do selo, com quantidade e valor; cada linha abre direto o primeiro caso.
   No fim, os arquivos da última conciliação com linhas que o parser não leu.
3. **Está melhorando?** O gráfico de taxa de match do histórico.
4. **O que aconteceu por último?** As cinco execuções mais recentes, com link para
   o histórico.

## Decisões

1. **Rota `/visao-geral`, primeiro item do menu (ícone `House`) e destino do login.**
   "Conciliações" continua em `/dashboard`. O cadastro segue indo para o primeiro
   upload, que é o próximo passo de quem acabou de chegar.

2. **Server Component com `loading.tsx`**, como o histórico. Uma action nova,
   `carregarVisaoGeral`, faz uma ida a `/execucoes`, depois as linhas da mais
   recente e a situação dos dois arquivos dela em paralelo. Só dos dois: a tela de
   extratos consulta todos os arquivos, uma chamada por arquivo, o que é caro demais
   para abrir a home. Se o detalhe de um arquivo falhar, a tela abre sem aquele aviso.

3. **Pendências agrupadas pelo rótulo do selo**, então "sem correspondência" se
   divide no lado que falta (banco ou sistema): são trabalhos diferentes. Ordem:
   terracota (custa dinheiro), ouro (incompleto), neutro (já explicado) — a régua
   das cores de status —, e no mesmo tom, o que deixa mais dinheiro em aberto antes.

4. **Sem "R$ 0".** Mesmo valor em outra data não deixa dinheiro em aberto: a linha
   mostra só a quantidade. Pelo mesmo motivo, com tudo casado ou só datas trocadas,
   o estado diz "Nenhum valor em aberto" — e não "nada em aberto" com um item
   pedindo revisão logo abaixo.

5. **A linha inteira é o link.** O "Revisar" no fim é só texto dentro dele; no
   celular some. Três links soltos chamados "Revisar" seriam indistinguíveis para o
   leitor de tela.

6. **O gráfico do histórico virou componente** (`historico/grafico.tsx`), usado nas
   duas telas. O histórico não mudou.

7. **Sem execução, os primeiros passos.** Os três passos e as dicas vêm do
   onboarding do design (`ONB` em `Ledgr.dc.html`), com os numerais romanos dele;
   o que no design era cadastro de empresa e banco virou upload, que é o que existe.

8. **Fora de propósito:** avisos (são mock e já estão na barra superior), números
   inventados, e atalhos que repetiriam o menu.

## Verificado no navegador (backend falso)

- **Com dados, 1280px, tema escuro:** estado "6 de 12", "R$ 5.799 em aberto",
  barra de progresso; sete itens em "Pede sua atenção", do risco à tarifa, mais
  "2 linhas em erp-setembro-v2.csv"; gráfico com quatro execuções; atividade com
  quatro linhas; "Visão geral" aceso no menu; sem rolagem lateral.
- **375px:** colunas empilhadas, sem rolagem lateral.
- **Sem execução:** mascote, "Nenhum extrato por aqui ainda.", passos I, II e III,
  "Fazer o primeiro upload".
- **Backend fora:** "Não foi possível carregar a visão geral. Recarregue a página e
  tente de novo.", com o menu no lugar.
