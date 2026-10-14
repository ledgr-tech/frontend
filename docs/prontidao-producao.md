# Prontidão para produção — `develop` → `main`

Situação em 24/09/2026, atualizada em 25/09 com o endurecimento do front e o login real,
e em 09/10 com os Termos e a Privacidade e o limite de login por IP.
**Recomendação: ainda não fazer o merge para a `main`.** O código do front está em
bom estado, mas faltam três coisas fora dele, e a `main` receberia de uma vez toda a
integração com o backend desde o PR #22 (44 commits em 25/09).

Ordem segura:

1. Backend com os endpoints publicados em produção
2. Variáveis de ambiente na Vercel (Production e Preview)
3. `develop` do front para a `main`

## O que bloqueia

- [ ] **Backend em produção sem endpoints.** A `main` do backend tem só o esqueleto
      (health); a `develop` dele está 74 commits à frente. Se o Railway publica a
      `main`, o front em produção quebra inteiro. Saída: levar a `develop` do backend
      para a `main`, ou apontar o Railway para a `develop`. *(time de backend)*
- [ ] **Variáveis da Vercel não confirmadas** (card #23). Sem `NEXTAUTH_SECRET`
      igual ao da Railway e `LEDGR_API_URL`, ninguém entra em produção; sem elas
      também no escopo "Preview", o login falha nos previews.
      `LEDGR_CONTA_TESTE_EMAIL` / `LEDGR_CONTA_TESTE_SENHA` só servem ao atalho de
      demonstração.
- [ ] **Termos e Privacidade: falta o texto revisado** (issue #110). As páginas
      `/termos` e `/privacidade` existem, abrem sem login e estão linkadas no aceite
      do cadastro (em nova aba), no login e no rodapé da landing (commit `3e21024`).
      O texto é provisório e diz isso na página ("Versão preliminar… Em revisão
      jurídica"). Falta o texto final do jurídico e decidir se o backend guarda a
      versão e a data do aceite. Com extrato bancário real, é problema de LGPD.

## Verificações de segurança

| Verificação | Estado |
| --- | --- |
| Proteção da `main` | ✅ Exige o check `test` (lint, testes, build) e 1 aprovação; sem force push nem deleção. ⚠️ Admin pode passar por cima (`enforce_admins` desligado). |
| Dependências (`npm audit --omit=dev`) | ✅ 0 vulnerabilidades conhecidas. ⚠️ `next-auth` em versão beta (5.0.0-beta.32). |
| Sessão e acesso | ✅ Cookie httpOnly, rotas do app checadas no servidor, token nunca vai ao navegador, proteção CSRF das Server Actions (padrão do Next). |
| Login e atalho de demonstração | ✅ Senha conferida pelo backend (`POST /login`), sem conta nem senha no código. Atalho de demonstração desligado por padrão, com a conta só no ambiente do servidor. |
| Upload | ✅ Limite de 4 MB no front e 4,5 MB nas Server Actions (teto da Vercel). ⚠️ No backend, o limite de 10 uploads/min é por IP, mas o IP visto é o do proxy do Railway (e, com a Vercel, o dos servidores dela): na prática é global para todos os usuários. |
| Varredura automática no CI (CodeQL, Dependabot, audit) | ✅ `npm audit --omit=dev --audit-level=high` no CI e Dependabot semanal contra a `develop` (`.github/dependabot.yml`). ⚠️ CodeQL não; alertas e atualizações de segurança do Dependabot são configuração do repositório, ainda por ligar. |
| Cabeçalhos de segurança (CSP, X-Frame-Options, etc.) | ✅ `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS e sem `X-Powered-By`. ⚠️ CSP só em `Report-Only`: aponta no console, não bloqueia. Impor pede tirar o script inline do tema (ou nonce) e decidir sobre o toolbar da Vercel nos previews. |
| Limite de tentativas de login | ⚠️ No navegador (`lib/tentativas.ts`) e no backend (10 `/login` e 5 `/register` por minuto por IP). Mas quem chama o backend é o servidor da Vercel, então o limite do backend vale para todos os usuários juntos: 11 entradas no mesmo minuto, de pessoas diferentes, já recebem "acesso pausado". Em andamento: o front repassa o IP do navegador com um segredo compartilhado (`LEDGR_SEGREDO_PROXY`, issue #108, PR #109), e o backend passa a usá-lo (ledgr-tech/backend#101). Vale quando os dois estiverem publicados e a variável existir nos dois lados. |
| Validação dos IDs nas Server Actions | ✅ Todo id que entra no caminho ou na query do backend é conferido como UUID antes (`situacaoDoExtrato`, `carregarConciliacao`, rota do CSV). Os que vão no corpo JSON o backend valida. |
| Revisão de segurança do diff `develop` → `main` | ❌ Não foi feita. |

## Antes do merge para a `main`

- [ ] **Backend:** publicar os endpoints em produção; trocar a chave do limite de
      upload do IP para o `empresa_id` do token.
- [ ] **Vercel:** configurar as variáveis do card #23 (Production e Preview).
- [ ] **Backend e Vercel:** limite de `/login` e `/register` pelo IP do navegador, não o
      da Vercel (backend #64 e PR #101; front #108 e PR #109). Falta publicar o
      backend e criar `LEDGR_SEGREDO_PROXY`, com o mesmo valor, no Railway e na Vercel.
- [ ] **Uso:** produção só com dados fictícios até o texto de Termos e Privacidade
      ser revisado pelo jurídico (as páginas já existem, com texto provisório).
- [x] **Front:** cabeçalhos de segurança no `next.config.ts`, validação de UUID nas
      Server Actions, `npm audit` e Dependabot no CI.
- [ ] **Front, depois:** impor a CSP (hoje `Report-Only`) e ligar alertas e
      atualizações de segurança do Dependabot nas configurações do repositório.
- [ ] **Revisão:** revisão de segurança do diff `develop` → `main`; depois, PR para a
      `main` com aprovação de alguém do time.

## O que não foi verificado

Tudo acima vem do código dos dois repositórios, dos PRs e da configuração do GitHub.
Os painéis da Vercel e do Railway não foram vistos.

- [ ] De qual branch o Railway publica o backend (`main` ou `develop`)
- [ ] Quais variáveis já existem na Vercel, e em quais escopos
- [ ] De qual branch a Vercel publica a produção do front

## Relacionados

- Card #23 — variáveis de produção na Vercel
- Issue #110 — Termos e Privacidade (texto final e registro do aceite)
- Issue #108 — IP do navegador para o limite de tentativas
- Card #5 — autenticação (login e cadastro reais sobre ledgr-tech/backend#57)
- PRs #24, #26, #27, #29 — o que está na `develop` e ainda não na `main`
