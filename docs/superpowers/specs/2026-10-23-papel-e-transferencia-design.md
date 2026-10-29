# Troca de papel e transferência de administração (#169, parte C)

Data: 23/10/2026 · Backend: ledgr-tech/backend#133, parte 2 (PR #143, na `develop` do backend: `PATCH /empresa/usuarios/{id}` e `POST /empresa/admin/transferencia`) · Depende de: a aba **Equipe** da tela Empresas ([spec de empresas](2026-10-22-empresas-na-configuracao-design.md), PR #204).

## Objetivo

O administrador muda o papel das outras pessoas da conta (gestor ou analista) e passa a administração para outra pessoa, sem pedir ao suporte. Hoje a aba Equipe só convida, cancela convite e remove; o papel é uma etiqueta.

Fora: mudar o próprio papel (o backend recusa: o admin só muda de papel pela transferência), promover direto a admin sem transferir, convidar como admin, editar pessoa (nome, e-mail), e qualquer coisa do gestor ou do analista (não mudam papel de ninguém).

## O que o backend dá (lido no código da `develop`)

- `PATCH /empresa/usuarios/{id}` `{ papel: "gestor" | "analista" }`, só admin. Responde no formato de um item de `GET /empresa/usuarios` (`id`, `nome`, `email`, `papel`, `administrador` obsoleto, `criado_em`). O mesmo papel de novo é 200 sem mudar nada. 409 "O admin só muda de papel pela transferência." se o alvo é o próprio admin ou um admin; 404 para pessoa removida, de outra conta ou inexistente; 422 para `papel: "admin"`; 403 para quem não é admin.
- `POST /empresa/admin/transferencia` `{ usuario_id, senha_atual? }`, só admin, **5 por minuto por usuário** (429). Confirma como o `DELETE /me`: conta com senha pede `senha_atual` (400 "Senha atual incorreta."); conta só do Google exige login recente (409 "Entre de novo com o Google para confirmar."). Depois: 409 "O papel de admin já é seu. Escolha outro usuário da conta." se o destino é quem pede; 409 "O papel de admin já foi transferido." se outra transferência passou na frente; 404 se o destino não é pessoa ativa da conta. Numa transação o admin vira **gestor** e o destino vira admin. Responde 200 com `{ itens }`, a lista da conta já com os papéis novos. **Nenhuma sessão é encerrada**: o papel é lido do banco a cada requisição, então o `GET /me` já traz o papel novo.

## Decisões

- **Onde:** no menu de papel de cada pessoa da aba Equipe, só para o administrador. A etiqueta do papel vira um botão com seta que abre um menu: **Gestor**, **Analista** (cada um com a descrição que o convite já usa) e, separado por um filete, **Tornar administrador…**. Para gestor e analista a etiqueta continua só etiqueta. A própria linha do administrador e as de quem já é admin não têm menu.
- **Trocar papel entre gestor e analista é imediato**, sem confirmação (padrão de Linear e Notion): o menu fecha, a linha mostra "Salvando…" e depois o papel novo; o erro aparece na própria linha. Escolher o papel que a pessoa já tem não chama o backend.
- **Transferir pede confirmação**, porque tira poder de quem faz: janela modal (a mesma `ModalDaTela`, fundo desfocado e entrada suave) com o aviso "X passa a ser o administrador da conta e você passa a ser Gestor. Só o novo administrador pode desfazer isso.", o campo **Senha atual** (conta com senha) e os botões "Transferir administração" e "Cancelar". Conta só do Google não tem o campo: o backend confere o login recente, e o 409 aparece na janela com o texto dele.
- **Depois de transferir:** a lista da resposta substitui a da tela, a janela fecha, a página relê (`router.refresh()`, que traz o papel novo do `/me`) e a aba mostra "X agora é o administrador da conta. Você é Gestor." num aviso `role="status"`. Quem acabou de virar gestor perde, na hora, os controles de administrador (menu de papel, Remover) e o texto "Desativar conta" deixa de falar em remover a equipe.
- **Erros** na linguagem da tela: 400 "Senha atual incorreta." sob o campo; 429 "Muitas tentativas. Tente de novo em N minutos." (`Retry-After`); 403 "Seu papel na conta não permite fazer isso." e relê a equipe; 404 "Essa pessoa não está mais na conta." e relê a equipe; os 409 vão com o texto do backend; 401 vai ao login; rede fora, "Não foi possível falar com o servidor.".
- **A conta de demonstração** não troca papel nem transfere (recusa na ação, como convidar e remover).
- **Contexto:** `ProvedorDaConta` passa a carregar `temSenha` (`useTemSenha()`), vindo do `Shell`, que já o recebe do `GET /me`.

