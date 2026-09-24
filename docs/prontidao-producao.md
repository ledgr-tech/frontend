# Prontidão para produção — `develop` → `main`

Situação em 24/09/2026. **Recomendação: ainda não fazer o merge para a `main`.** O
código do front está em bom estado, mas faltam três coisas fora dele, e a `main`
receberia 27 commits de uma vez — toda a integração com o backend desde o PR #22.

Ordem segura:

1. Backend com os endpoints publicados em produção
2. Variáveis de ambiente na Vercel (Production e Preview)
3. `develop` do front para a `main`

## O que bloqueia

- [ ] **Backend em produção sem endpoints.** A `main` do backend tem só o esqueleto
      (health); a `develop` dele está 74 commits à frente. Se o Railway publica a
      `main`, o front em produção quebra inteiro. Saída: levar a `develop` do backend
      para a `main`, ou apontar o Railway para a `develop`. *(time de backend)*
- [ ] **Variáveis da Vercel não confirmadas** (card #23). Sem
      `LEDGR_CONTA_TESTE_EMAIL` / `LEDGR_CONTA_TESTE_SENHA`, ninguém entra em
      produção; sem elas também no escopo "Preview", o login falha nos previews.
- [ ] **Acesso compartilhado.** Enquanto não houver login de verdade
      (ledgr-tech/backend#57), todo mundo entra na mesma empresa de teste: quem tiver
      a senha vê todos os extratos enviados. Com dados fictícios de demonstração,
      tudo bem; com extrato bancário real, é problema de LGPD — e os links de Termos
      e Privacidade ainda apontam para `#`.

## Verificações de segurança

| Verificação | Estado |
| --- | --- |
| Proteção da `main` | ✅ Exige o check `test` (lint, testes, build) e 1 aprovação; sem force push nem deleção. ⚠️ Admin pode passar por cima (`enforce_admins` desligado). |
| Dependências (`npm audit --omit=dev`) | ✅ 0 vulnerabilidades conhecidas. ⚠️ `next-auth` em versão beta (5.0.0-beta.32). |
| Sessão e acesso | ✅ Cookie httpOnly, rotas do app checadas no servidor, token nunca vai ao navegador, proteção CSRF das Server Actions (padrão do Next). |
| Conta de teste e atalhos | ✅ Senha só no servidor (`lib/conta-teste.ts`), atalho de demonstração desligado por padrão (PR #24). |
| Upload | ✅ Limite de 4 MB no front e 4,5 MB nas Server Actions (teto da Vercel). ⚠️ No backend, o limite de 10 uploads/min é por IP, mas o IP visto é o do proxy do Railway (e, com a Vercel, o dos servidores dela): na prática é global para todos os usuários. |
| Varredura automática no CI (CodeQL, Dependabot, audit) | ❌ Não existe — o CI só roda lint, testes e build. |
| Cabeçalhos de segurança (CSP, X-Frame-Options, etc.) | ❌ Nenhum configurado no `next.config.ts`. |
| Limite de tentativas de login | ⚠️ Só no navegador (`lib/tentativas.ts`), fácil de contornar. Risco baixo com senha forte, mas sem barreira no servidor. |
| Validação dos IDs nas Server Actions | ⚠️ Os IDs vão para a URL do backend sem checar se são UUID. O backend valida o token, então não dá acesso a outra empresa, mas vale endurecer. |
| Revisão de segurança do diff `develop` → `main` | ❌ Não foi feita. |

## Antes do merge para a `main`

- [ ] **Backend:** publicar os endpoints em produção; trocar a chave do limite de
      upload do IP para o `empresa_id` do token.
- [ ] **Vercel:** configurar as variáveis do card #23 (Production e Preview), com
      senha nova para a conta de teste.
- [ ] **Uso:** produção só com dados fictícios até existir login real e as páginas
      de Termos e Privacidade.
- [ ] **Front:** cabeçalhos de segurança no `next.config.ts`, validação de UUID nas
      Server Actions, `npm audit` e Dependabot no CI.
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
- Card #5 — autenticação (depende de ledgr-tech/backend#57)
- PRs #24, #26, #27, #29 — o que está na `develop` e ainda não na `main`
