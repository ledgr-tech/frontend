# Central de ajuda e botão Ajuda (#171)

Aprovado em 20/10/2026, a partir do modelo navegável (artefato "Ajuda do Ledgr"). Origem: mentoria de 19/10 — toda tela com um botão de ajuda que abre a página dela, com imagens e instruções curtas (referência: a central de soluções do Domínio). A wiki também vira a base do assistente (backend#137).

## O que foi decidido

- **Sem editor.** As páginas ficam em `app/(app)/ajuda/paginas.ts`; mudar um texto é um commit. Os textos ainda passam pela revisão dos sócios, como os do tutorial do mascote.
- **O "?" vira o botão "Ajuda"**, no desenho do "Avisos" ao lado (ícone e rótulo; só o ícone no celular). Ele abre um menu com o que a tela tem:
  - "Ajuda desta tela": um painel à direita (folha de baixo no celular), não modal, com os passos, a nota e o "se der errado". Só nas telas com página: Nova conciliação, comparação e linha da comparação.
  - "Rever o tutorial": o que o "?" fazia, nas telas com tutorial.
  - "Central de ajuda": sempre.
- **A Central é uma tela do app** (`/ajuda/[pagina]`; `/ajuda` abre a primeira): índice com busca sem acento, e a página com o passo a passo sobre uma miniatura da tela com os números dos passos, perguntas comuns, o atalho para o assistente e as páginas vizinhas.
- **A imagem da tela é uma miniatura desenhada** (`planta.tsx`) com os tokens do app, em vez de um print: segue o tema claro/escuro e não envelhece quando a tela muda.
- **Vídeo só quando existir**: o campo `video` aponta para um arquivo em `public/ajuda/`. Sem gravação, a página não mostra player vazio.

## Fora, por ora

- "Esta página ajudou?": sem rota no backend para guardar a resposta, o botão não fingiria salvar.
- Páginas de Fechamentos e Extratos: entram depois do fluxo principal.
- Quem grava os vídeos: em aberto.
