# Ledgr — Teste manual de 28/09: triagem

## Contexto

Teste manual de 28/09/2026 (documento "Ledgr – Teste manual – 28_09.docx", feito
com a conta de teste do backend). São 15 apontamentos: 9 de tela e UI, 6 de
funcionalidade. Esta nota separa o que o front resolve sozinho, o que depende do
backend e o que ficou para depois, e registra as decisões que os planos seguem.

A regra de sempre vale: a tela só promete o que o produto faz hoje.

## Triagem

| # | Apontamento do teste | Destino |
|---|---|---|
| 1 | Cadastro, passo inicial: "Nome completo" não seria o nome da empresa? | Plano A, tarefa 2 (vira "Seu nome") |
| 2 | Cadastro: o olho da senha parece invertido | Plano A, tarefa 1 |
| 3 | Cadastro, passo II: avisar que dá para adicionar outros bancos depois, nas configurações | Plano A, tarefa 2 (sem "nas configurações", ver decisão 3) |
| 4 | Cadastro, passo III: dizer que o PDF de lançamentos do ERP também serve | Plano D, tarefa 2 |
| 5 | Cadastro: um "Criando sua conta…" depois de concluir | Plano A, tarefa 3 |
| 6 | Visão geral, passo II: "O CSV e PDF do seu ERP funciona" | Plano D, tarefa 2 (o travessão da frase sai no Plano C) |
| 7 | Conciliações: falar do PDF nos cartões de arquivo | Plano D, tarefa 1 |
| 8 | Conciliações: tirar o travessão da "Regra de ouro" ("cara de IA") | Plano C, tarefa 1 |
| 9 | Assinatura: no primeiro acesso, só os planos; o status depois de assinar | Adiado. O próprio teste deixou para quando a cobrança existir |
| 10 | Configurações, Aparência: ao trocar o tema, o seletor desce na tela | Plano B, tarefa 2 |
| 11 | Cabeçalho: trocar o ⌘K do Mac por Ctrl | Plano B, tarefa 1 |
| 12 | Login: erros e botões certos | Passou, nada a fazer |
| 13 | Cadastro: e-mail ou CNPJ já cadastrado só aparece no fim, depois de todos os passos | Backend, B2. Em 28/09 a decisão foi aguardar a rota do backend |
| 14 | E-mail de boas-vindas no cadastro | Backend, B3 |
| 15 | Troca de senha funciona dentro e fora do app; falta trocar o link do e-mail | Backend e deploy, B4 |

Planos:

- **Plano A**: [2026-09-28-cadastro-teste-manual.md](../plans/2026-09-28-cadastro-teste-manual.md) (itens 1, 2, 3, 5)
- **Plano B**: [2026-09-28-app-teste-manual.md](../plans/2026-09-28-app-teste-manual.md) (itens 10, 11)
- **Plano C**: [2026-09-28-textos-sem-travessao.md](../plans/2026-09-28-textos-sem-travessao.md) (item 8 e o mesmo tique no resto do texto)
- **Plano D**: [2026-09-28-pdf-do-erp.md](../plans/2026-09-28-pdf-do-erp.md) (itens 4, 6, 7), empilhado sobre o Plano C porque reescreve as mesmas frases

A, B e C são independentes: cada um sai do `develop` no seu branch e pode ir em
qualquer ordem. O D sai do branch do C e entra depois dele. O único arquivo em comum é o `app/globals.css` (A mexe no bloco
do cadastro, B no das configurações), sem sobreposição de linhas.

## Decisões

1. **Olho da senha: o ícone mostra o estado.** O olho seguia a convenção de
   "ícone = ação" (aberto com a senha escondida, fechado com ela à mostra), a do
   botão de revelar senha do Edge e dos exemplos do MUI. Essa convenção depende
   do olho cortado, que se lê como botão; o olho do mascote fechado, com cílios,
   se lê como estado ("não estou vendo"), e foi assim que o teste leu. Passa a
   seguir o estado, como o "ocultar saldo" dos apps de banco: fechado com a
   senha escondida, aberto com ela à mostra. O rótulo acessível e o `title`
   continuam dizendo a ação ("Mostrar senha" / "Ocultar senha"), com
   `aria-pressed`. Como é o mesmo `CampoTexto`, login, cadastro e redefinir
   senha mudam juntos. (Chegou a ficar para depois em 28/09 e foi retomada no
   mesmo dia.)
2. **"Seu nome" no lugar de "Nome completo".** O campo é da pessoa (é o nome
   que os e-mails usam, "Olá, Rafael"). A empresa vem no passo seguinte, como
   "Razão social". "Seu nome" desfaz a dúvida sem mudar o que é pedido.
3. **Outros bancos: sem "nas configurações".** O Ledgr não tem lugar para
   cadastrar banco, e o banco e a conta do passo II nem saem do navegador (o
   `cadastrar` manda só nome, e-mail, senha, razão social e CNPJ). O texto diz
   o que é verdade: cada banco entra na sua própria conciliação, depois.
