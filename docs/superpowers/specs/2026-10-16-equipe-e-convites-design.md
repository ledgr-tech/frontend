# Ledgr — Equipe e convites

## Contexto

A decisão de 13/10 (ledgr-docs, `07-tecnico/frontend/integracao-backend-sprint5.md`)
trouxe os convites de volta ao MVP, e a reunião de 14/10 os pôs na fila do front
para antes do congelamento de 02/11. O backend já tem tudo em `develop` (issue
#69, ADR-015; aceite com Google pela #73). O front ainda não tem tela.

Esta especificação substitui a parte de Equipe e convites de
`2026-10-02-configuracoes-equipe-design.md`. Aquela previa três papéis
(Administrador, Analista, Contador) e mudar papel; o backend fez um papel só.

Decidido com Eduardo em 16/10:

1. **Sem trava por plano.** A ata põe convites no plano Avançado, mas o backend
   não limita por plano e a cobrança ainda não existe. A trava entra quando o
   backend tiver cota por plano.
2. **O aceite com Google entra junto**, atrás do mesmo `NEXT_PUBLIC_LEDGR_GOOGLE`
   do login.
3. **A equipe é uma seção de Configurações**, logo abaixo de Conta, não uma página
   no menu.

## O que o backend oferece

Um papel só: o **administrador**, quem cadastrou a empresa pelo `/register`.
`GET /me` traz `administrador: bool`.

| Rota | Quem | Respostas que a tela trata |
|---|---|---|
| `GET /empresa/usuarios` → `{ itens: [{ id, nome, email, administrador, criado_em }] }` | todos da empresa | — |
| `GET /empresa/convites` → `{ itens: [{ id, email, criado_em, expira_em }] }` (só pendentes) | administrador | 403 |
| `POST /empresa/convites` com `{ email }` → o convite | administrador | 409 e-mail já tem conta no Ledgr; 429 com `Retry-After` (10 por hora por empresa); 503 e-mail desligado |
| `DELETE /empresa/convites/{id}` | administrador | 404 já não está pendente |
| `DELETE /empresa/usuarios/{id}` | administrador | 409 é o administrador; 404 |
| `POST /convites/consultar` com `{ token }`, sem login → `{ email, razao_social, expira_em }` | público | 400 convite inválido; 429 |
| `POST /convites/aceitar` com `{ token, nome, senha }`, sem login → `UsuarioResponse` (201) | público | 400; 409 e-mail já cadastrado; 422; 429 |
| `POST /convites/aceitar/google` com `{ token, id_token }`, sem login → `LoginResponse` (201) | público | 400; 409 e-mail do Google diferente do convidado, e-mail já cadastrado, ou conta Google já no Ledgr; 429 |

O que o backend garante e a tela só reflete:

- O convite vale 7 dias e uma vez só. Convidar de novo o mesmo e-mail cancela o
  pendente.
- O link chega por e-mail como `/aceitar-convite#token=...`: o token vai no
  fragmento e no corpo das chamadas, nunca no endereço nem nos registros.
- Remover corta o acesso na hora: as sessões são encerradas e toda rota responde
  401 com o token antigo. A pessoa removida continua com o nome no histórico de
  decisões. Não há reativação: um convite novo cria outro usuário.
- O administrador não pode ser removido, nem por ele mesmo.
- Em produção o e-mail está desligado (`EMAIL_HABILITADO`), então convidar
  responde 503 até a próxima release do backend ligar o envio.

## A seção "Equipe" em Configurações

Entre Conta e Aparência. A busca da janela acha os itens novos. Abertura:
"Quem tem acesso à <razão social>. Cada pessoa entra com o próprio e-mail."

### Pessoas

Lista de `GET /empresa/usuarios`, na ordem do backend (quem entrou primeiro).

- Cada linha: nome e e-mail. O administrador leva a marca "Administrador"; a
  própria linha leva "você".
- Para o administrador, as outras linhas têm "Remover". A confirmação fica na
  própria linha: "<Nome> perde o acesso na hora. As decisões que registrou
  continuam no histórico com o nome dela." com "Remover" e "Cancelar".
- Removida, a linha sai da lista.

### Convites pendentes (só o administrador)

Lista de `GET /empresa/convites`: e-mail, "enviado em <data>" e "vale até
<data>", com "Cancelar". Sem convites, a lista não aparece. Reenviar é convidar de
novo o mesmo e-mail.

### Convidar (só o administrador)

Campo de e-mail e "Enviar convite".

- Certo: "Convite enviado para <e-mail>. O link vale até <data do expira_em>." O
  campo limpa e o convite entra no topo da lista de pendentes.
- 409: "Este e-mail já tem conta no Ledgr."
- 429: "Limite de convites por hora atingido. Tente de novo em <N> minutos.", com
  o N arredondado para cima a partir do `Retry-After`; sem o cabeçalho, "Tente de
  novo mais tarde."
- 503: "O envio de convites está indisponível no momento."
- 422 ou e-mail mal formado: a validação de e-mail do cadastro, antes de enviar.

### Quem não é administrador

Vê só Pessoas, sem "Remover", e a frase "Só o administrador convida e remove
pessoas."

### De onde vem quem é administrador

`contaDaSessao` passa a devolver `administrador` do `GET /me`. Sem o campo
(backend antes da #69), vale `true`, como na conta única de hoje. Se uma ação
voltar com 403 (o papel mudou no caminho, o que hoje não acontece), a seção diz
"Só o administrador pode fazer isso." e recarrega.

### Carregar e falhar

- Ao abrir a seção: "Carregando a equipe…".
- 404 em `/empresa/usuarios` (backend sem a #69): "A equipe ainda não está
  disponível." e nenhum controle.
- Outra falha: "Não foi possível carregar agora." e "Tentar de novo", como na
  seção Conciliação.
- 401 em qualquer chamada: vai para o login. Assim quem foi removido com a página
  aberta sai na próxima ação.

## A página `/aceitar-convite`

No grupo `(auth)`, que é público (quem barra é o `(app)/layout.tsx`), com
`moldura-auth`, `campo-texto`, `mensagem-erro` e `validacao` do cadastro, e o
tratamento do token da `/redefinir-senha`.

1. **Ao abrir:** lê o token depois do `#`, apaga o fragmento da barra de
   endereço e chama `POST /convites/consultar`. Enquanto isso: "Conferindo o
   convite…".
2. **Inválido, vencido, usado ou cancelado (400), ou sem token:** "Este convite
   expirou ou já foi usado. Peça um novo a quem convidou." e um link para o
   login. Sem formulário.
3. **Válido:** título "Entrar na <razão social>", o e-mail convidado sem edição e
   "O convite vale até <data>". Depois:
   - "Aceitar com Google", só com `googleLigado()`, e um separador "ou";
   - nome, senha e repetir a senha, com as regras e mensagens do cadastro (8 a 72
     caracteres), e "Criar conta e entrar".
4. **Com senha:** `POST /convites/aceitar`; dando certo, `entrar` com o e-mail do
   convite e a senha nova, como o cadastro faz, e a Visão geral.
5. **Erros do aceite com senha:**
   - 409: "Este e-mail já tem conta no Ledgr. Entre com ela." e link para o login;
   - 400: a tela do item 2;
   - 429: "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
   - rede ou 5xx: "Não foi possível agora. Tente de novo em instantes."
6. **Quem abre o link conectado em outra conta:** "Você está conectado como
   <e-mail>. Para aceitar este convite, saia primeiro." e "Sair e continuar", que
   encerra a sessão e volta a `/aceitar-convite#token=...` com o mesmo token. O
   token fica só na memória da página nesse meio-tempo.

## O aceite com Google

1. "Aceitar com Google" chama a Server Action `aceitarConviteComGoogle(token)`:
   grava o token num cookie httpOnly `ledgr-convite-google` (1 hora, `sameSite:
   lax`, `secure` em produção, como o `ledgr-cadastro-google`) e chama
   `signIn("google", { redirectTo: "/visao-geral" })`.
2. Na volta, `aoVoltarDoGoogle` (`lib/login.ts`) olha esse cookie primeiro. Com
   ele, chama `POST /convites/aceitar/google` com o token e o `id_token`, apaga o
   cookie e, com o `LoginResponse`, devolve o mesmo `user` que o login pelo Google
   devolve hoje. Sem ele, segue o fluxo de hoje.
3. Recusas voltam a `/aceitar-convite?google=<motivo>`, com o cookie mantido para
   a página poder consultar o convite de novo (o fragmento já se perdeu na ida ao
   Google). Uma Server Action `conviteDoCookie()` faz essa consulta pelo servidor,
   sem expor o token ao navegador:
   - `email_diferente` (409 com o texto de e-mail diferente): "Entre no Google
     com <e-mail do convite> para aceitar." e o botão de novo;
   - `convite_invalido` (400): a tela do item 2, e o cookie é apagado;
   - `email_cadastrado` (409 e-mail já cadastrado ou conta Google já no Ledgr):
     o `detail` do backend e um link para o login;
   - `muitas_tentativas` e `falha`: as mensagens de `MENSAGEM_GOOGLE`.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `app/(app)/equipe/acoes.ts` (novo) | `carregarEquipe()` (usuários e, para o administrador, convites, em paralelo), `convidar`, `cancelarConvite`, `removerPessoa`. Os textos de 403, 409, 429 e 503 num mapa só. |
| `app/(app)/equipe/secao-equipe.tsx` (novo) | A seção inteira. `configuracoes.tsx` só a monta. |
| `app/(app)/configuracoes.tsx` | Monta a seção e põe os termos dela na busca. |
| `app/(auth)/acoes.ts` | `administrador` em `contaDaSessao`; `consultarConvite`, `aceitarConvite`, `aceitarConviteComGoogle`, `conviteDoCookie`. |
| `app/(auth)/aceitar-convite/page.tsx` e `formulario.tsx` (novos) | A página. |
| `lib/login.ts` | O desvio do convite em `aoVoltarDoGoogle`. |
| `lib/google.ts` | `COOKIE_CONVITE_GOOGLE` e os motivos novos. |
| `lib/adaptadores.ts` | `adaptarPessoa`, `adaptarConvite`, `adaptarConsultaConvite`. |
| `CLAUDE.md` | "Conta única" vira a regra do administrador e dos convites. |
| `2026-10-02-configuracoes-equipe-design.md` | Nota no topo apontando para esta. |

## Testes

- **Ações da equipe:** cada status vira o texto certo; 429 com e sem
  `Retry-After`; 404 de rota ausente; 401 vai para o login; quem não é
  administrador não chama `/empresa/convites`.
- **Seção:** o administrador vê convidar, pendentes, cancelar e remover; quem não
  é vê só a lista e a frase; a própria linha e a do administrador não têm
  "Remover"; a confirmação aparece na linha; convidar põe o convite no topo.
- **Página de aceite:** o fragmento é lido e apagado; convite inválido e falta de
  token não mostram formulário; a validação é a do cadastro; o aceite entra no
  app; o Google só aparece com a flag; conectado vê "Sair e continuar"; cada
  `?google=` mostra a sua mensagem.
- **`aoVoltarDoGoogle`:** com o cookie de convite chama a rota de convite, não a
  de login, e apaga o cookie; sem ele, nada muda.
- **Antes do commit:** `npm run test && npm run lint && npm run build`, com
  `/aceitar-convite` na tabela de rotas. Checagem visual com o backend local; sem
  e-mail ligado ali, o 503 da tela e um convite criado por script para o aceite.

## Fora do escopo

Outros papéis e mudar papel; trava por plano; reenviar num clique; "Excluir
conta" (outro item da fila, `DELETE /me`); trocar o e-mail da conta.
