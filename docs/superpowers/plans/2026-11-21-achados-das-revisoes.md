# Achados das revisões de 21/11 (#478) no Maestri

**Issue:** ledgr-tech/frontend#478. **Base:** `develop` em `bcaedfc` (21/11).
**Quem faz o quê:**
- **Codex:** escreve o código, uma parte por worktree, com arquivos que não se cruzam.
- **Antigravity (Gemini):** testa cada parte no portal.
- **Gemini pelo `delega.sh`:** faz a leitura em massa do export.
- **Claude Code:** orquestra. Cria as worktrees, revisa, faz os commits, cuida dos arquivos de dono único e abre o PR.

## Antes de começar

1. **Decisões do Eduardo.** Os cinco itens de "Decisões antes de corrigir" da #478 (convite em navegador compartilhado, folga de 5 min, marca no menu, textos sem origem e centavos) ficam fora das partes abaixo até a decisão. Se alguma sair, entra como item da parte indicada entre parênteses no fim deste plano.
2. **Canvas.** Rodar `maestri list` para pegar os nomes exatos. O meu aparece em `You:`, e os esperados são "Codex" e "Antigravity". Se o Codex não existir, abrir pelo preset "Codex Ledgr" com `--dir` na raiz.
3. **Branch de integração.** `git fetch origin`. Depois, `git worktree add .worktrees/achados -b fix/achados-das-revisoes origin/develop` e `npm ci` dentro dela. As partes saem desta branch e voltam para ela.
4. **Worktree por parte.** Para cada parte, `git worktree add .worktrees/achados-<parte> -b fix/achados-<parte> fix/achados-das-revisoes` e `npm ci` dentro dela, antes de chamar o Codex. Ele não cria worktree, não instala e não faz commit.
5. **Preview para o Antigravity.** O Next fica na 3100 e o `backend-fake` na 8020, com `APROVACAO_JUSTIFICATIVAS_HABILITADA=1`. Para testar uma parte, trocar o Next da 3100 para a worktree dela e depois devolver.

## As partes

Cada parte só edita os arquivos listados nela e os testes deles.

Três arquivos têm um dono só, que é o Claude Code no fim: `app/globals.css`, `CLAUDE.md` e `app/(marketing)/cenas/index.ts`. Nenhuma parte mexe neles.

### P1 · Comparação (Codex)
**Arquivos:**
- `app/(app)/e/[empresa]/saldo.tsx`
- `app/(app)/e/[empresa]/conciliacoes/[id]/page.tsx`
- `app/(app)/e/[empresa]/conciliacoes/[id]/soma-das-selecionadas.tsx`
- `app/(app)/e/[empresa]/conciliacoes/decisao-em-lote.tsx`
- os testes deles

**O que corrigir:**
- **Saldo repetido:** "Saldo não informado no arquivo" só no `momento="final"`. O teste é com `saldo: null`: o texto aparece uma vez na folha do banco.
- **Nome do grupo:** o `th scope="colgroup"` do banco tem o nome acessível "Extrato do banco". O teste é `getByRole("columnheader", { name: "Extrato do banco" })` exato.
- **Limite do lote:** com mais de 500 aguardando entre as selecionadas, o botão de aprovar e rejeitar desliga e um texto diz o limite. O teste é com 501 linhas aguardando.
- **Sinal da falta:** o `anuncioDaSoma` diz de que lado sobra, banco ou sistema. Teste para os dois sinais.
- **Comentários soltos:** cada JSDoc fica sobre a sua constante (`page.tsx:84-90`). Sem teste.

**Testar no portal (Antigravity):** conta `gestor@telhacerta.com.br`, conciliação de setembro.
- Selecionar duas linhas e conferir o texto da soma e o `role="status"`.
- Conferir que o nome do cabeçalho do banco é só "Extrato do banco" (`evaluate` do `aria`/texto acessível).

### P2 · Fechamentos e Conciliações (Codex)
**Arquivos:**
- `app/(app)/e/[empresa]/dashboard/lista-de-trabalho.tsx`
- `app/(app)/e/[empresa]/dashboard/lista.ts`
- `app/(app)/e/[empresa]/fechamentos/link-publico.tsx`
- `app/(app)/e/[empresa]/fechamentos/mesa.tsx`
- `app/(app)/e/[empresa]/fechamentos/links.ts`
- os testes deles e o novo `fechamentos/links.test.ts`

**O que corrigir:**
- **Filtro "Mês fechado" falso:** com `fechamentos === null`, os filtros por situação somem da lista de trabalho, como já acontece em Fechamentos (`MesaDeFechamento`, `podeFechar` falso).
- **Texto do mês reaberto:** o texto sobrevive à releitura. O `LinkPublico` avisa a mesa por uma prop, e a mesa mostra a linha no painel do mês.
- **Texto do 409 de aprovação:** a chave das ações não monta de novo por causa da contagem. Ela volta a ser `mes.chave`, e o estado do erro é limpo quando o mês muda.
- **Teste do 404:** `links.test.ts` com o mock de `chamarBackend` lançando `ErroBackend` com os dois textos do backend ("Não há fechamento ativo nesta competência." e "Link público não disponível."). O teste espera `motivo` `mes-reaberto` e `sem-rota`.

