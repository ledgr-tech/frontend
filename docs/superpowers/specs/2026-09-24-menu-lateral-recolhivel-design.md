# Ledgr — Menu lateral recolhível

## Contexto

O menu lateral era o do design (`.ledgr-aside` em `v2- informações simples/Ledgr.dc.html`):
mascote como avatar no topo com a linha "tudo em ordem", cinco destinos só em
texto e o bloco da empresa com "Ver o site". O pedido (24/09/2026):

- menu que **recolhe**, como os painéis laterais de navegador;
- tirar o **mascote do topo** — ele vai ser a IA do sistema, no próprio menu;
- tirar **"Ver o site"**;
- **ícones** nos itens;
- **troca de tema** no menu, como ícone e não texto;
- recomendações do que mais cabe no menu, **seguindo o mercado**.

## Decisões

1. **Referência de mercado: o sidebar do shadcn/ui** (e Linear, ChatGPT, Claude,
   Vercel). Recolhe para uma faixa de ícones, `Ctrl+B` alterna, dica com o nome ao
   passar o mouse, escolha lembrada entre visitas, conta do usuário no rodapé.

2. **Ícones Lucide, só no menu.** É o conjunto que o readme do design system pede.
   Traço 1,5 e cor do texto, para acompanhar o filete do sistema. O `DESIGN.md`
   dizia "zero ícone"; foi atualizado — fora do menu a regra continua.
   Extratos `Files`, Conciliações `ArrowLeftRight`, Fechamentos `CalendarCheck`,
   Histórico `History`, Assinatura `CreditCard`.

3. **O estado mora em `html[data-menu]`, não no React.** O script do `<head>` que já
   aplicava tema e densidade agora lê `ledgr_menu` antes da primeira pintura — o menu
   recolhido não abre largo e encolhe. Recolher e abrir são dois botões e o CSS
   mostra um de cada vez; por isso não há estado nem diferença de hidratação. O
   botão clicado some, então o foco passa para o que aparece no lugar.

4. **Topo: as três barras do logo, redesenhadas em SVG.** O PNG é 63% preto e
   sumiria no tema escuro; o SVG pinta com `currentColor`. Recolhido, o logo é o
   próprio botão de abrir e vira o ícone do painel no hover — como no ChatGPT.

5. **"Nova conciliação" no topo do menu**, como o "New issue" do Linear. O item
   aceso já usa o contorno dourado do design, então a ação ganha também o tom
   dourado por baixo para não ser lida como "você está aqui".

6. **"em breve" escrito**, não só apagado, em Fechamentos e Assinatura. Antes o
   aviso ficava num `title`, invisível para quem não passa o mouse.

7. **Assistente: o card do design, parado.** Mascote do chatbot, "Assistente",
   "Fale com o Ledgr" e "em breve", tracejado e sem clique — a conversa não tem
   backend, e a regra do projeto é não fingir. O ponto de troca está num comentário
   `ponytail:` no `menu-lateral.tsx`.

8. **Conta no rodapé.** Iniciais, nome (do e-mail da sessão) e empresa; um clique
   abre o menu da conta com o e-mail e "Sair", para cima no menu aberto e para o
   lado no recolhido. A barra superior ficou só com a busca e os Avisos. O ponto
   de aviso no avatar saiu junto com o mascote: o contador dos Avisos já diz isso.

9. **Coluna de 236 para 248px.** Ícone, "Fechamentos" e a etiqueta "em breve" não
   cabiam em 236px sem cortar o nome. 248px fica dentro da faixa de mercado
   (240–256px). Recolhido, 64px.

10. **Dicas só onde aparecem.** A dica é um `::after` com `content: attr(data-dica) / ""`
    — o `/ ""` tira o texto do nome acessível. Ela só é gerada nos botões só de
    ícone e, recolhido, em todos os itens: gerada e escondida, vazava da lista e
    abria rolagem lateral no menu aberto.

11. **No celular o menu não recolhe.** Deita em três faixas: marca e conta
    (só as iniciais) com o tema; "Nova conciliação"; destinos. O assistente some.
    O menu da conta abre para baixo.

12. **Indicador do `next dev` no canto inferior direito** (`devIndicators` no
    `next.config.ts`). No esquerdo ele cobria a conta. Só existe em desenvolvimento.

## Verificado no navegador

- **Aberto, tema escuro, 1280×800:** símbolo, "Ledgr" e recolher no topo; "Nova
  conciliação" com o tom; ícones; "em breve" sem cortar o nome; assistente com o
  mascote; conta e sol no rodapé; sem rolagem lateral no menu.
- **Recolhido:** 64px; foco vai para "Abrir menu"; dica com o nome no hover; logo vira
  o ícone de abrir no hover, com a dica passando por cima da barra superior; menu da
  conta abre ao lado; a escolha sobrevive ao recarregar a página.
- **`Ctrl+B`** abre de novo; **tema claro** com a lua no rodapé e o logo preto.
- **375 e 320px:** três faixas, menu de 265px (era 275px), menu da conta dentro da tela,
  sem rolagem lateral.
