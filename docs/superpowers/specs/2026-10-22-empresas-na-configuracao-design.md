# Empresas clientes nas Configurações (#169, parte B)

Data: 22/10/2026 · Backend: ledgr-tech/backend#133 (parte 2, PR #143, na `develop` do backend) · Depende de: [empresa ativa na URL](2026-10-21-empresa-ativa-na-url-design.md) (parte A, já na `develop`).

## Objetivo

O escritório contábil cadastra as empresas clientes sem sair do app e vê quanto do plano já usou. Hoje só há o seletor da parte A, que lista as empresas, e o cadastro inicial, que cria a primeira. Esta entrega traz:

1. a seção **Empresas** em Configurações: lista das empresas da conta e cadastro de uma nova;
2. os **avisos de limite** do plano (empresas e usuários), lidos do `GET /me`.

Fora: troca de papel e transferência de admin (parte C); editar ou remover empresa (o backend não tem a rota); preço e cobrança (gateway).

## Decisões

- **Onde:** seção "Empresas" na janela de Configurações, antes de "Equipe", no mesmo formato de linhas (`useLinhasDasEmpresas`), para a busca da janela achar. Conta com uma empresa só também vê a seção: é por ela que a primeira empresa cliente entra.
- **Quem faz o quê:** todos os papéis veem a lista; admin e gestor cadastram (o analista recebe 403 do backend, então o botão nem aparece, com a linha "Só o admin e o gestor cadastram empresas."). A conta de demonstração não cadastra (`recusaNaDemonstracao`, como na Equipe).
- **Depois de cadastrar, abre a empresa nova** (decisão de 22/10): grava a empresa recente (`gravarEmpresaRecente`) e vai à Visão geral dela. Padrão de Slack, Notion e Linear ao criar um espaço de trabalho; o escritório cadastra o cliente para subir o extrato dele.
- **Razão social à mão.** A rota autenticada não devolve a razão social da Receita (só o cadastro inicial devolve), então o campo é do usuário. O CNPJ é conferido pelo backend (formato, Receita quando ligada).
- **Abrir outra empresa:** cada linha da lista, menos a ativa, tem "Abrir", com a mesma regra do seletor (`destinoDaTroca` + cookie), e a ativa leva a tag "Ativa".
- **Descoberta:** o seletor da barra lateral ganha, no fim da lista, "Gerenciar empresas", que abre Configurações › Empresas (evento `ABRIR_CONFIGURACOES`). Com uma empresa só o seletor não aparece, então o caminho é Configurações.

## O que o backend dá

