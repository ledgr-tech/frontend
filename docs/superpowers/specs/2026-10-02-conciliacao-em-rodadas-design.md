# Ledgr — Conciliação em rodadas, com conferência e justificativa

## Contexto

Pedido de 02/10/2026, depois do status no eixo da Comparação direta. O fluxo que o
produto quer:

1. A pessoa sobe os extratos e o Ledgr aponta as divergências.
2. Ela confere cada uma e corrige no sistema de gestão o que precisa.
3. Sobe de novo o extrato do sistema, e o Ledgr concilia outra vez.
4. O resultado aparece **na mesma tela** daquela conciliação.
5. O que continuar divergindo e não for corrigido, ela **justifica**, e a
   justificativa fica registrada.

Como está hoje:

- Cada extrato do sistema enviado vira outro par, com outra URL
  (`/conciliacoes/{banco}?sistema={sistema}`). Não há "a conciliação de setembro".
- Conciliar o mesmo par de novo reescreve as linhas: o id de cada linha muda.
- O backend não tem rota para gravar nada numa linha. "Fechar mês" e "aceitar o
  valor do banco" ainda são do mock, e a tela as esconde com dado do backend.
- O design (`Ledgr.dc.html`, tela "Trilha de auditoria") já previa o registro:
  quando, quem, lançamento, decisão, justificativa em texto livre, e a regra *"O
  registro é imutável: uma correção posterior gera um novo evento em vez de apagar
  o anterior."*

## Decisões

1. **A conciliação é o extrato do banco.** O banco é a fonte da verdade e não
   muda entre as rodadas; cada extrato do sistema conciliado com ele é uma
   **rodada**. A URL da tela continua a do extrato do banco. Considerados e
   descartados: uma entidade "conciliação do mês" no backend (mais flexível,
   permite trocar o banco, mas muda o backend e todas as URLs) e guardar as
   marcações no navegador (sem registro, sem equipe, perde ao trocar de máquina).
   Suposição: uma conta bancária tem um sistema de gestão por mês, e o envio novo
   do extrato do sistema substitui o anterior.
2. **Rodada N é o N-ésimo extrato do sistema conciliado com aquele extrato do
   banco**, pela primeira execução de cada um. Conciliar o mesmo par de novo
   refaz a rodada, não cria outra.
3. **Cada linha divergente está numa de três situações**, além do "Bate" do motor:

   | Situação | Significa | Na rodada seguinte |
   |---|---|---|
   | A conferir | ninguém olhou | — |
   | Conferida | "já olhei, vou corrigir no sistema" | se bateu, vira Bate; se continua divergindo, **volta para A conferir**, com o aviso "continua divergindo" |
   | Justificada | "não vai ser corrigida, e o motivo é este" | continua justificada |

   A conferência é uma promessa de corrigir: se não resolveu, a linha volta a
   chamar atenção. A justificativa é uma decisão: vale até alguém desfazê-la.
4. **Justificada não é resolvida, mas libera o fechamento.** O mês fica pronto
   para fechar quando toda linha está Bate (exato ou na tolerância) ou
   Justificada, e os arquivos foram lidos por inteiro. Nas contagens e
   relatórios, justificadas aparecem à parte, nunca somadas às batidas.
5. **O status do motor não muda.** A linha continua "Valor diverge" no dado;
   "Justificada" é a decisão sobre ela. A tela mostra "Justificada" no eixo, e o
   balão diz "Valor diverge na mesma data · justificada". Os relatórios por
   categoria não perdem a categoria.
6. **Registro imutável, justificativa em texto livre e obrigatória.** Conferir,
   desfazer a conferência, justificar e desfazer a justificativa são eventos com
   autor, horário, rodada e texto. Desfazer gera um evento novo e a linha volta
   para A conferir.
7. **A chave da linha, estável entre rodadas.** Com lançamento no banco, o id
   dele (o extrato do banco é o mesmo em todas as rodadas). Sem lançamento no
   banco, data + valor + descrição do lançamento do sistema, normalizados, mais a
   ordem de aparição entre os iguais: dois "Falta no banco" idênticos não podem
   dividir a mesma justificativa.

## A tela