4. **"Criando sua conta…" é uma tela de transição, não um texto no botão.** É o
   padrão de quem cria conta ou workspace e leva o usuário direto para dentro
   (Linear, Notion, Vercel): o formulário dá lugar a um painel com o que está
   acontecendo e uma barra de progresso. Os textos seguem os fatos: "Criando
   sua conta…" enquanto o servidor trabalha, "Conta criada." quando ele
   responde, e para onde a pessoa está indo. Sem etapas inventadas para
   preencher a espera. Se o servidor recusar, o formulário volta com o erro no
   campo, como hoje.
5. **Atalho da busca por plataforma.** Linear, GitHub, Notion e Vercel mostram
   ⌘K no Mac e Ctrl K no Windows. Trocar para Ctrl fixo erraria o Mac, então o
   atalho segue a plataforma. No servidor sai "Ctrl K" (o caso da maioria), e o
   Mac troca para ⌘K logo depois de hidratar. A tela de Atalhos das
   configurações já fazia essa detecção; ela passa a morar em `lib/plataforma.ts`.
6. **Travessão fora do texto corrido.** O teste apontou um, mas o mesmo tique
   aparece em cerca de 20 frases do app e da landing. O Plano C troca cada um
   por vírgula, dois-pontos, ponto ou parênteses, frase a frase. Ficam o "—"
   que marca célula vazia em tabela e o "–" de intervalo ("1–25 de 80"), que
   são tipografia, não estilo.
7. **PDF do ERP, só do lado do sistema.** Em 28/09 o time confirmou que o
   backend lê o PDF de lançamentos exportado do ERP. Nesse dia o `develop` do
   backend no GitHub ainda listava só `.ofx` e `.csv` em `FORMATOS_SUPORTADOS`
   (`app/api/extratos.py`), então o Plano D entra quando o backend com PDF
   estiver no ar. O banco continua OFX ou CSV: o teste pediu o PDF do ERP.

## Depende do backend

Só relato: o front não mexe no backend, nos issues ou nos cards dele.

- **B1. PDF do ERP (itens 4, 6, 7).** Confirmado pelo time em 28/09 e feito no
  Plano D. O que o front precisa é que o `develop` do backend aceite `.pdf` no
  `POST /extratos/upload` com `origem=sistema`.
- **B2. E-mail ou CNPJ já cadastrado, no passo certo (item 13).** Não há rota
  para conferir antes do `POST /register`, então o 409 só chega no fim. Pedido:
  uma rota de disponibilidade (e-mail no passo de acesso, CNPJ no da empresa),
  com rate limit. Ela confirma se um e-mail tem conta, o que o `/register` já
  confirma hoje com o 409, mas sem exigir um CNPJ válido junto; se isso é
  aceitável é decisão do backend. Quando existir, o front chama a rota no
  "Continuar" de cada passo, com as mesmas mensagens de `JA_CADASTRADO` em
  `app/(auth)/cadastro/page.tsx`, e continua tratando o 409 do fim (duas
  pessoas cadastrando o mesmo e-mail ao mesmo tempo).
- **B3. E-mail de boas-vindas (item 14).** `app/services/email/mensagens.py` tem
  a recuperação de senha e o aviso de senha alterada; faltaria a mensagem de
  boas-vindas, disparada pelo `/register`. Nada muda no front.
- **B4. Link do e-mail de senha (item 15).** O link apontou para
  `https://frontend-hfrnofw9w-ledgr7.vercel.app/redefinir-senha#token=...`, a
  URL de um deploy específico de preview da Vercel, que muda a cada deploy. Vem
  do `FRONTEND_URL` do ambiente do backend e precisa ser um domínio estável.
  Atenção: a produção do front (branch `main`) ainda não tem a página
  `/redefinir-senha` (último deploy em 16/09), então até o `develop` ir para
  produção o domínio certo é o alias estável do branch `develop` na Vercel.
  O Outlook também mostrou o remetente "via amazonses.com", o que costuma
  indicar que o domínio `ledgrfinance.com.br` não está alinhado (DKIM/SPF) no
  provedor de e-mail. Vale o time conferir a verificação do domínio no Resend.

## Adiado

- **Assinatura (item 9).** A tela é toda de demonstração, e o teste pediu para
  esperar a cobrança existir. Quando existir, o estado "sem assinatura" mostra
  só os planos, e o de assinante mostra plano, uso e faturas.

## Em aberto

- **Alternativa só de front para o item 13.** O `/register` precisa só do que
  os dois primeiros passos pedem (acesso e empresa); banco e sistema de gestão
  não vão ao backend. Dá para criar a conta ao fim do passo da empresa, que é
  como Linear e Notion fazem: a conta nasce cedo e o resto vira configuração
  inicial. O custo: os passos II e III passam a acontecer com a conta já criada
  (o "Voltar" do passo II some), e quem abandona ali já tem conta. Em 28/09 a
  decisão foi não fazer e aguardar a rota de disponibilidade do backend (B2).