- `GET /empresas` (todos os papéis): `id`, `razao_social`, `cnpj`, `cnpj_verificado_em`, `criado_em`; ordem por razão social. Rota da conta: ignora `X-Ledgr-Empresa`.
- `POST /empresas` `{ cnpj, razao_social }` (admin e gestor) → 201 no formato do GET. Erros, nesta ordem: 403 papel; 429 com `Retry-After` (20 cadastros por hora na conta); 409 "Empresa já cadastrada nesta conta."; 402 limite do plano (vale para o admin também); 422 CNPJ inválido, não encontrado ou inativo na Receita.
- `GET /me` → `limites: { empresas: { usadas, maximo }, usuarios: { usados, maximo } }`; `maximo` nulo é sem limite. Usuários contam ativos mais convites pendentes. Sem o campo (backend anterior ao #133): nada é mostrado.
- Sem plano escolhido vale o limite do Essencial; ficar acima do limite mantém tudo e só impede adicionar.

## Comportamento

### Lista
Linha por empresa: razão social, CNPJ formatado, tag "CNPJ verificado" quando `cnpj_verificado_em` vem preenchido, tag "Ativa" na da aba, "Abrir" nas outras. Estados como na Equipe: carregando, sem rota (404: "As empresas ainda não estão disponíveis."), falhou com "Tentar de novo".

### Cadastro
Botão "Adicionar empresa" abre o formulário em linha (padrão `cfg-form` do convite): CNPJ (máscara e validação do cadastro, `formatarCnpj`/`validarCnpj`) e razão social (obrigatória, sem espaços nas pontas). Envia o CNPJ só com letras e números, como o cadastro inicial. Enquanto envia, trava o botão. Erros:

| Status | O que a pessoa vê |
| --- | --- |
| 422 | a mensagem do backend sob o campo CNPJ (`ErroBackend.mensagens`, como no cadastro) |
| 409 | "Esta empresa já está cadastrada na conta." sob o CNPJ |
| 402 | a mensagem do backend e o link "Ver planos" (`/assinatura`); relê o `/me` para atualizar o contador |
| 429 | "Muitos cadastros seguidos. Tente de novo em N minutos." (`Retry-After` em `ErroBackend.segundosParaTentar`) |
| 403 | avisa e relê a lista (o papel mudou) |
| 401 | vai ao login |
| 404 | "As empresas ainda não estão disponíveis." |

### Limites
`situacaoDoLimite(usadas, maximo)` (função pura em `lib/limites.ts`) devolve `livre` (sem máximo), `folga`, `perto` (falta 1 ou usou 80% ou mais), `no-limite` ou `acima`.

- **Empresas, na seção:** uma linha "Plano" com "2 de 3 empresas"; em `perto`, a frase "Falta 1 empresa para o limite do plano."; em `no-limite`, o botão "Adicionar empresa" fica desligado e a frase diz "O plano chegou ao limite de 3 empresas. Para adicionar outra, troque de plano em Assinatura." com o link; em `acima`, "A conta tem mais empresas (4) do que o plano permite (3). Nada some; só não dá para adicionar."
- **Usuários, na Equipe:** o mesmo aviso acima do convite, sem desligar o botão: reenviar um convite ao mesmo e-mail não ocupa outra vaga no backend, então o front não pode prever o 402. O 402 do convite mostra a mensagem do backend.
- **Sem `limites`:** nenhuma frase e nenhum botão desligado.

## Arquitetura

- `lib/limites.ts` (+ teste): `Limite`, `LimitesDaConta`, `adaptarLimites(bruto)`, `situacaoDoLimite`, `textoDoLimite`.
- `app/(auth)/acoes.ts`: `ContaDaSessao.limites: LimitesDaConta | null`, lido do `/me`; o `ProvedorDaConta` o carrega e `useLimites()` o entrega.
- `app/(app)/e/[empresa]/empresas/acoes.ts` (+ teste): `carregarEmpresas()` e `cadastrarEmpresa(cnpj, razaoSocial)` por `chamarBackend`, no padrão de `equipe/acoes.ts` (`traduzir`, 401, demonstração).
- `app/(app)/e/[empresa]/empresas/secao-empresas.tsx` (+ teste): `useLinhasDasEmpresas({ aberta, papel })`; entra em `configuracoes.tsx` como a seção `empresas`.
- `equipe/secao-equipe.tsx`: o aviso de usuários e o tratamento do 402.
- `seletor-de-empresa.tsx`: a linha "Gerenciar empresas".
- Central de ajuda: texto da função em `app/(ajuda)/ajuda/paginas.ts` (Configurações), sem imagem nem vídeo.
- O guarda `lib/rotas.guarda.test.ts` continua valendo: tudo navega por `LinkDoApp`/`useRoteador`.

## Testes

- Unitários: `situacaoDoLimite` e `textoDoLimite` (máximo nulo, folga, perto, no limite, acima; singular e plural); `adaptarLimites` (campo ausente, malformado, `maximo` nulo).
- Ações: cada status da tabela de erros, a mensagem do 422, o 429 com `Retry-After`, o corpo enviado (CNPJ normalizado, razão social aparada), recusa na demonstração.
- Seção: lista com "Ativa"/"Abrir"/"verificado"; analista sem botão; limite desligando o botão; cadastro com sucesso grava o cookie e navega para a Visão geral da empresa nova; erro 409 sob o CNPJ.
- Seletor: a linha "Gerenciar empresas" abre a seção certa.
- Verificação real contra o backend local (`develop` do backend, #143): cadastrar, 409 ao repetir, 402 com limite configurado, empresa nova no seletor, duas abas.

## Riscos e pontos a confirmar na implementação

- **CNPJ alfanumérico:** resolvido: `validarCnpj` e `formatarCnpj` do cadastro já aceitam letras (mesmo cálculo do backend), então o formulário os reusa sem mudança.
- **Contador defasado:** `limites` vem do `/me`, lido por carregamento do layout; depois de cadastrar, a navegação à empresa nova já relê. Se o 402 vier com o contador velho, relê-se o `/me`.
- **Limite de 20 por hora** na conta: o aviso de 429 é o único tratamento; não há contador no front.
- **Sem rota** (backend sem o #143): a seção mostra "ainda não disponível" e some o botão; o resto do app segue como hoje.


## Revisão de 22/10 (depois da implementação inicial): Empresas é uma tela do menu lateral

**Decisão do Eduardo:** Empresas não fica dentro das Configurações; vira uma **tela própria no menu lateral**, como Extratos ou Assinatura. Isto substitui "Onde", "Lista", "Cadastro" e "Arquitetura" acima nos pontos em que diferem; o resto (contrato do backend, erros, limites, regras de papel) continua valendo.

- **Rota e menu:** `/e/<empresa>/empresas`, com o item "Empresas" (ícone `Building2`) no menu lateral, entre Histórico e Assinatura (itens da conta juntos). `empresas` entra em `SECOES` (`lib/rotas.ts`), para o prefixo da empresa, o redirect das URLs antigas e o guarda de rotas a reconhecerem.
- **A tela** (padrão de Extratos: Server Component que carrega no servidor, `Cabecalho`, `loading.tsx`): título "Empresas" e contexto "N empresas"; faixa do plano ("2 de 3 empresas do plano", a frase de limite e "Ver planos" no limite); tabela das empresas (razão social com "Ativa", CNPJ formatado com "verificado", data de cadastro, e **Abrir**); botão "Adicionar empresa" no cabeçalho (admin e gestor; desligado no limite) que abre um painel com o formulário acima da tabela. O analista só vê a lista, com a frase "Só o admin e o gestor cadastram empresas.".
- **Abrir** leva à **Visão geral** da outra empresa (não à mesma tela: daqui não há tela com a qual manter a correspondência), gravando a empresa recente. Cadastrar com sucesso abre a Visão geral da empresa nova, como antes.
- **Seletor:** o item do fim da lista passa a ser um link para `/empresas` ("Gerenciar empresas"), não mais o evento da janela de Configurações.
- **Configurações:** volta a ter as seções de antes; a seção Empresas e o texto dela na Central saem.
- **Ajuda:** a Central ganha a página "Empresas" (com capa, uma captura da tela) na ordem do menu; sem tutorial do mascote por ora (a Assinatura também não tem).
- **Mantido da implementação inicial:** regras dos limites (`lib/limites.ts`), `limites` do `/me` até `useLimites()`, ações `carregarEmpresas`/`cadastrarEmpresa`, aviso de pessoas na Equipe.


## Revisão de 23/10: a Equipe vira a segunda aba da tela Empresas (opção A)

**Decisão do Eduardo, depois de ver três opções em artefato:** a gestão da equipe sai das Configurações e entra na tela Empresas, como a aba **Equipe** ao lado de **Empresas** (opção A, "abas"). Substitui, para a Equipe, o que a spec de equipe e convites (`2026-10-16-equipe-e-convites-design.md`) dizia sobre ficar em Configurações; as regras de papel e convite não mudam.

- **Abas:** `Empresas N` e `Equipe M` sob o cabeçalho. A aba escolhida vai em `?aba=equipe` (sem o parâmetro, Empresas); trocar de aba não recarrega a tela. A equipe é carregada junto com a tela, para o número da aba e a troca serem imediatos.
- **Cabeçalho:** o botão de ação segue a aba: "Adicionar empresa" em Empresas, "Convidar pessoa" em Equipe. A linha de contexto continua "N empresas".
- **Faixa do plano com barra de uso** nas duas abas ("4 de 6 empresas", "3 de 5 pessoas"): a barra só existe quando há máximo; o texto de aviso é o de `textoDoLimite`.
- **Equipe:** cada pessoa com avatar de iniciais, nome, e-mail, "você" e o papel como etiqueta (a troca de papel é a parte C do #169, fora desta entrega); "Remover" só para o administrador, com a confirmação na própria linha, como era. Convites pendentes em linhas tracejadas, com o papel, a validade e "Cancelar". O convite é um painel com o e-mail e **cartões de papel** que explicam cada um (o gestor só vê o Analista); o aviso de limite de pessoas continua só avisando, sem desligar o convite.
- **Analista:** vê a lista e a frase "Só o administrador e o gestor convidam pessoas; só o administrador remove."
- **Configurações:** perdem a seção Equipe; o texto de "Desativar conta" aponta para Empresas › Equipe. A Central de ajuda move a função Equipe para a página Empresas.