- **Cabeçalho:** a rodada no contexto ("rodada 2 · erp-setembro-v2.csv, 24/09
  14:02") e o botão "Enviar nova versão do extrato do sistema".
- **Enviar nova versão:** janela na própria tela, só com o arquivo do sistema, e
  o andamento (enviando, lendo, conciliando), com os mesmos erros de leitura da
  tela de nova conciliação. No fim, a tela recarrega já na rodada nova, sem trocar
  de URL.
- **Faixa do que mudou**, da rodada 2 em diante: "Desde a rodada 1: 4 passaram a
  bater · 2 continuam divergindo · 1 nova divergência". "Continuam divergindo"
  conta toda linha divergente nas duas rodadas; o ↻ do eixo marca só as dessas
  que tinham sido conferidas.
- **O eixo do status, por linha** (revisto em 03/10: a conferência saiu do eixo para uma
  coluna própria no fim da linha, e o status ficou alinhado à esquerda; a caixa ao lado
  do selo parecia "selecionar a linha" e entortava o eixo. Em 06/10 o status voltou ao
  centro do eixo: sem a caixa, nada mais o tira do meio):
  - Bate: como hoje, sem círculo.
  - A conferir: círculo vazio e selo na cor da categoria.
  - Conferida: círculo preenchido com ✓, selo neutro, a linha apagada.
  - Continua divergindo: o ↻ dourado dentro do círculo vazio; a dica diz "Conferida
    na rodada 1, continua divergindo".
  - Justificada: selo neutro "Justificada", sem círculo; o balão traz o texto, quem
    e quando.
- **O círculo** é um botão de verdade ("Marcar Boleto Aço Norte como conferida"),
  alcançável por teclado, na coluna "Conferida" (cabeçalho com ✓), depois da folha do
  sistema. Só nas linhas divergentes; a coluna só existe onde dá para decidir.
- **Justificar** fica na janela da linha (o clique; o balão do hover não aceita
  clique): campo de texto obrigatório, o aviso "Fica no registro com o seu nome e
  o horário. Desfazer depois gera um novo registro.", e o botão "Justificar". Com a
  linha justificada, a janela mostra a justificativa e "Desfazer justificativa".
- **Detalhe da linha:** o "Histórico do lançamento" lista os eventos —
  "Divergência apontada (rodada 1)", "Conferida por Eduardo", "Continua
  divergindo (rodada 2)", "Justificada por Eduardo: juros de dois dias de atraso…".
- **Filtros:** Todos · Só revisão · Justificadas. "Só revisão" passa a ser o que
  ainda impede o fechamento: A conferir e Conferidas. À direita, "1 de 4
  conferidas".
- **Fechamentos e visão geral:** o mês fica pronto com tudo Bate ou Justificada.
  O painel do mês mostra as justificadas como um passo próprio.

## Parte A — rodadas, só com as rotas de hoje

Funciona de verdade com o backend atual. Vale para conciliação do backend: a do
mock não tem execuções, fica sempre na rodada 1, sem faixa nem botão de nova
versão.

- **A rodada atual** sai de `/execucoes`: as execuções daquele extrato do banco,
  agrupadas pelo extrato do sistema, a mais recente por último. A URL só com o
  banco abre a rodada mais recente. ponytail: a tela procura nas primeiras páginas
  de `/execucoes` (as rodadas de um extrato são recentes entre si); um filtro
  `?extrato_banco_id=` no backend tira essa busca.
- **URL de rodada antiga** (`?sistema=` de uma rodada passada) mostra aquela
  rodada com o aviso "Rodada 1 de 2 · ver a mais recente", sem nenhuma ação.
- **Links** de Fechamentos, visão geral e painel saem das execuções vigentes, então
  o `?sistema=` deles já é o da rodada mais recente; o Histórico e Extratos
  continuam apontando para a rodada daquela execução, e uma rodada passada abre
  com o aviso de rodada antiga.
- **Uma rodada só por extrato do banco nas contagens.** Fechamentos, visão geral
  e Extratos somam hoje cada par com `atual: true`; a primeira versão do extrato
  do sistema também é `atual` do par dela e entraria em dobro. Passam a contar só
  a rodada mais recente de cada extrato do banco.
- **Enviar nova versão** usa `enviarExtrato`, `situacaoDoExtrato` e
  `conciliar(banco, novoSistema)`, como a tela de nova conciliação.
- **O que mudou** compara a rodada atual com a anterior pela chave da decisão 7:
  carrega as linhas da anterior (`carregarConciliacao(banco, sistemaAnterior)`),
  só quando ela existe.

## Parte B — conferência e justificativa

Depende do backend guardar as decisões. Contrato proposto, para o backend:

- Em cada item de `GET /conciliacoes/{extrato_banco_id}`:

  ```json
  {
    "chave": "6b1d2e7a-3c4f-4a5b-9d8e-0f1a2b3c4d5e",
    "decisao": {
      "tipo": "justificada",
      "texto": "Juros de dois dias de atraso, lançados como despesa financeira.",
      "autor": "Eduardo Sichelero",
      "em": "2026-09-30T10:12:00-03:00",
      "rodada": 2
    },
    "eventos": [
      { "tipo": "conferida", "autor": "Eduardo Sichelero", "em": "2026-09-24T15:40:00-03:00", "rodada": 1, "texto": null },
      { "tipo": "justificada", "autor": "Eduardo Sichelero", "em": "2026-09-30T10:12:00-03:00", "rodada": 2, "texto": "Juros de dois dias de atraso, lançados como despesa financeira." }
    ]
  }
  ```

  `chave` é o id do lançamento do banco (aqui) ou, sem ele, a chave da decisão 7.
  `decisao` é a última decisão em vigor, ou `null`. `eventos` pode vir só no
  detalhe.
- `POST /conciliacoes/{extrato_banco_id}/decisoes` com
  `{ "chave", "tipo": "conferida" | "conferencia_desfeita" | "justificada" | "justificativa_desfeita", "texto"? }`.
  Só acrescenta; `justificada` exige texto; só vale em linha divergente. Responde
  a decisão em vigor.
- Em `/execucoes`, a contagem `justificadas`, para Fechamentos saber que o mês
  pode fechar.

Enquanto o backend não entrega, a regra do projeto: a tela não finge que salva.

- **Conciliação do mock:** o fluxo inteiro em memória, como o "Fechar mês" de
  hoje, para ver e testar.
- **Conciliação do backend:** a caixa e "Justificar" só aparecem quando os itens
  trazem o campo `decisao` (mesmo `null`). A tela liga sozinha quando o backend
  entregar.
- **"Continua divergindo"** é derivado na tela: linha divergente cuja decisão em
  vigor é "conferida" de uma rodada anterior.
- **Falhas:** a caixa volta ao estado anterior e diz o motivo; a justificativa
  mantém o texto no campo; 401 vai para o login; se outra rodada entrou no meio
  (a chave não existe mais), a tela recarrega e avisa.

## Fora do escopo

- Trocar o extrato do banco numa rodada; mais de um sistema por conta no mês.
- A tela "Trilha de auditoria" do design (os eventos desta spec a alimentam).
- Aceitar o valor do banco e ignorar (continuam do mock), ações em lote e atalhos
  de teclado.
- Levar uma justificativa para o mês seguinte (divergência crônica).

## Testes

- **Unidade:** a chave da linha (id do banco; data + valor + descrição; a ordem
  entre iguais), a comparação entre rodadas, a situação de cada linha (a tabela
  da decisão 3) e a regra de pronto para fechar.
- **Tela:** as situações no eixo; conferir e desfazer; justificar (texto
  obrigatório) e desfazer; filtros e contagens; o aviso de rodada antiga; a
  janela de nova versão com as actions mockadas; e, com dado do backend sem
  `decisao`, nenhuma caixa nem "Justificar".
- **Navegador:** 1440px, 375px e tema escuro, com uma segunda rodada no backend
  de demonstração.

## Para o backend (só registrar, sem abrir issue daqui)

1. Decisões por linha com histórico imutável e a rota de gravar.
2. A chave estável nos itens.
3. `justificadas` nas contagens de `/execucoes`.
4. Filtro `?extrato_banco_id=` em `/execucoes`.
