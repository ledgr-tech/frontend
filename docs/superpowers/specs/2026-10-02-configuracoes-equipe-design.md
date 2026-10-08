# Ledgr — Configurações: equipe, regras da conciliação, segurança e dados

## Revisão de 08/10/2026: conta única no MVP

O backend respondeu a esta especificação em 07/10 (`ledgr-docs`,
`07-tecnico/frontend/respostas-do-backend-aos-pedidos-do-front.md`), com as decisões
de Eduardo de 05 e 06/10. O que vale agora, no lugar do que está abaixo:

1. **Conta única até o congelamento de 28/10.** Saem os três papéis, `lib/papeis.ts`,
   `SoQuemPode`, a Equipe, os convites e a página `/convite`. O `GET /me` não tem
   `papel`, e todo mundo é administrador. Também fica para depois o "Exportar todos
   os dados".
2. **Só a tolerância de data é editável**, de 0 até `tolerancia_dias_maximo` (hoje 5),
   pelo `GET` e `PUT /empresa/configuracoes` (backend #85). Tolerância de valor e
   semelhança da descrição saem (ADR-006 e ADR-008): o backend recusa as duas com
   422. Também sai a parte de "as regras em cada rodada", que eram essas duas; a
   rodada já mostra a tolerância de data que usou.
3. **Continuam escondidos:** "Sair de todos os aparelhos" (#75, decisão de ADR
   pendente), trocar o e-mail (#66, Sprint 7) e excluir a conta (#68, bloqueada pela
   definição jurídica da LGPD).

O que já foi feito desta especificação:

- **`GET /me`** (ledgr-tech/frontend#101): `contaDaSessao` lê a razão social e os
  `metodos_login` numa chamada por carregamento do layout; sem `"senha"`, a troca de
  senha some.
- **A tolerância de data editável** (o PR desta revisão), na seção Conciliação: campo
  com − e +, salvar por botão, "Descartar", quem mudou por último e o texto de depois
  de salvar, como descrito em "Conciliação" abaixo. Sem a rota, fica a tolerância da
  última conciliação para leitura; com outra falha, "Não foi possível carregar agora."
  e "Tentar de novo". Com um campo só, a pergunta ao fechar a janela com mudança
  pendente ficou de fora: fechar descarta, e a janela lê o valor salvo de novo.

O resto do documento fica como registro do que foi proposto. Volta a valer, em
partes, quando as decisões acima mudarem.

## Contexto

Pedido de 02/10/2026: "em relação à tela de configuração, sinto que faltam coisas
importantes nela". A janela de hoje (`app/(app)/configuracoes.tsx`, desenhada em
`2026-09-26-historico-configuracoes-assistente-design.md`) tem Conta, Aparência,
Conciliação (só a tolerância de data da última conciliação, para leitura),
Atalhos, Privacidade e Sobre. Faltam as coisas de que uma empresa precisa para usar
o Ledgr com mais de uma pessoa e com regras próprias.

O que foi escolhido, nesta ordem:

1. **Entram Equipe e Conciliação, depois Segurança e Dados.** Assinatura continua
   com tela própria.
2. **Três papéis:** Administrador, Analista e Contador. O contador é o escritório
   de contabilidade de fora: vê tudo, exporta, confere e justifica, mas não mexe
   na equipe, nas regras nem na assinatura.
3. **As regras novas valem só para as próximas conciliações.** As que já rodaram
   continuam com as regras de quando rodaram; nada é recalculado sozinho.
4. **Abordagem A:** a tela fica pronta agora e cada parte liga sozinha quando o
   backend tiver a rota. Os contratos abaixo são propostas ao backend. Pelo
   escopo deste repositório, o front não edita issue nem cartão do backend: os
   pedidos seguem como proposta, citando a issue que já existe.

A regra de sempre continua valendo: só dado real, e nenhum controle que finja
salvar o que o backend não guarda.

**Depende do PR #93** (conciliação em rodadas) nas partes que tocam a comparação
e o histórico: a faixa da rodada e o CSV do histórico.

## Papéis

| Ação | Administrador | Analista | Contador |
|---|---|---|---|
| Ver tudo e exportar o CSV de uma conciliação | ✓ | ✓ | ✓ |
| Conferir e justificar | ✓ | ✓ | ✓ |
| Subir extrato, conciliar, enviar nova versão | ✓ | ✓ | — |
| Equipe (convidar, mudar papel, remover) | ✓ | — | — |
| Regras da conciliação, assinatura | ✓ | — | — |
| Exportar todos os dados da empresa | ✓ | — | — |

1. **De onde vem o papel:** `GET /me`, campo `papel` (`administrador`,
   `analista` ou `contador`). Sem o campo, todo mundo é administrador, então nada
   muda hoje. Quem se cadastra pelo `/register` é o administrador da empresa nova.
2. **Uma chamada ao `/me` só.** `razaoSocialDaEmpresa` (em `app/(auth)/acoes.ts`)
   vira `quemSouEu()`, que devolve `{ razaoSocial, cnpj, papel, metodosLogin }`.
   O `Shell` põe o resultado no contexto, onde a razão social já está hoje.
3. **Uma regra em um lugar:** `lib/papeis.ts`, com `pode(papel, acao)`. Toda tela
   pergunta a ela, nunca compara o nome do papel solta.
4. **O front esconde, o backend garante.** O app não oferece o que vai ser
   recusado: some o "Nova conciliação" (menu e Visão geral), o "Enviar nova
   versão" (comparação) e o envio de extrato (Extratos) para o contador; somem os
   controles da Equipe, a edição das regras e o "Exportar todos os dados" para
   quem não é administrador. Se mesmo assim o backend responder 403, a tela diz
   "Seu papel não permite esta ação." e relê o `/me`, porque o papel pode ter
   mudado no meio do caminho.

## Como cada parte liga

1. **Equipe e Conciliação** consultam a própria rota quando a janela abre.
   - 404 ou 405: a seção explica o que vai fazer e não mostra botão nenhum.
   - Outra falha: "Não foi possível carregar agora." e "Tentar de novo".
   - Resposta certa: a seção completa.
2. **Ações de um botão só** ("Sair de todos os aparelhos" e "Exportar todos os
   dados") tentam a rota no clique e, sem ela, dizem "Ainda não disponível: o
   servidor do Ledgr ainda não tem esta função.", a mesma frase que o
   `mensagemDaConta` já usa para o "Trocar senha".
3. Tudo passa por Server Actions e `lib/backend.ts`, como hoje. A exceção é o
   arquivo da exportação, que volta por um Route Handler (ver Dados e
   privacidade).

## Contratos propostos ao backend

| Rota | Para quê | Issue |
|---|---|---|
| `GET /me` com `razao_social`, `cnpj`, `papel` e `metodos_login` (lista: `"senha"`, `"google"`) | Empresa, papel e como a pessoa entra | já proposta |
| `GET /empresa/usuarios` → `{ usuarios: [{ id, nome, email, papel }], convites: [{ id, email, papel, criado_em, expira_em }] }` | A lista da equipe | #69 |
| `POST /empresa/convites` com `{ email, papel }`; `DELETE /empresa/convites/{id}` | Convidar e cancelar convite. 409 com o `detail` que a tela mostra | #69 |
| `PATCH /empresa/usuarios/{id}` com `{ papel }`; `DELETE /empresa/usuarios/{id}` | Mudar papel e remover. 409 quando a empresa ficaria sem administrador | #69 |
| `POST /convites/consultar` com `{ token }`, sem login → `{ razao_social, email, papel }` | A página do convite mostra para onde a pessoa está entrando | nova |
| `POST /convites/aceitar` com `{ token, nome, senha }`, sem login | O convidado cria a conta | #69 |
| `GET` e `PUT /empresa/configuracoes` com `tolerancia_dias`, `tolerancia_valor`, `similaridade_minima`, e na leitura `atualizado_por` e `atualizado_em` (opcionais) | As regras do motor. O `PUT` é só do administrador (403) e recusa valor fora do limite com 422 | #22 e a tabela `configuracoes` |
| `tolerancia_valor` e `similaridade_minima` em cada item de `/execucoes` | A comparação diz com que regras a rodada rodou (`tolerancia_dias` já vem) | nova |
| `POST /me/sessoes/encerrar` | Sair de todos os aparelhos | #75 |
| `GET /empresa/exportacao` → `application/zip` | Exportar todos os dados, só administrador | #68 |
| `DELETE /me` (já proposta) com 409 quando quem sai é o único administrador e há outras pessoas | Excluir a conta sem deixar a empresa sem dono | #68 |

Formatos: `tolerancia_valor` em reais como texto decimal (`"0.05"`), como o
`percentual_acerto`; `similaridade_minima` de 0 a 100. O adaptador aceita texto
ou número nos dois, como já faz com o `percentual_acerto`.

Os tokens de convite seguem o desenho da redefinição de senha: vão depois do `#`,
nunca no endereço nem no registro do servidor, e no corpo das chamadas.

## A janela

A ordem das seções no menu da janela: Conta, Equipe, Aparência, Conciliação,
Segurança, Atalhos de teclado e Dados e privacidade, no grupo "Configurações";
Sobre, no grupo "Ledgr". A busca de hoje acha as linhas novas também.

### Conta

Fica com quem você é: o e-mail (trocar continua por e-mail ao suporte, até o
`POST /me/email`), a empresa (razão social e CNPJ, do `/me`), o seu papel com uma
frase do que ele permite, e "Sair desta conta". A senha vai para Segurança; a
exclusão da conta, para Dados e privacidade.

### Equipe

Seção nova, logo abaixo de Conta. Texto de abertura: "Quem tem acesso à
<razão social>. Cada pessoa entra com o próprio e-mail e senha."

1. **Pessoas**, com nome, e-mail e papel.
   - A sua linha leva a marca "você", sem seletor e sem "Remover". Para sair, há
     o "Excluir conta".
   - O administrador troca o papel das outras pessoas pelo seletor, na hora.
   - "Remover" pede confirmação na própria linha. Enquanto o backend não cortar o
     acesso de quem já entrou (#75), a confirmação diz: "Ela perde o acesso em até
     7 dias."
   - 409 de empresa sem administrador: "A empresa precisa de pelo menos um
     administrador."
2. **Convites pendentes**, com e-mail, papel, "enviado em" e "vale até", e
   "Cancelar". Reenviar é cancelar e convidar de novo.
3. **Convidar pessoa:** e-mail e papel, cada papel com a frase do que permite
   (Administrador: "tudo, inclusive equipe, regras e assinatura"; Analista: "sobe
   extratos, concilia, confere e justifica"; Contador: "vê tudo, exporta, confere
   e justifica"). Depois de enviar: "Convite enviado para <e-mail>. O link vale
   por 7 dias." Os 409 do backend aparecem como vierem; os esperados são "Esse
   e-mail já tem acesso à empresa." e "Esse e-mail já tem conta no Ledgr, em
   outra empresa." (uma conta pertence a uma empresa só, como o backend já
   funciona).
4. **Analista e contador** veem as pessoas e os convites sem os controles, com
   "Só administradores convidam e mudam papéis."
5. **Sem a rota:** "Aqui você vai convidar a sua equipe e o seu contador, cada um
   com o próprio acesso. Ainda não está disponível."

### A página `/convite`

Fora do app, no grupo `(auth)`, com o desenho da `/redefinir-senha`:

1. Lê o token depois do `#` e apaga o fragmento da barra de endereço.
2. Chama `POST /convites/consultar` antes de pedir qualquer coisa. Convite vencido
   ou já usado: "Este convite expirou ou já foi usado. Peça um novo a quem
   convidou." Sem formulário.
3. Convite válido: "Você foi convidado para a <razão social> como <papel>" e o
   e-mail do convite, sem edição. A pessoa define nome, senha e a repetição da
   senha, com as regras do cadastro (8 a 72 caracteres).
4. `POST /convites/aceitar` e, dando certo, já entra no app (`entrar`, como o
   cadastro faz).

### Conciliação

Texto de abertura: "Como o motor casa os lançamentos do banco com os do sistema.
As mudanças valem a partir da próxima conciliação."

1. **Regras do motor**, só o administrador edita:
   - Tolerância de data: até quantos dias de diferença dois lançamentos de mesmo
     valor ainda casam. Campo numérico com − e +, em dias.
   - Tolerância de valor: a diferença que ainda conta como "Bate na tolerância".
     Zero exige o valor exato. Em reais.
   - Semelhança da descrição: quanto as descrições precisam se parecer para o
     motor escolher entre lançamentos de mesmo valor. Em porcentagem.
2. **Salvar é por botão.** O rodapé diz quantas alterações não foram salvas e,
   quando o backend mandar, quem mudou por último e quando. "Descartar" volta
   aos valores salvos. Fechar a janela com alteração pendente pergunta
   "Descartar as mudanças nas regras?". Depois de salvar: "Regras salvas. Valem a
   partir da próxima conciliação; as que já rodaram continuam com as regras de
   quando rodaram."
3. **Limites:** a tela barra só o óbvio (número negativo, mais de 100%). O limite
   de verdade é do backend: o 422 aparece embaixo do campo.
4. **Analista e contador** veem os valores sem os controles, com "Só
   administradores mudam as regras."
5. **Sem a rota:** fica como hoje, com a tolerância de data da última conciliação
   para leitura e a frase "Ajustar as regras chega quando o backend tiver a rota."
6. **Continuam**, como informação: "Fonte da verdade: extrato do banco" e
   "Explicações por IA".
7. **Nas rodadas:**
   - A faixa da rodada, na comparação, ganha "Regras desta rodada: data até 2
     dias · valor exato · descrição 80%", com os campos que `/execucoes` mandar
     (hoje, só a data).
   - Quando as regras atuais diferem das da rodada: "As regras mudaram depois
     desta rodada. Elas valem na próxima."
   - O CSV do histórico ganha "Tolerância de valor" e "Semelhança" quando os
     campos vierem.
8. **"Bate na tolerância" passa a valer para data ou valor.** O balão da linha
   diz qual foi ("Valor R$ 0,03 diferente, dentro da tolerância"), tirado dos dois
   lados da linha, sem campo novo. O rótulo longo de `match_tolerancia` deixa de
   ser "Match por tolerância de data".

### Segurança

Seção nova, igual para os três papéis: cada pessoa cuida da própria conta.

1. **Senha:** o "Trocar senha" de hoje, sem mudança.
2. **Como você entra:** os métodos de `metodos_login` ("E-mail e senha",
   "Google"), só leitura. Sem o campo, "E-mail e senha".
3. **Sessão:** a regra de hoje (7 dias, ou até fechar o navegador sem "Manter
   sessão ativa") e "Sair de todos os aparelhos". A confirmação fica na própria
   linha: "Você sai em todos os aparelhos, inclusive neste." Depois chama
   `POST /me/sessoes/encerrar` e volta ao login. A rota só cumpre o que promete se
   o backend recusar os tokens anteriores, que é a #75.

### Dados e privacidade

Substitui a seção Privacidade.

1. **Exportar todos os dados**, só administrador: um `.zip` com os extratos lidos,
   as conciliações, as decisões e o histórico. Como o CSV da conciliação, volta
   por um Route Handler (`app/api/empresa/exportacao/route.ts`) que chama
   `baixarDoBackend` e repassa os bytes sem decodificar. O botão diz "Preparando o
   arquivo…" enquanto espera; o arquivo sai como `ledgr-<CNPJ>-<AAAA-MM-DD>.zip`.
   Analista e contador veem "Peça a um administrador."
2. **Excluir conta**, no fim da seção, separada do resto, com o texto pelo papel:
   - Analista e contador: "Apaga só o seu acesso. Os dados da empresa continuam."
   - Administrador: "Se você for o único administrador, apaga também os dados da
     empresa: extratos, conciliações e histórico."
   - Até o `DELETE /me` (#68): "Pedir por e-mail", como hoje. Com a rota, pede a
     senha (o `excluirConta` já pronto). O 409 de único administrador com outras
     pessoas: "Passe a administração para outra pessoa na Equipe antes de sair."
3. **Continuam** as explicações de hoje (sessão protegida; IA com e-mail, CNPJ,
   CPF, telefone e números longos mascarados) e um link para a Política de
   privacidade.
4. **A política (`/privacidade`) muda junto, uma rota por vez:** "Por enquanto,
   os pedidos são feitos por e-mail" passa a dizer que a exportação e a exclusão
   se fazem pelas Configurações só quando a rota de cada uma existir.

## Erros

| Resposta | O que a tela faz |
|---|---|
| 401 | Volta ao login, como hoje |
| 403 | "Seu papel não permite esta ação." e relê o `/me` |
| 404 ou 405 | Seção explicativa, ou "Ainda não disponível…" nos botões |
| 409 e 422 | O `detail` do backend, perto do campo ou da linha |
| 429 | "Muitas tentativas. Espere um minuto e tente de novo." |
| Rede ou 5xx | "Não foi possível salvar agora. Tente de novo em instantes." |

A conta de demonstração continua recusada no servidor para tudo que altera a
conta (`naConta`), e agora também para convidar, mudar papel e salvar regras.

## Fora desta especificação

- Vincular conta Google: depende da decisão da #73.
- Cortar na hora o acesso de quem foi removido: depende da #75.
- Verificação em duas etapas e a lista de aparelhos conectados: o backend não tem
  nada disso.
- Recalcular uma rodada com as regras novas: por decisão, as regras valem só para
  as próximas.
- Regras diferentes por banco ou por conta, e exportação demorada entregue por
  e-mail.

## Testes

- `lib/papeis.ts`: a tabela de papéis inteira, linha por linha.
- Janela, por papel (administrador, analista, contador, e sem `papel`): o que
  aparece e o que some em cada seção, com as actions simuladas, como os testes de
  `configuracoes` fazem hoje.
- Cada seção com rota ausente (404), falha (500) e resposta certa.
- Equipe: convidar, cancelar, mudar papel, remover com confirmação, e os 409.
- Conciliação: alteração pendente, descartar, salvar, a pergunta ao fechar, o 422
  embaixo do campo, a faixa "Regras desta rodada" e o aviso de regras mudadas.
- `/convite`: o fragmento apagado, convite vencido sem formulário, aceitar e
  entrar.
- Exportação: o Route Handler repassa os bytes e o nome do arquivo, como o teste
  do CSV da conciliação.
- Excluir conta: o texto de cada papel e o 409.
- Esconder por papel fora da janela: menu, Visão geral, Extratos e comparação.
- No navegador, contra um backend de demonstração com essas rotas (fora do
  repositório): os três papéis, a 1440px e a 375px, claro e escuro.

## Documentação

- `CLAUDE.md`, em "Backend status": os papéis, as rotas das Configurações e o que
  fica escondido até cada uma existir.
- `ponytail:` ao lado de cada ponto que liga com a rota nova, como o resto do app.