**Testar no portal:** conta `financeiro@telhacerta.com.br`.
- Fechamentos, agosto: "Gerar link".
- Reabrir agosto em outra aba e gerar de novo na primeira: o texto do mês reaberto fica à vista.

### P3 · Nova conciliação e IA (Codex)
**Arquivos:**
- `app/(app)/e/[empresa]/conciliacoes/nova/ia/[id]/revisao.tsx`
- `app/(app)/e/[empresa]/conciliacoes/nova/page.tsx`
- `app/(app)/e/[empresa]/conciliacoes/acoes.ts`, só o `carregarContextoDoReenvio`
- os testes deles

**O que corrigir:**
- **Erro da recuperação:** se a recuperação não acha nada, aparece o erro original (`SEM_SERVIDOR` ou o texto do 409). O teste: `confirmarImportacao` rejeita e `recuperarExtratoConfirmado` volta sem extrato.
- **Duplicação:** `if (!alvo.ok) return falhar(alvo);`. Os testes existentes cobrem.
- **Endereço antigo:** `carregarContextoDoReenvio` recusa quando a anterior não é a vigente, e a tela mostra `FalhaAoCarregar` ou o texto de `verificarNovaVersao`. O teste é um reenvio apontando para a rodada 1 de 2.

**Testar no portal:** conta `financeiro@`, comparação de agosto (3 rodadas).
- Abrir à mão `/e/<empresa>/conciliacoes/nova?banco=<id>&sistemaAnterior=<id da rodada 1>`. A tela recusa antes de escolher o arquivo.

### P4 · Empresas e Equipe (Codex)
**Arquivos:**
- `app/(app)/e/[empresa]/seletor-de-empresa.tsx`
- `app/(app)/e/[empresa]/empresas/painel-de-empresas.tsx`
- `app/(app)/e/[empresa]/empresas/painel-da-equipe.tsx`
- os testes deles

**O que corrigir:**
- **Estrela fora de ordem:** `terminar` só grava em `confirmadas` a última versão. O teste: dois oks fora de ordem, depois uma falha. A estrela volta ao valor do último ok.
- **Convite com papel perdido:** o 403 do convite põe o texto em `erroDeAcao` e relê a equipe. O teste: o 403 com o papel trocado para analista deixa o texto à vista.
- **Busca de CNPJ:** `combina` procura os dígitos do termo também quando há palavras. O teste com "cnpj 12345" e "Loja 12.345".
- **Duplicação:** o resto do `alternarFavorita` vai para o hook, e os dois chamam o mesmo código.

**Testar no portal:** conta `financeiro@`.
- Seletor de empresa: buscar "cnpj" mais um trecho do CNPJ da Horizonte.
- Marcar e desmarcar a estrela rápido: no fim ela fica como no último clique.

### P5 · Login, cadastro e assinatura (Codex)
**Arquivos:**
- `app/(auth)/cadastro/formulario.tsx`
- `lib/google.ts`
- `app/(auth)/aceitar-convite/`, só o que ler o tipo do motivo
- `lib/assinatura.ts`, `app/(app)/e/[empresa]/assinatura/painel.tsx` e `painel-do-plano.tsx`, só os comentários
- os testes deles

**O que corrigir:**
- **Resultado descartado calado:** ao descartar a conferência porque o CNPJ mudou, aparece "Conferindo de novo…" ou o passo confere outra vez sozinho. A comparação com a Receita usa `valoresAtuais.current`. O teste: trocar o CNPJ com a conferência pendente.
- **Motivo do convite no login:** o motivo `google_de_outra_conta` sai de `ErroGoogle`, e `ehErroGoogle("google_de_outra_conta")` dá falso. Teste em `lib/google.test.ts`.
- **Comentários da Stripe:** comentários que dizem "48 h 1 min da Stripe" passam a dizer "48 h da Stripe mais 1 min de margem do backend". Sem teste.

**Testar no portal:** cadastro em `/cadastro`.
- Digitar um CNPJ, clicar em Continuar e trocar o CNPJ durante o "Conferindo…". A tela diz o que houve.

### G1 · Origem dos textos (Gemini pelo `delega.sh`, em paralelo com P1)
Só se o Eduardo pedir para conferir a decisão 4 da #478. Rodar `delega.sh "<tarefa>" <export do Claude Design>` fora da pasta do projeto. A tarefa: procurar no export do Claude Design os textos "Arraste para ver a tela toda", "Arraste para ver o sistema", "Não deu para saber se o mês está fechado", "Situação do mês indisponível" e "Leitura não conferida", e dizer onde cada um aparece ou que não aparece. Sem dado de cliente. O que ele disser é afirmação: conferir com `grep` antes de levar ao Eduardo.

