# Ledgr — Menu lateral e barra superior

## Contexto

O shell do app (`(app)/layout.tsx`) era o do protótipo navegável: uma barra com
"Ledgr / Dashboard / Sair". O design tem um shell de duas partes — bloco `APP` em
`v2- informações simples/Ledgr.dc.html`, linha 503:

- **menu lateral** (`.ledgr-aside`, linha 505): avatar com ponto de aviso, marca,
  cinco destinos, card do assistente e bloco da empresa;
- **barra superior** (linha 594): busca com atalho ⌘K, Avisos com painel, toggle
  de tema e bloco do usuário.

Adiar isso foi decisão do spec anterior: três dos cinco destinos não existiam, e
trocar CTA morto por item de menu morto não é progresso. Com `/historico` e
`/regras` no ar, o menu passou a ter para onde apontar.

## Recorte

Entram o chrome e os Avisos. Ficam de fora, cada um por ser feature própria:

- **Tema escuro.** O design aplica uma classe `ledgr-noite` que recolore o sistema
  inteiro. O `globals.css` não tem um único token de dark mode — é trabalho de
  design system e revisão das sete telas, não de menu.
- **Card do assistente.** O painel de conversa no pé do menu é feature de produto.
- **Busca agrupada.** O design agrupa resultados por tipo, incluindo arquivos, que
  ainda não existem como dado. Aqui a busca varre os lançamentos que existem.

## Decisões (21/09/2026)

1. **Os três destinos sem tela aparecem apagados**, não escondidos: `<span>` com
   `aria-disabled="true"` e um título dizendo que vem depois. O menu já mostra a
   forma final do produto sem link morto. Extratos, Fechamentos e Assinatura.

2. **"Conciliações" fica aceso em toda a árvore de conciliação** (`/dashboard` e
   qualquer `/conciliacoes/...`), como o `navEstilo` do design, que acendia o item
   para dashboard, conciliacao e detalhe juntos. Estado por `usePathname`, marcado
   com `aria-current="page"` além da borda dourada — a cor não pode ser o único
   sinal de onde você está.

3. **`/regras` não ganhou item de menu.** Não está entre os cinco do design; chega
   pelas sugestões da dashboard e pelo detalhe da divergência.

4. **"Sair" mudou de lugar, não desapareceu.** A barra superior do design tem o
   bloco do usuário mas nenhum logout — e o menu antigo tinha. Ficou ao lado do
   nome, no bloco do usuário.

5. **Nome e iniciais saem do e-mail da sessão**, não fixos: o design mostra "MS /
   Financeiro" chumbado, e aqui `financeiro@telhacerta.com.br` vira "Financeiro" e
   "FI".

6. **Dois dos três avisos não são clicáveis.** Levariam à comparação folha a folha
   e ao fechamento, que não existem. Mesma regra dos CTAs: sem destino, sem link.

7. **Dois efeitos separados no layout, de propósito.** O primeiro checa a sessão e
   depende de `router`; o segundo lê o "já li" dos avisos e não tem dependências.
   Juntos num só, o efeito reroda quando o `router` troca de identidade e relê o
   localStorage, desfazendo o clique em "Marcar como lidos" — foi o teste do layout
   que pegou isso.

8. **`maxWidth: 1180` saiu do `<main>`.** Com uma coluna de menu de até 236px, a
   largura do conteúdo é a do design, e as telas já têm os próprios limites
   (`det-corpo`, `regras-corpo`, `hist-corpo`).

9. **No celular os itens do menu medem o próprio texto.** O design deita o menu
   até 900px, mas o `width: 100%` dos itens em pé os deixava um por linha: cinco
   linhas, 490px de cabeçalho antes do conteúdo. Com `width: auto` eles embrulham
   em duas linhas e o cabeçalho cai para 275px.

## Verificado no navegador

- **Menu:** cinco itens na ordem do design, Conciliações aceso na dashboard e nas
  rotas de conciliação, os três sem tela apagados, avatar com o ponto de aviso.
- **Busca:** "aço" acha "Boleto Aço Norte Bobinas · 04/09 · R$ 12.640,00" e o
  resultado leva ao detalhe; Escape fecha; Ctrl+K põe o foco.
- **Avisos:** painel com os três, contador 3, "Marcar como lidos" apaga o ponto e
  troca a linha para "tudo em ordem".
- **Sem rolagem lateral** em 320, 375, 768 e 900px nas quatro rotas do app.
