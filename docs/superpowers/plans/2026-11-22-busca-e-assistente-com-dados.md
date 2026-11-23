# Busca em todas as conciliações (#447) e assistente com os números da empresa (#448)

Data: 22/11/2026. Duas partes independentes, cada uma numa worktree própria, com arquivos que não se cruzam. O fechamento (parte C) fica com a sessão que orquestra.

| Parte | Issue | Branch | Worktree |
|---|---|---|---|
| A | #447 | `feat/busca-em-todas` | `.worktrees/busca-em-todas` |
| B | #448 | `feat/assistente-com-dados` | `.worktrees/assistente-com-dados` |
| C | as duas | cada branch, no fim | a sessão que orquestra |

**Arquivos proibidos às partes A e B** (são da parte C): `app/globals.css`, `CLAUDE.md`, `app/(ajuda)/ajuda/paginas.ts`, `scripts/backend-fake.mjs`, `lib/backend.ts`, `lib/adaptadores.ts`. Se precisar de algo neles, escreva o pedido no resumo final.

Regras das duas partes: nada de `git push`, merge, `reset`, `checkout` ou `restore`; commits pequenos na própria branch; no fim, `npm run test && npm run lint && npm run build` verdes na worktree.

---

## Parte A: busca do topo em todas as conciliações (#447)