### P6 · Fim (Claude Code)
- **Seletor repetido:** juntar as duas `.site-menu-barras` em `app/globals.css`.
- **Cenas:** depois que a P1 entrar na branch de integração, gravar as cenas de novo com `next start -p 3950` e um `backend-fake` novo, `APROVACAO_JUSTIFICATIVAS_HABILITADA=0 MCP_HABILITADO=0`, com `node scripts/ajuda-videos/gravar.mjs --landing`. Conferir que "Detalhe da linha e saldo do extrato" sumiu de `cenas/index.ts`.
- **`CLAUDE.md`:** só se alguma regra descrita mudar. A P2 muda a lista de trabalho sem `/fechamentos`, e a P4 muda a busca do seletor.

## Ordem

Há um Codex só, então as partes vão em fila. O Antigravity testa a parte anterior enquanto o Codex escreve a seguinte:

| Etapa | Codex | Antigravity | Claude Code |
|---|---|---|---|
| 1 | P1 | — | cria as worktrees da P1 e da P2; G1 se pedido |
| 2 | P2 | testa P1 | revisa, commita e junta a P1 |
| 3 | P3 | testa P2 | revisa, commita e junta a P2 |
| 4 | P4 | testa P3 | revisa, commita e junta a P3 |
| 5 | P5 | testa P4 | revisa, commita e junta a P4 |
| 6 | — | testa P5 | revisa, commita e junta a P5; faz a P6 |

Com dois terminais do Codex, a P1 e a P2 podem andar juntas, e depois a P3 e a P4, porque os arquivos não se cruzam.

## Como cada parte volta

1. **Codex:** termina com `npx vitest run <pastas da parte>`, `npm run lint` e `npx tsc --noEmit -p .` passando. Responde com `maestri ask "<meu nome>" "<resultado>"`, listando os arquivos mudados e os testes novos.
2. **Claude Code:** revisa o diff na worktree. Os achados do Codex são afirmações e precisam ser conferidos. Roda `npm run test && npm run lint && npm run build` e faz o commit na branch da parte (`fix(#478): <parte> ...`). Junta na branch de integração com `git merge --no-ff`.
3. **Antigravity:** testa no portal pelo roteiro da parte e deixa o bloco "Resultado" na tela. O Claude Code lê com `maestri check "Antigravity"` e grava o resumo em Resumos, marcado "gravado pelo Claude Code". Se falhar, a correção volta para o Codex na mesma worktree.

## Antes do PR

- Na branch de integração: `verificador` e `revisor` (`.claude/agents/`).
- Segunda revisão até 30/11: `codex review --base develop` e `copilot -p "Revise o diff de git diff develop...HEAD: ..." -s --model auto`.
- PR de `fix/achados-das-revisoes` para `develop`, com "Parte de #478" (o merge em `develop` não fecha a issue). Pedir revisão do Copilot no GitHub. O merge é do Eduardo.

## Mensagens

**Para o Codex** (caminhos com barra normal, porque o `maestri ask` interpreta `\t`):

```
Releia a seção 'Papel do Codex' do Quadro.
Tarefa P<n> da issue #478, na worktree C:/Users/Eduardo Sichelero/Desktop/frontend/.worktrees/achados-<parte> (já tem npm ci; não crie branch, não instale, não faça commit).
Plano: docs/superpowers/plans/2026-11-21-achados-das-revisoes.md, seção P<n>. Edite só os arquivos listados nela e os testes deles.
Quando terminar: npx vitest run <pastas>, npm run lint e npx tsc --noEmit -p . passando. Responda com maestri ask "<meu nome>" listando os arquivos mudados, os testes novos e o que não conseguiu fazer.
```

**Para o Antigravity:**

```
Teste no portal, Preview em http://localhost:3100 (backend-fake na 8020, senha ledgr2026). Não leia nem escreva notas: deixe o bloco "Resultado" na tela.
Parte P<n> da #478. Contexto: <o que mudou, em duas linhas>.
Roteiro: <os passos do "Testar no portal" da parte>.
Esperado: <o que deve aparecer>. Relate o que viu em cada passo e o que não bateu.
```

## Decisões que viram item, se aprovadas

- **Convite em navegador compartilhado:** vai para a P5. `?google=volta` não lê o cookie se a página já mostrou o motivo uma vez, ou o cookie passa a valer só para a aba de origem.
- **Folga de 5 min:** vai para a P5, para tirar ou manter `FOLGA_DO_RELOGIO_MS`, com teste em `lib/assinatura.test.ts`.
- **Marca no menu:** vai para a P6, para reverter as barras de adesivo em `cabecalho-site.tsx` e no `globals.css`.
- **Textos:** os padronizados entram na parte dona do arquivo de cada texto.
- **Centavos:** vai para a P1, para fazer a soma a partir do texto decimal. Isso pede o texto em `LinhaComparacao`, que é de `lib/adaptadores.ts`, um arquivo de dono único. Por isso fica com o Claude Code no fim.
