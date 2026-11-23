# Nome de exibição da empresa: plano de implementação (#472, só a edição do nome)

> **Para agentes:** execute task a task. Remover empresa fica fora deste plano.

**Objetivo:** a empresa pode ter um nome de exibição, mostrado no seletor, na tabela de Empresas e no cabeçalho, com a razão social ainda visível no painel lateral. O admin e o gestor editam o nome no painel, e "Voltar à razão social" apaga o nome.

**Branch e worktree:** `feat/nome-de-exibicao` em `.worktrees/nome-de-exibicao`, a partir de `origin/develop`. A primeira commit é a C0 com este plano.

## Contrato do backend (#236, conferido no código da develop do backend em 22/11)
- `nome_exibicao` (string ou null) vem em toda resposta de empresa: `GET /empresas`, o `PATCH` e cada item de `me.empresas`.
- `PATCH /empresas/{id}` com `{ nome_exibicao }`: aparado, até 120 caracteres; vazio, só espaços ou null voltam a mostrar a razão social. Também aceita `razao_social` (aparada, não vazia), que esta tela não usa. Campo desconhecido ou corpo vazio: 422. Admin e gestor; analista 403; empresa de outra conta ou removida 404.
- A lista vem ordenada pelo nome mostrado (o de exibição, senão a razão social).
- **Backend antigo:** sem a chave `nome_exibicao`, nada muda na tela e "Editar nome" não aparece.

## Task C0 (orquestrador): tipos, adaptadores e backend-fake
- [x] `EmpresaCliente` (`lib/adaptadores.ts`) ganha `nome` (o mostrado) e `nomeExibicao?: string | null` (ausente sem a chave); `nomeDaEmpresa(razao, nomeExibicao)` decide os dois.
- [x] `EmpresaDaConta` (`lib/empresa-ativa.tsx`) ganha `nome`; `adaptarEmpresas` do `/me` (`app/(auth)/acoes.ts`) o preenche; o substituto do layout também.
- [x] Testes do adaptador: sem a chave, com nome, null, só espaços.
- [x] `scripts/backend-fake.mjs`: `nome_exibicao` no `/me`, no `GET /empresas` e no `PATCH /empresas/{id}`, com as regras acima; listas ordenadas pelo nome mostrado. `NOME_DE_EXIBICAO=0` é o backend antigo: a chave não sai e o `PATCH` não existe.

## Task C1: a Server Action
**Arquivos:** `app/(app)/e/[empresa]/empresas/acoes.ts` (+ teste).

`editarNomeDeExibicao(empresaId, nome: string | null)`:
- **Validação na entrada:** `empresaId` uuid (`pareceUuid` ou o validador que o arquivo já usa); `nome` string ou null; aparado até 120 caracteres. Fora disso, 422 com "O nome pode ter até 120 caracteres." (ou "Empresa inválida." para o id).
- **Recusa o analista antes do backend**, com o mesmo texto e a mesma checagem de papel que `cadastrarEmpresa` usa; a conta de demonstração é recusada antes do backend se `cadastrarEmpresa` já faz assim.
- **Chamada:** `chamarBackend` → `PATCH /empresas/${id}` com `{ nome_exibicao: aparado || null }`. Resposta adaptada por `adaptarEmpresaCliente`.
- **Erros:** 403 e 404 com o texto do arquivo (o 403 de conta inativa mostra o texto do backend, `ehContaInativa`); 422 mostra o texto do backend; 429 lê `Retry-After` como o resto do arquivo.
- **Testes:** id inválido, nome de 121, analista recusado sem chamar o backend, corpo enviado (aparado; vazio vira null), resposta adaptada, 404.

## Task C2: a tela
**Arquivos:** `seletor-de-empresa.tsx`, `empresas/painel-de-empresas.tsx`, `layout.tsx` (só `empresa={ativa.nome}`), os demais lugares que mostram a empresa ativa ao usuário (`nova/page.tsx` "Conciliando para", `chaves-api/painel.tsx`), e os testes (inclusive os fixtures que só precisam do campo `nome`).
- **Mostrar o nome:** o seletor (botão e tabela), a tabela de Empresas e o cabeçalho usam `nome`. A ordenação por nome usa `nome`. `combina` acha pelo nome e pela razão social.
- **Painel lateral da empresa:** o título é o `nome`; abaixo, "Razão social" com a razão social (sempre, também quando são iguais, para quem procura).
- **"Editar nome"** (admin e gestor, `usePodeFechar`, e só quando `nomeExibicao !== undefined`): abre um formulário em linha no painel com o campo "Nome de exibição" (`maxLength` 120, preenchido com o nome atual), "Salvar" e "Cancelar"; com `nomeExibicao` não nulo, também "Voltar à razão social" (manda null). Um envio por vez (`ref` antes do primeiro `await`). Erro na linha do formulário. Sucesso: atualiza a empresa na lista e chama `router.refresh()` para o seletor e o cabeçalho relerem o `/me`.
- **Testes:** nome no seletor e na tabela; razão social no painel; busca pelos dois; "Editar nome" só para admin/gestor e só com a chave; salvar manda o nome; "Voltar à razão social" manda null; analista não vê; backend antigo não vê.

## Task C3 (orquestrador): ajuda, CLAUDE.md, verificação e PR
- [ ] `paginas.ts`: na página "Empresas", a função "Editar o nome de exibição".
- [ ] `CLAUDE.md`: no tópico "Client companies and plan limits", o nome de exibição.
- [ ] Navegador com o `backend-fake` (com e sem `NOME_DE_EXIBICAO=0`), teste do Antigravity.
- [ ] Pré-PR completo, PR para a `develop` com "Parte de #472".
