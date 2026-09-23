# Integração com o backend — autenticação real, upload real e as 7 categorias

Data: 22/09/2026
Origem: `avaliacao-do-repositorio-frontend.md` (Rafael Klein, backend), `02-decisoes/05-contrato-jwt-empresa-id`, ADR-003.

## O problema

O relatório do time de backend abre assim: nenhuma tela do frontend chama a API.
Login, cadastro, upload e conciliação rodavam inteiros sobre `localStorage`. As
sprints 1 a 4 do backend estavam fechadas e inacessíveis.

A lista de prioridade do relatório era: (1) `.env.example`, (2) autenticação
real, (3) CORS no backend, (4) upload real com o campo `origem`, (5) o enum de
status com as 7 categorias reais.

Este spec cobre 1, 2, 4 e 5. O item 3 é do outro repositório.

## Decisões

### 1. O cookie do NextAuth **é** o token do backend

O contrato diz "JWT emitido pelo NextAuth, HS256, decodificado pelo PyJWT". O
detalhe que o contrato não menciona: **o NextAuth não emite isso por padrão.**
Ele criptografa o cookie de sessão (JWE `A256CBC-HS512`), não apenas assina. Um
backend com PyJWT e `algorithms=["HS256"]` não consegue ler esse cookie.

Então `jwt.encode` e `jwt.decode` estão trocados em `auth.ts`, por
`lib/token.ts`. O cookie passa a ser exatamente o JWT do contrato — e aí chamar
a API é só copiar o valor do cookie para o header, sem conversão nenhuma no
meio.

A alternativa seria assinar um segundo token a cada requisição, a partir da
sessão. Rejeitada: dois tokens com validades diferentes é mais coisa para
desencontrar, e o contrato fala de *um* token.

`lib/token.ts` é separado do `auth.ts` porque é a parte que precisa de teste. Se
um claim sair errado, nada funciona e o sintoma é um 401 sem pista nenhuma. Os
testes conferem alg, os quatro claims, `exp - iat = 7 dias`, e que token
assinado com outro segredo é recusado — que é literalmente o que acontece se o
`NEXTAUTH_SECRET` divergir entre a Vercel e o Railway.

### 2. Server Action, não rota proxy

A sessão de arquitetura decidiu "rota proxy interna com `getToken()`, o JWT
nunca exposto ao client". A propriedade exigida é essa última: o token não chega
ao JavaScript do navegador.

Server Action entrega a mesma propriedade com menos peça móvel — e sem abrir um
caminho genérico `/api/backend/*`, que repassaria qualquer rota para o backend,
inclusive as que ninguém revisou ainda. As três chamadas que o app faz estão em
`app/(app)/conciliacoes/acoes.ts`, cada uma com assinatura própria.

### 3. `LEDGR_API_URL`, sem `NEXT_PUBLIC_`

O relatório sugeria `NEXT_PUBLIC_API_URL`. Com o proxy decidido, o navegador
nunca fala com o backend direto — expor a URL ao client não traria nada e
abriria caminho para alguém tentar contornar o servidor.

### 4. As 7 categorias, e o que elas realmente significam

`StatusLinha` passou de 4 valores inventados para os 7 do backend. Mas a
tradução não é um-para-um, e a diferença importa para o produto:

**Só `match_exato` e `match_tolerancia` têm os dois lados.** As outras cinco
descrevem **um** lançamento que não casou. `classificar_divergencias` (issue
#24) sub-classifica cada sobra olhando o outro extrato, mas **não forma par**.
Ou seja, `divergente_valor` quer dizer "achei algum lançamento nesta data e o
valor não bate", não "estes dois lançamentos aqui diferem em R$ 36,00".

Por isso os rótulos descrevem a evidência, não um par:

| Status | Rótulo | Tom | Por quê |
|---|---|---|---|
| `match_exato` | Match exato | ok | resolvido |
| `match_tolerancia` | Match por tolerância de data | ok | resolvido, com a ressalva no rótulo em vez de num tom mais fraco |
| `divergente_valor` | Valor diverge na mesma data | risco | é dinheiro |
| `divergente_data` | Mesmo valor em outra data | atenção | está tudo lá, no dia errado |
| `duplicado` | Possível duplicidade | risco | pagamento repetido custa caro |
| `tarifa_bancaria` | Tarifa bancária | neutro | ver abaixo |
| `sem_correspondencia` | Sem correspondência no banco / no sistema | atenção | incompleto, não errado |

**Tarifa em neutro é escolha, não descuido.** Ela ganhou categoria própria na
issue #24 justamente por ser a sobra que o sistema já sabe explicar. Deixá-la em
ouro, junto com o que ninguém identificou, desperdiçaria a classificação. Se o
time achar que tarifa ainda pede ação (lançar no ERP), é uma linha em
`resumo.ts`.

**`sem_correspondencia` é um status só no backend, dois rótulos na tela.** Qual
lado falta sai de qual `lancamento_*` veio `null` — não precisa de status novo.

### 5. Adaptador, não modelo novo

`lib/adaptadores.ts` traduz `ItemConciliacaoAPI` → `LinhaComparacao`. A tabela, a
ordenação, os filtros, a paginação e o detalhe continuam trabalhando na forma que
já conheciam. É função pura, testada com o JSON do backend na mão.

### 6. Dado do backend é leitura

Fechar o mês e aceitar o valor do banco gravam no mock. O backend não tem
endpoint que altere o resultado de uma conciliação. Então, com dado real, esses
botões **não aparecem** — em vez de mudar a tela e não persistir nada.
`useConciliacao` devolve `real: boolean` para as duas telas decidirem isso no
mesmo lugar.

### 7. Dinheiro: converte na borda, soma em centavos

O backend manda `valor` como string decimal de propósito. Converter para número é
inevitável (a tela formata e compara), mas isso acontece uma vez por linha, no
adaptador. **Toda soma** (`resumo.ts`) passa por centavos inteiros — é lá que o
resíduo de float apareceria, somando milhares de linhas.

## Bugs encontrados

- **`statusDaLinha` quebrava a tabela com dado gravado antes desta mudança.** Uma
  conciliação no `localStorage` com `status: "batido"` não acha entrada no mapa
  novo, e a página inteira explodia em `undefined.tom`. A chave do storage virou
  `ledgr_conciliacoes_v2`: dado velho é ignorado, não lido errado.
- **Laço infinito no carregamento.** `useConciliacao` tinha `router` nas
  dependências do efeito. O efeito escreve estado; se o `router` troca de
  identidade entre renders, isso não para nunca — e derrubava o worker de teste
  por estouro de memória. O router foi para uma ref.
- **Diretiva de lint morta** em `login/page.tsx` (`eslint-disable
  react-hooks/set-state-in-effect`), que a versão atual do plugin já não usa.
  Removida — era a última pendência de lint do repositório.

## Verificação

Além de `test`/`lint`/`build`, o fluxo inteiro foi exercido contra um backend de
mentira que **valida o token do mesmo jeito que o `app/core/auth.py` valida**
(HS256 com o `NEXTAUTH_SECRET` compartilhado). Ele aceitou o token e registrou:

```
claims: {"empresa_id":"…","email":"…","sub":"…","iat":1790122573,"exp":1790727373}
upload origem=banco arquivo=banco.ofx
upload origem=sistema arquivo=sistema.csv
```

`exp - iat = 604800` — os 7 dias da ADR-003, não os 30 do default do NextAuth.
Depois disso: consulta dos dois extratos até sair de `pendente`, `POST
/conciliacoes`, e a tabela renderizada a partir do `GET /conciliacoes/{id}` com
os rótulos novos.

## O que fica para depois

- **Não existe login de verdade.** O backend expõe `/extratos` e `/conciliacoes`,
  e mais nada — sem `/auth/login`, sem cadastro de usuário. O `authorize` do
  NextAuth continua validando a conta de teste, e o `empresa_id` vem de
  `LEDGR_EMPRESA_ID_TESTE`. Quando o endpoint existir, é essa função que muda;
  o resto do sistema já trabalha em cima do token.
- **Não existe listagem de conciliações.** `GET /conciliacoes/{extrato_id}` exige
  saber o id do extrato do banco. Sem um "liste os meus", a dashboard e o
  histórico continuam no mock.
- **Consequência disso:** sem backend alcançável, o app não produz mais nenhuma
  conciliação — `criarConciliacao()` deixou de ser chamada. É o objetivo da
  mudança, mas quem quiser ver as telas sem backend precisa semear o
  `localStorage` na mão.
- **Paginação server-side.** A tela ordena a lista inteira no cliente, então
  `carregarConciliacao` busca tudo, em páginas de 1000, com teto de 10. Acima
  disso a tela avisa que está truncada. O endpoint já aceita
  `limit`/`offset`/`status` quando a ordenação passar para o servidor.
- **CORS no backend** continua sem issue própria — mas, com o proxy, quem fala
  com o Railway é o servidor do Next, não o navegador. Vale confirmar se ainda
  bloqueia alguma coisa.
- **Enumeração de conta.** O formulário distingue "conta não encontrada" de
  "senha incorreta", o que diz quais e-mails existem. Hoje é inofensivo (uma
  conta fixa), mas com login real isso vira uma mensagem só.
