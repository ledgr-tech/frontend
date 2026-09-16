# Ledgr — Tela de cadastro

## Contexto

Até aqui o `/login` era a única porta de entrada: o link "Criar acesso em três passos" não levava a lugar nenhum e não existia cadastro. O Claude Design (`Ledgr.dc.html`, tela "onboarding") tem um fluxo em três passos — empresa, banco e sistema de gestão — mas ele não cria credenciais de acesso (não pede senha). Ainda não há backend: autenticação real é a issue #5.

## Decisões (15/09/2026)

1. **Acesso + três passos.** Um passo de acesso (nome completo, e-mail, senha) antes dos três passos do design. O texto do passo de acesso não existe no design e foi escrito para esta tela; os três passos seguintes usam título, texto, campos, exemplos, botão e dica do export.
2. **Layout igual ao login**, não as duas colunas do design: linhas laterais sutis, rótulos flutuantes (`_compartilhado/campo-texto.tsx`) e erros junto ao campo (terracota, `MensagemErro`). O numeral do passo aparece no rótulo ("Passo I de III"). O mascote do passo fica à direita, grande e apagado, com a dica embaixo.
3. **Rota `/cadastro`** no grupo `(auth)`, ao lado do `/login`. Peças usadas pelas duas telas ficam em `app/(auth)/_compartilhado/` (pasta privada, não vira rota).
4. **Final do fluxo:** "Concluir e subir extratos" entra com a sessão mock e leva a `/conciliacoes/nova`, como no design.
5. **Aceite (LGPD):** no passo de acesso, abaixo do botão, "Ao continuar, você aceita os Termos e a Política de privacidade." As duas páginas ainda não existem (links `#`, como no rodapé).

## Passos

| # | Rótulo | Título | Campos | Botão |
|---|---|---|---|---|
| — | Antes de começar | Crie seu acesso. | Nome completo, E-mail, Senha | Continuar |
| I | Passo I de III | Vamos cadastrar a empresa. | Razão social, CNPJ | Continuar |
| II | Passo II de III | Qual banco você vai conciliar? | Banco e agência, Conta corrente | Continuar |
| III | Passo III de III | E o sistema de gestão? | Sistema de gestão, E-mail do responsável | Concluir e subir extratos |

O "E-mail do responsável" chega preenchido com o e-mail do passo de acesso. Os exemplos do design ("Padaria Aurora Ltda", "12.345.678/0001-90", "Banco do Brasil · ag. 1234", "45678-9", "Omie, Bling, Tiny, outro…", "financeiro@aurora.com.br") aparecem no campo em foco, quando o rótulo já subiu.

### Ajustes de texto em relação ao design (revisão dos formulários, 15/09/2026)

- **Banco:** o texto original falava do "formato do arquivo", mas a tela pede banco e conta. Passou a ser "Informe o banco e a conta de onde sai o extrato", e o campo virou "Banco e agência", seguindo o exemplo do design.
- **Sistema de gestão:** o texto citava "a lista", mas o campo é livre. Agora diz "se o seu ERP não for um dos compatíveis".
- **Dicas:** "taxa de match automático" virou "mais lançamentos casam automaticamente" (o verbo usado na landing), e "reportada" virou "apontada".
- **Senha:** o requisito "Pelo menos 8 caracteres" fica visível abaixo do campo desde o início e é marcado quando atendido. O olho do mascote mostra ou oculta a senha, como no login.

## Validação

Por passo, ao tocar em Continuar:

- campos obrigatórios vazios;
- e-mail incompleto (mesma mensagem do login, em `_compartilhado/validacao.ts`);
- senha com menos de 8 caracteres;
- CNPJ sem 14 caracteres.

O CNPJ recebe máscara enquanto a pessoa digita (`00.000.000/0000-00`) e aceita o CNPJ alfanumérico da Receita Federal (a partir de julho/2026): letras nas 12 primeiras posições, com os 2 dígitos verificadores numéricos. Por isso o CNPJ e a conta corrente não usam teclado numérico (a conta também pode ter hífen ou X no dígito). Voltar não valida e mantém o que já foi digitado.

## Sem rolagem

- **1366x657:** no passo de acesso com três erros, campos e espaços ficam um pouco menores (`@media (max-height: 700px)`).
- **Celulares baixos (ex.: 360x640):** o texto do passo e o aceite também diminuem.
- **Telas até 480px:** o rótulo "Cadastro" do topo some, para o cabeçalho caber em uma linha.

## Fora do escopo desta etapa

Persistir a conta criada no mock para login posterior, dígito verificador de CNPJ, verificação de e-mail, planos/cobrança e o cadastro real no backend.
