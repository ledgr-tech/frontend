# Primeiro uso: plano em teste, tutoriais e roteiro

Data: 2026-10-15. Origem: teste em produção depois da release de 15/10 (PR #124).
Aprovado em conversa no mesmo dia.

## Problema

Quem cria a conta hoje cai na Visão geral vazia, sem plano, sem saber por onde
começar e sem ninguém explicando cada tela. O cadastro ainda pede o banco e a
conta, que não servem para nada (o backend nunca recebeu esses campos). E "suas
regras" aparecem numa tela de demonstração que não salva nada.

## Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Assinar antes do gateway | Teste grátis de **14 dias**, sem cartão, com o plano escolhido na entrada | É o padrão dos SaaS de gestão para PME no Brasil; o gateway entra depois de 02/11 (ata de 14/10) e as primeiras contas só pagam por volta de 17/11. "Escolher sem pagar e sem prazo" viraria conta grátis sem fim |
| Fim do teste | Bloqueia **nova conciliação** e mostra os planos; o resto continua visível | Mesma regra da ata para quem passa da cota |
| "Cadastrar suas regras" | No MVP é **definir a tolerância de dias** (a única regra que o backend guarda, ADR-006/008). Regras automáticas por fornecedor vão para o roadmap, depois de 02/11 | Não reabre decisão do backend a duas semanas do congelamento |
| Tutorial | **Cartão do mascote com 3–4 passos que destaca a parte da tela** (product tour curto), com "Não mostrar de novo" e um "?" para reabrir | Ensina mostrando no lugar; o modal no centro costuma ser fechado sem ler |
| Onde fica o "não mostrar de novo" | **Na conta** (backend), com o navegador como reserva até a rota existir | Vale em qualquer computador; o escritório troca de máquina |
| Roteiro | **Checklist de primeiros passos** na Visão geral, só no primeiro mês | Padrão de onboarding (Stripe, Notion); depois a Visão geral já mostra o que falta no mês |

## 1. Cadastro sem o passo do banco

- Sai o passo `banco` de `app/(auth)/cadastro/passos.ts` ("Qual banco você vai
  conciliar?", banco/agência e conta). O cadastro fica em três passos: acesso,
  empresa, sistema. Os rótulos "Passo I de III" etc. se renumeram.
- `cadastrar` (`app/(auth)/acoes.ts`) deixa de guardar banco e conta no
  navegador; o comentário que fala deles muda.
- Nada muda no `POST /register`.
- O cadastro termina na Visão geral (o roteiro começa lá). Sem plano, o app
  leva antes para `/plano`.

## 2. Plano e teste de 14 dias

**Tela nova `/plano`** (logada, mas sem o menu do app, no mesmo visual das
etapas do cadastro; o grupo de rotas sai no plano de implementação): "Escolha seu plano". Mostra Essencial, Padrão e Avançado, com o que
cada um traz, e "14 dias grátis, sem cartão". Volume fica como "Fale com a
gente". Escolher chama a rota do backend (abaixo) e abre a Visão geral com o
tutorial dela.

**Situação da conta**, lida do `GET /me` (`contaDaSessao`):

| `situacao` | O que o front faz |
|---|---|
| `sem_plano` | Toda tela do app redireciona para `/plano` |
| `teste` | Barra do topo: "Teste grátis: faltam N dias" (N de `teste_termina_em`), com link para Assinatura |
| `teste_encerrado` | Barra do topo em tom de atenção: "Seu teste acabou"; "Nova conciliação" abre os planos em vez do envio; o resto segue igual |
| `ativo` | Nada |
| ausente | Nada: **sem o campo, o front não bloqueia ninguém** (o backend em produção ainda não manda) |

Se o backend recusar uma conciliação nova pelo plano (resposta própria, abaixo),
a tela mostra os planos com o texto do backend, mesmo que o `/me` ainda diga
`teste`.

**Planos**: a tela lê `lib/planos.ts`. Os nomes, preços e cotas de lá são os da
landing (Essencial 49,90, Padrão 79,90, Avançado 99,90, Escala, Volume) e não
batem com a ata de 14/10 (Essencial 39,90, Padrão 69,90 com pastas, Avançado
115,90 com convites, Volume). A ata diz que os preços ainda dependem do estudo
de custos. **Aberto:** qual tabela vale; a tela usa uma só fonte, então a troca
é num arquivo.

## 3. Tutorial de cada tela

**Componente `Tutorial`** (`app/(app)/tutorial/`), no shell:

- Cartão no canto inferior (no celular, embaixo, largura toda), com o mascote,
  "Tela · 1 de 3", o texto do passo, a caixa "Não mostrar de novo", "Pular" e
  "Próximo"/"Entendi" no último.
- Cada passo aponta um elemento por `data-tutorial="<id>"`. O resto da tela,
  menu incluído, escurece e desfoca como atrás das janelas (`.dialog-backdrop`),
  e o elemento fica nítido num buraco de cantos redondos, sem contorno (revisão
  de 16/10: o traço preto pesava; o contraste já aponta o alvo). Não bloqueia
  clique fora: o cartão não é modal. Só entram os passos cujo elemento está na
  tela; a página rola até ele ficar entre a barra do topo e o cartão.
- *Revisão de 16/10, na conferência visual:* numa tela vazia (conta nova, sem
  extratos) o tutorial **não abre sozinho** nem conta como visto: explicar
  filtros e listas que não existem só confundia, e o estado vazio da tela já
  guia. Ele abre na primeira visita com conteúdo; o "?" abre sempre, e numa
  tela vazia mostra todos os passos, sem destaque.
- Abre sozinho na primeira visita à tela, depois que ela carregou. Fechar com
  "Pular", Esc ou "Entendi" sem marcar a caixa: volta na próxima visita.
  Marcando: não volta mais.
- "?" na barra do topo reabre o tutorial da tela atual.
- Teclado: foco vai para o cartão ao abrir e volta para onde estava ao fechar;
  `role="dialog"` com `aria-labelledby`. Com `prefers-reduced-motion`, sem
  animação de entrada nem de movimento do destaque.
- Cor e forma seguem o guia v3: cartão `.card`, botões `.btn`, e o véu igual
  ao fundo das janelas.

**Textos** num arquivo só (`app/(app)/tutorial/roteiros.ts`), por rota, com o
mascote de cada um (os de `public/mascotes/`): Visão geral, Conciliações,
comparação, detalhe da divergência, Extratos, Histórico, Fechamentos,
Configurações. Primeiro rascunho dos textos sai do que as telas já dizem; o
texto final passa pela revisão de vocês.

**Onde fica marcado**: `preferencias.tutoriais_dispensados` do `GET /me`; a
marcação vai pela rota de preferências. Sem a rota (404 ou campo ausente), o
front guarda em `localStorage` (com try/catch) e envia quando a rota existir.

## 4. Roteiro de primeiros passos na Visão geral

Faixa no topo da Visão geral, com barra de progresso e seis passos. Cada passo
se marca sozinho e, clicado, leva à tela:

| Passo | Marcado quando | Leva a |
|---|---|---|
| Escolher o plano | `situacao` ≠ `sem_plano`. *Revisão de 16/10:* sem o campo no `/me`, o passo não aparece (o roteiro fica com cinco), em vez de dizer que um teste começou | — |
| Definir a tolerância de dias | `atualizado_em` de `/empresa/configuracoes` preenchido (vem `null` antes da primeira mudança) | Configurações › Conciliação |
| Enviar o extrato do banco | Existe extrato de banco (`GET /extratos`) | Nova conciliação |
| Enviar o extrato do sistema e conciliar | Existe execução (`/execucoes`) | Nova conciliação |
| Resolver as divergências | Alguma conciliação sem nada que `pedeDecisao` | A conciliação com mais pendências |
| Fechar o mês | Existe fechamento `fechado` | Fechamentos |

- Some quando os seis estão feitos, ou com "Já sei usar"
  (`preferencias.roteiro_dispensado`, mesma reserva no navegador).
- Só no primeiro mês: depois do primeiro mês fechado ele não volta, mesmo que a
  pessoa tenha dispensado sem terminar.
- Leitura nova: `carregarRoteiro` (configurações, extratos, execuções e fechamentos).

## 5. Regras

- O passo "Definir a tolerância de dias" é o "cadastrar suas regras" do MVP.
- O link "Criar regra para este fornecedor" no detalhe da divergência
  (`[linha]/detalhe.tsx`) vai para a tela de demonstração `/regras`: sai.
  `/regras` continua fora do menu.
- Regras automáticas por fornecedor ficam registradas no roadmap (ledgr-docs)
  para depois de 02/11.

## Pedido ao backend

Texto para mandar ao backend (o front não abre nem muda issue de lá):

> 1. **Plano e teste da empresa.** Guardar `plano` (`essencial` | `padrao` | `avancado`) e
>    `teste_termina_em` (data, criação + 14 dias). Rota para escolher o plano uma vez, por
>    exemplo `POST /empresa/plano {plano}`, que começa o teste. O `GET /me` passa a mandar
>    `plano`, `teste_termina_em` e `situacao` (`sem_plano` | `teste` | `teste_encerrado` | `ativo`).
> 2. **Bloqueio.** Recusar conciliação nova com `situacao` `sem_plano` ou `teste_encerrado`,
>    com um status próprio (sugestão: 402) e `detail` em texto. Ler e decidir no que já existe
>    continua liberado. A cota por plano fica para quando os números saírem.
> 3. **Preferências do usuário.** `GET /me` com `preferencias: { tutoriais_dispensados: string[],
>    roteiro_dispensado: boolean }`, e uma rota para salvar (sugestão: `PATCH /me/preferencias`).

A tolerância revisada não precisa de nada novo: `atualizado_em` de
`/empresa/configuracoes` já vem `null` antes da primeira mudança.

## Ordem de entrega

1. Cadastro sem o banco (parte 1) e o link de regras (parte 5): um PR pequeno.
2. Tutorial (parte 3) com a reserva no navegador.
3. Roteiro (parte 4), também com a reserva.
4. Plano e teste (parte 2): a tela `/plano` e a barra do topo ficam prontas atrás
   do "se o backend mandar"; ligam sozinhas quando o `/me` trouxer `situacao`.

## Testes

- `passos.test` / página do cadastro: três passos, sem banco e conta.
- `Tutorial`: abre na primeira visita, não volta marcado, volta sem marcar, "?"
  reabre, Esc fecha e devolve o foco, passo sem alvo aparece sem destaque,
  reserva no navegador quando a rota falta.
- Roteiro: cada passo marcado pelo dado certo, some completo ou dispensado, não
  volta depois do primeiro mês fechado.
- Situação da conta: cada `situacao` na barra e no redirecionamento; campo
  ausente não bloqueia; recusa 402 mostra os planos.
- `npm run test && npm run lint && npm run build` antes de cada PR.

## Fora deste trabalho

Cobrança e gateway, cupom de indicação, cota por plano, pastas, convites e
regras automáticas.
