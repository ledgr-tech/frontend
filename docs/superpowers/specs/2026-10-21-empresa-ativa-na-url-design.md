# Ledgr — Empresa ativa na URL e seletor de empresa

## Contexto

O escritório contábil assina o Ledgr com o CNPJ dele, cadastra as empresas clientes e alterna entre elas; extratos,
conciliações, justificativas e fechamentos ficam separados por empresa. É a decisão de 21/10 (ledgr-docs, ADR-019,
`02-decisoes/19-contas-empresas-clientes-e-papeis.md`; backend #133, PRs #142 e #143, já em `develop`). A empresa que
usa o Ledgr para o próprio financeiro tem uma empresa só e não vê nada disso. Entra antes do congelamento de 02/11
(issue do front #169).

O backend recebe a empresa ativa no cabeçalho `X-Ledgr-Empresa` (uuid) e a confere contra a conta do token em **toda**
requisição às rotas por empresa (`/extratos/*`, `/conciliacoes/*`, `/execucoes`, `/explicacoes`, `/fechamentos/*`,
`GET`/`PUT /empresa/configuracoes`). As rotas da conta ignoram o cabeçalho (`/me/*`, `/empresas`, `/empresa/convites`,
`/empresa/usuarios`, `/empresa/plano`). Sem o cabeçalho, uma conta com uma empresa usa essa; com mais de uma, 400
"Escolha a empresa."; empresa de outra conta, 404 "Empresa não encontrada.".

O que falta é o lado do front: **de onde sai esse cabeçalho** e **como a pessoa troca de empresa**, sem que duas abas
abertas em clientes diferentes se misturem. O token mora num cookie httpOnly que todas as abas dividem, então a
empresa ativa não pode morar nele.

Decidido com Eduardo em 21/10:

1. **A empresa ativa vai na URL**, `/e/<empresa>/...`, como Linear, Notion e Vercel fazem com o workspace. Cada aba tem a
   sua. Query `?empresa=` (um link esquecido volta para a padrão sem avisar) e cookie (as abas o dividem, o risco do
   ADR-019) foram recusados.
2. **A rota é um segmento real**, `app/(app)/e/[empresa]/...`, e não uma reescrita no proxy: o navegador e o Next veem
   a mesma URL, e o `usePathname` (menu, tutorial, painel de ajuda, voltar da Central) não diverge.
3. **O seletor fica no topo da barra lateral**, abaixo do logo, escondido com uma empresa só.
4. **A #169 se divide em três.** Esta spec é só a parte A, o núcleo. A parte B (Configurações › Empresas: cadastro por
   CNPJ, avisos de limite) e a parte C (Equipe: troca de papel e transferência de admin) têm spec e PR próprios.

## O que o backend oferece (para o núcleo)

| Rota | O que dá |
|---|---|
| `GET /me` | `empresas: [{ id, razao_social, cnpj }]`, ordenadas pela razão social (a lista do seletor); `conta_id`; `razao_social` é a da **conta** (o escritório). `empresa_id` é obsoleto e igual ao `conta_id`: **nunca** vai no cabeçalho |
| Cabeçalho `X-Ledgr-Empresa` | nas rotas por empresa; 400 se faltar com mais de uma empresa, 404 se for de outra conta |

## Roteamento e o cabeçalho

**Rota.** As páginas do app passam a viver em `app/(app)/e/[empresa]/...`: `/e/<uuid>/visao-geral`,
`/e/<uuid>/conciliacoes/<id>` e assim por diante. Um esquema só: mesmo com uma empresa a URL é `/e/<id>/...`, e
Assinatura e Plano ficam na mesma árvore, porque o menu é uniforme. A mudança de lugar vai num commit só de `git mv`,
sem editar código.

**Cabeçalho, sem mexer nas 45 chamadas.** O `proxy.ts` já repassa cabeçalhos de pedido (o `x-nonce` da CSP, por
`NextResponse.next({ request: { headers } })`); o da empresa usa o mesmo caminho.

1. O proxy lê `/e/<uuid>/` do caminho. Se o segmento é um UUID válido, põe o pedido com `x-ledgr-empresa: <uuid>`.
2. O proxy **sempre apaga** o `x-ledgr-empresa` que vier de fora e só o recria a partir da URL. Sem spoof (o backend
   confere de novo, mas o front não conta com isso).
3. `chamarBackend` e `baixarDoBackend` (`lib/backend.ts`) leem o cabeçalho com `headers()` e mandam `X-Ledgr-Empresa` ao
   backend quando existe. Vale para Server Components e Server Actions: a Action é um POST na URL da própria página.
   As rotas da conta ignoram o cabeçalho, então mandar sempre não faz mal.

**CSV.** A rota de exportação (`/api/conciliacoes/[id]/exportar`) fica fora do proxy (o matcher exclui `api`). A página
gera o link com `?empresa=<uuid>`; o handler valida o UUID e manda o cabeçalho.

**URLs antigas** (`/visao-geral`, favoritos, o destino do login). Uma rota sem empresa chama `GET /me`, escolhe a
empresa padrão e redireciona para `/e/<id>/<caminho>`. A padrão é a **última usada**, num cookie
`ledgr-empresa-recente` (não httpOnly, SameSite=Lax) que **só escolhe o destino do redirect e nunca vai ao backend**:
cada aba continua carregando a própria empresa na URL, então o problema das abas não volta. Cookie que aponta para
empresa que sumiu é ignorado: vale a primeira da lista. Caminho que não é de nenhuma tela dá 404.

**Empresa inválida.** O layout de `e/[empresa]` confere o UUID contra `me.empresas`; se não for da conta, 404 com um
link para a empresa padrão. O 404 "Empresa não encontrada." do backend cai no mesmo tratamento.

**Fora do escopo.** O claim `conta_id` no token: o backend aceita o `empresa_id` legado como id da conta, sem pressa.

## Links, rotas e o seletor

**Rotas num módulo só.** `lib/rotas.ts` monta `/e/<empresa>/<caminho>`, tira o prefixo de um caminho e acha a seção
(`/e/A/fechamentos/2026-09/relatorio` é a seção `fechamentos`).

- No cliente, a empresa vem do segmento por um contexto (`useEmpresaAtiva`). Um `<Link>` do app e um `useRoteador()`
  prefixam sozinhos os caminhos das telas da empresa; `/login`, `/ajuda`, `/plano`, `/termos` e afins ficam como estão.
- No servidor, `caminhoDoApp()` lê o cabeçalho e serve aos `redirect()`.
- Um codemod troca os ~70 pontos (28 arquivos com `Link`, 26 `router.push`, 15 `redirect`, `caminhoDaConciliacao`,
  `usePathname` em 4 arquivos).
- **Um teste varre o código e falha se sobrar um href cru para uma tela da empresa**, para o problema não voltar quando
  alguém escrever um link novo.

**Seletor.** `SeletorDeEmpresa`, no topo da barra lateral, abaixo do logo, **escondido com uma empresa só**.

- Mostra a empresa ativa (razão social e o CNPJ pequeno) e abre uma lista com as de `me.empresas`; com mais de 8 ganha
  busca. Teclado e `aria` como os outros menus do app.
- Trocar leva à **mesma seção** da outra empresa (`/e/A/fechamentos` vira `/e/B/fechamentos`). De uma tela com id
  (comparação, detalhe da linha, relatório) vai para a raiz da seção, porque aquele id não existe no outro cliente.
- Cada troca grava o cookie `ledgr-empresa-recente` (preferência de destino, nada mais).
- Barra recolhida: só as iniciais da empresa.

**Nomes nas telas.**

- O cabeçalho das telas (`Cabecalho`) passa a mostrar a razão social da **empresa ativa**, tirada de `me.empresas`.
- O cartão do usuário, embaixo, fica com o nome da conta (o escritório).
- Na Nova conciliação, com mais de uma empresa, uma linha em destaque diz "Conciliando para <empresa>", como a issue pede.
- `contaDaSessao` (`app/(auth)/acoes.ts`) passa a devolver `empresas` (`id`, razão social, CNPJ). Os `limites` ficam para
  a parte B.

**Não muda:** a conta de demonstração, a vitrine da landing e as preferências do dispositivo (tema, densidade, menu).

## Erros

| Situação | O que a pessoa vê |
|---|---|
| UUID da URL não é de empresa da conta | 404 com link para a empresa padrão |
| 404 "Empresa não encontrada." do backend | o mesmo |
| Cookie recente aponta empresa que sumiu | o redirect usa a primeira da lista |
| `GET /me` fora do ar | degrada como hoje: sem seletor; o cabeçalho segue vindo da URL |
| 400 "Escolha a empresa." | não deve acontecer (o cabeçalho sempre vai); se acontecer, é uma rota sem prefixo que escapou e o teste-guarda deveria ter pego, sem tela própria |
| Sessão expirada | como hoje |

## Testes

- `proxy`: extrai o UUID, **apaga o cabeçalho de fora**, ignora caminhos sem `/e/` e UUID inválido.
- `lib/rotas`: montar, tirar o prefixo, achar a seção.
- `chamarBackend`: manda `X-Ledgr-Empresa` só quando o cabeçalho existe.
- Redirect das URLs antigas: usa o cookie válido, cai na primeira, 404 em caminho desconhecido.
- `SeletorDeEmpresa`: oculto com 1; lista; busca a partir de 8; troca de seção; detalhe vai à raiz; grava o cookie.
- Layout: UUID fora da conta vira 404.
- CSV: `?empresa=` validado e repassado.
- **Teste-guarda dos hrefs crus.**
- Os testes das telas se mudam com os arquivos (mesmo `git mv`).

## Verificação real

O backend local já tem o #133. Crio uma segunda empresa na conta de teste por `POST /empresas`, uso **duas abas** com
empresas diferentes e provo que conciliar numa não aparece na outra e que trocar numa aba não mexe na outra. Capturas das
telas, mais `npm run test`, `lint` e `build`.

## Ordem dos commits

1. só `git mv`;
2. imports até o build ficar verde;
3. `lib/rotas` + codemod + teste-guarda;
4. proxy + `chamarBackend` + layout;
5. redirect das URLs antigas + cookie;
6. seletor + nomes nas telas;
7. CSV;
8. docs e CLAUDE.md.

A branch parte da do #202 (`feat/aprovacao-justificativas`) para não dar conflito com o #201 e o #202, que mexem em
arquivos que esta spec move; o rename detection do git cobre o resto, e o commit de só `git mv` existe para isso.

## Riscos a conferir

- A rota interceptada `@painel/(.)[linha]` sob o segmento dinâmico.
- Os 4 consumidores de `usePathname` (menu, tutorial, painel de ajuda, voltar da Central), que passam por
  `caminhoSemEmpresa`.
- O diff do commit de `git mv` (rename detection) com o #201 e o #202 ainda abertos.
- Links em e-mails (convite, redefinição de senha) são do grupo `(auth)`, fora do segmento: não mudam.

## Fora do escopo (partes B e C)

- **B:** Configurações › Empresas (listar, cadastrar por CNPJ com a consulta da Receita, 402 do limite do plano, 429 das
  20 por hora) e os avisos de limite de empresas e usuários (`limites` do `GET /me`).
- **C:** troca de papel (`PATCH /empresa/usuarios/{id}`) e transferência de admin
  (`POST /empresa/admin/transferencia`), que não dependem desta spec.
- Permissão por empresa (a decisão é que todos veem todas), editar e excluir empresa cliente (#138).