## Arquitetura

- `app/(app)/e/[empresa]/equipe/acoes.ts`: `trocarPapel(id, papel)` e `transferirAdmin(usuarioId, senhaAtual)`; validam UUID e papel (Server Action é endpoint público; `papel` só gestor ou analista), recusam a demonstração e traduzem os erros; `transferirAdmin` devolve a lista nova.
- `app/(app)/e/[empresa]/empresas/menu-de-papel.tsx`: o botão da etiqueta e o menu (abre/fecha por clique, Esc e clique fora; setas entre os itens; `aria-haspopup="menu"`, `role="menu"` e `menuitemradio`).
- `app/(app)/e/[empresa]/empresas/transferir-admin.tsx`: a janela de confirmação.
- `empresas/painel-da-equipe.tsx`: a linha da pessoa usa o menu; guarda o estado de "salvando" e o erro por linha; recebe a lista nova da transferência.
- `conta.tsx` e `shell.tsx`: `temSenha`. CSS em `app/globals.css` (`.equipe-papel-botao`, `.equipe-menu`, o filete do menu). Central de ajuda: a função Equipe ganha "trocar o papel" e "transferir a administração". `CLAUDE.md`: o bullet de equipe e convites deixa de dizer "not built".

## Testes

- Ações: formato do corpo enviado, UUID e papel inválidos recusados antes do backend, demonstração, cada status da lista de erros, `senha_atual` ausente na conta só do Google, a lista devolvida na transferência.
- Menu: só o admin vê; itens e descrições; escolher o mesmo papel não chama o backend; escolher outro chama, mostra "Salvando…", atualiza a etiqueta e relê a página; erro na linha; Esc e clique fora fecham; setas andam; a própria linha e as de admin não têm menu.
- Transferência: aviso com o nome certo; senha obrigatória na conta com senha e ausente na só-Google; 400 sob o campo; 409 e 429 na janela; **duplo envio sai uma vez só**; sucesso fecha a janela, mostra o aviso, relê a página e troca a lista; Esc, Cancelar e clique no fundo fecham.
- Contexto: `useTemSenha()` com o valor do provedor e padrão `true` fora dele.
- Guia de estilo e guarda de rotas continuam verdes.
- **Verificação real** contra o backend local da `develop`, com uma segunda pessoa na conta (o convite por e-mail está desligado no backend local, então a segunda pessoa entra por inserção no banco local, com backup antes): trocar papel, escolher o mesmo, transferir com senha errada e certa, ver a tela da pessoa que virou administrador (outra sessão), rebaixado perde os controles, claro, escuro e celular por captura.

## Riscos e pontos a confirmar

- **Conta só do Google:** o 409 pede um login recente e o front só mostra o texto; se a pessoa precisar de um botão que refaça o login pelo Google, é uma entrega à parte (a desativação de conta tem o mesmo comportamento hoje).
- **Duas abas do mesmo administrador:** a segunda transferência recebe "O papel de admin já foi transferido." e a tela relê.
- **Quem foi rebaixado com a tela aberta:** o `GET /me` só é relido por carregamento; a primeira ação recusada responde 403 e a tela relê o papel.
- **Limite de 5 por minuto** na transferência: o texto do 429 usa o `Retry-After`.