**Contrato** (backend #220, PR #228, já no `develop` do backend, sem flag): `GET /busca?q=&limit=&offset=`, qualquer papel, 120 por minuto.
- `q`: de 1 a 100 caracteres, com algum que não seja espaço (senão 422). `limit` de 1 a 50 (padrão 10), `offset` a partir de 0.
- Resposta: `{ total, limit, offset, itens: [{ conciliacao_id, extrato_banco_id, extrato_sistema_id, chave, status, competencia, lancamento_banco, lancamento_sistema }] }`. `competencia` é AAAA-MM ou `null`. Os lançamentos têm o formato da listagem das conciliações (`{ id, data, valor, descricao, tipo }`, valor em string), `null` no lado que a linha não tem. Os mais recentes vêm primeiro.
- O backend interpreta o termo (valor, data, texto, várias palavras). O front manda o texto como foi digitado, só aparado.
- Confira o contrato no código do backend (`../backend`, `git -C ../backend fetch` e leia a rota da busca em `origin/develop`) antes de escrever o tipo. Se algo divergir da issue, vale o backend: anote no resumo.

**Arquivos**
- Novo: `app/(app)/e/[empresa]/busca/acoes.ts` (Server Action `buscarLancamentos(termo, offset)`, com o tipo e o adaptador da resposta aqui mesmo, não em `lib/adaptadores.ts`) e `busca/acoes.test.ts`.
- `app/(app)/e/[empresa]/barra-superior.tsx` e `barra-superior.test.tsx`.

**Passos**
1. **Action.** `buscarLancamentos(termo: string, offset = 0): Promise<Resultado<PaginaDaBusca>>` por `chamarBackend` (ele já manda o `X-Ledgr-Empresa`). Server Action é endpoint público: aparar, recusar vazio sem chamar o backend, cortar em 100 caracteres, `offset` inteiro >= 0, `limit` fixo em 10. Adaptar cada item para `{ id: conciliacao_id, href: caminhoDaConciliacao(extrato_banco_id, extrato_sistema_id, conciliacao_id), descricao, data, valor, competencia }`, com descrição, data e valor do lado do banco, ou do sistema quando o banco é `null`. A rota da linha (`conciliacoes/[id]/[linha]`) usa o `id` do item, que é o `conciliacao_id` (`adaptarItem` em `lib/adaptadores.ts`, `id: item.id`). Descartar itens malformados. Erros: 429 vira "Muitas buscas seguidas. Espere um pouco."; 401 a mensagem de sessão das outras actions; o resto vira uma frase curta ("Não deu para buscar agora."). Siga o padrão de `traduzir` em `assistente/acoes.ts` (conta inativa: `ehContaInativa`). Sem backend configurado, faça como as outras actions fazem (`SEM_SERVIDOR`).
2. **Barra.** Trocar o filtro local (`combina`, `lancamentos`, `achados`) pela action:
   - esperar 250 ms depois da última tecla antes de chamar; um contador de requisição descarta respostas que chegam fora de ordem (Server Action não se cancela);
   - estado: digitando/lendo, resultados, vazio e erro. O vazio diz "Nada encontrado. Tente o valor sem centavos, a data (13/10) ou parte do nome do fornecedor.";
   - cada resultado mostra a descrição e, abaixo, a data, o valor (`formatarMoeda`) e o mês por extenso curto ("set/2026") quando `competencia` vem. Sem `competencia`, sem o mês;
   - "Ver mais" (botão no fim da lista, fora do `listbox`) quando `total` passa do que está na tela, que chama com `offset` = quantos já estão na tela e acrescenta os itens;
   - as setas, o Enter, o `aria-activedescendant`, o Esc e o clique fora continuam como hoje;
   - um `role="status"` sempre montado anuncia "N resultados", "Nada encontrado" ou o erro (uma região que nasce já com o texto não é lida).
3. **Avisos.** Os avisos continuam lendo `carregarVisaoGeral`. Atualizar o comentário `ponytail:` que diz "Buscar em todas pede uma rota de busca no backend".
4. **Testes.** Action: termo vazio e longo não chamam o backend; adaptação dos dois lados e do `null`; descarta item malformado; 429; offset. Barra: espera os 250 ms (timers falsos), resposta antiga não sobrescreve a nova, "Ver mais" acrescenta, mês aparece e some sem `competencia`, Enter abre o `href` do resultado ativo.
5. **Estilo.** Reaproveitar `app-busca-*`, `.btn` e `.tag`. Se faltar classe para o mês ou para o "Ver mais", deixe o mínimo inline e peça a classe no resumo (o `globals.css` é da parte C).

---

## Parte B: o assistente responde os números de qualquer mês (#448)

**Contrato** (backend #223, PR #226, já no `develop` do backend, atrás de `ASSISTENTE_DADOS_HABILITADO`, desligada): a mesma `POST /assistente/perguntas`. O que mudou na resposta é `links[].tipo`: `"ajuda"` (`/ajuda/...`, como hoje) ou `"tela"` (caminho do app **sem** `/e/<empresa>`: `/fechamentos`, `/historico`, `/extratos`, `/empresas`, `/empresas?aba=equipe`, `/conciliacoes/nova` e `/conciliacoes/<extrato_banco_id>?sistema=<extrato_sistema_id>`). A resposta é texto puro. Confira no código do backend (`../backend`, `origin/develop`) antes de escrever.

**Arquivos:** `app/(app)/e/[empresa]/assistente/acoes.ts`, `conversa.tsx`, `respostas.ts` e os testes deles. Nada fora de `assistente/`.

**Passos**
1. **Links de tela em `acoes.ts`.** `RespostaDoAssistente.links` ganha `tipo: "ajuda" | "tela"`. Aceitar um link quando: `tipo` é `"ajuda"` (ou ausente, para o backend antigo) e passa no `CAMINHO_DA_AJUDA`; ou `tipo` é `"tela"` e o caminho está na lista fechada acima. Para a conciliação, os dois ids têm de ser UUID (`ehUuid` de `lib/rotas.ts`). Qualquer outro link é descartado. O `LinkDoApp` (`lib/link-do-app.tsx`) já põe o `/e/<empresa>` nos caminhos do app, então o caminho de tela vai como veio.
2. **Ordem das respostas em `conversa.tsx`.** Hoje a pergunta sobre o mês (`assuntoDoMes` não nulo) responde pelo roteiro local e o resto vai ao backend. Passa a ser:
   - a pergunta sobre o mês vai **primeiro ao backend** (`perguntarAoAssistente`);
   - se o backend responde com `respondida: true`, mostra essa resposta (selo de IA, `daCentral: true`, links);
   - se o backend responde 503 ou 404, ou `respondida: false`, cai no roteiro local, exatamente como hoje (`responderSobreOMes`). O `respondida: false` cobre o caso do assistente ligado com `ASSISTENTE_DADOS_HABILITADO` desligada, em que o backend não sabe os números e o roteiro sabe;
   - 429 e 401 continuam como hoje;
   - "passos para fechar" (`pedePassosParaFechar`) e o "explicar a maior divergência" do roteiro continuam locais.
3. **`respostaDeOutroMes`.** Com o backend respondendo outros meses, ela só é alcançada no roteiro de reserva, que continua lendo só a conciliação mais recente. Por isso **fica** em `responder` (sem ela, "e agosto?" com o backend fora do ar responderia o mês errado). Isto diverge do texto da issue ("tirar"); a explicação vai no PR.
4. **Histórico.** As respostas do backend já entram no histórico (`daCentral`). As perguntas sobre o mês que foram ao backend também passam a entrar (marcar `daCentral` na mensagem de quem pergunta quando ela vai ao backend). As respostas do roteiro local e as explicações de divergência continuam fora: trazem os números e as descrições de lançamento.
5. **Conta de demonstração:** continua sem chamar o backend (a action já devolve 503 a ela, e o passo 2 cai no roteiro). Decisão de 22/11: protege o limite diário global do backend. Não mudar.
6. **Status do topo.** Enquanto espera o backend numa pergunta sobre o mês, o status diz "olhando os números…" em vez de "procurando na Central…".
7. **Testes.** `acoes.test.ts`: link de tela aceito para cada caminho da lista, recusado fora dela (`/admin`, `//evil.com`, `/conciliacoes/nao-uuid?sistema=x`, `javascript:`), link sem `tipo` tratado como ajuda. `conversa.test.tsx`: pergunta sobre o mês com o backend `respondida: true` mostra a resposta dele; com 503 e com `respondida: false` mostra a do roteiro; o link de tela aparece; a demonstração continua no roteiro.

---

## Parte C: fechamento (sessão que orquestra)

1. Receber o resumo de cada agente e conferir o diff na worktree (`git diff origin/develop...HEAD`).
2. `scripts/backend-fake.mjs`: `GET /busca` (filtro simples por descrição, data e valor nos itens das conciliações falsas, paginado) e, no `POST /assistente/perguntas`, uma resposta com números e um link `tipo: "tela"` quando `ASSISTENTE_DADOS_HABILITADO=1`.
3. `CLAUDE.md`: um item para a busca do topo e a atualização do item "The help assistant". `paginas.ts`: o texto da busca na Central, se ela falar da busca; o do assistente continua comentado até a flag ligar.
4. `globals.css`: as classes que os agentes pedirem.
5. Na worktree de cada parte: `npm run test && npm run lint && npm run build`, subagentes `verificador` e `revisor`, `codex review` e a revisão do Copilot, e um PR para o `develop` por parte. Nenhum merge sem aprovação de uma pessoa.
