# Textos sem travessão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o travessão (—) do texto corrido do app e da landing, começando pela "Regra de ouro" que o teste manual de 28/09 apontou como "cara de IA".

**Architecture:** Só texto. Cada frase é reescrita à mão com vírgula, dois-pontos, ponto ou parênteses, sem mudar o que ela diz. Ficam o "—" que marca célula vazia em tabela e o "–" de intervalo, que são tipografia, e os travessões de comentários de código, que ninguém vê.

**Tech Stack:** Next.js 16, TypeScript, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-28-teste-manual-28-09-design.md](../specs/2026-09-28-teste-manual-28-09-design.md) (item 8 e decisão 6)

**Branch:** `feature/textos-sem-travessao`, a partir do `develop`, num worktree em `.worktrees/textos-sem-travessao`. PR para o `develop`.

## Global Constraints

- Frase por frase, sem trocar o sentido nem acrescentar promessa. Em especial, o PDF não entra em nenhum texto (decisão 7 da spec).
- Não mexer em: `"—"` sozinho como valor de célula vazia (`assinatura/page.tsx:125`, `importacao-interrompida.tsx:182` e `:226`, `cartao-lancamento.tsx:34`, `conciliacoes/[id]/page.tsx` nas linhas 360-386 e 531-540, `[linha]/page.tsx:53` e `:326`, `dashboard/page.tsx:336`, `visao-geral/page.tsx:369`, `comparacao.tsx:63` e `:67`); "–" de intervalo (`conciliacoes/[id]/page.tsx:411`, `dashboard/resumo.ts:178`, `historico/page.tsx:159`); comentários; e as descrições de lançamento de `lib/mock-data.ts`, que imitam o texto que vem do banco.
- Antes de cada commit: `npm run test && npm run lint && npm run build` (CLAUDE.md).

## Review Focus

1. **Célula vazia apagada por engano**: uma tabela que mostrava "—" passa a mostrar nada. Os testes de `assinatura/page.test.tsx:88` e `conciliacoes/[id]/page.test.tsx:207` seguram dois casos; o grep do passo final de cada tarefa segura o resto.
2. **Frase montada com valores do assistente**: com uma linha só, a frase nova ainda lê bem ("Os R$ 45 em aberto saem de 1 linha. Tarifa bancária: 1 (R$ 45)."). Teste na tarefa 1.
3. **Quebra de linha em JSX**: um trecho que começava a linha com "— sem planilha" vira "sem planilha" e o espaço entre as palavras continua lá. Teste na tarefa 2.
4. **Plano "Volume" nas duas telas**: o `limite` de `lib/planos.ts` aparece na landing e na assinatura; a frase nova cabe no cartão das duas. Conferido à mão na tarefa 1.
5. **Prévia de compartilhamento**: o `alt` da imagem de Open Graph continua descrevendo a imagem. Conferido no passo final da tarefa 2.

---

### Task 1: Travessões do app

**Files:**
- Modify: `app/(app)/conciliacoes/nova/page.tsx:316-320` (Regra de ouro)
- Modify: `app/(app)/conciliacoes/[id]/page.tsx:404`
- Modify: `app/(app)/visao-geral/page.tsx:405`
- Modify: `app/(app)/assistente/respostas.ts:138`, `:181`, `:192`
- Modify: `lib/planos.ts:25`
- Test: `app/(app)/conciliacoes/nova/page.test.tsx`
- Test: `app/(app)/assistente/respostas.test.ts:106`, `:113`

**Interfaces:**
- Consumes: nada.
- Produces: nada que outra tarefa use.

- [ ] **Step 1: Pedir a Regra de ouro sem travessão**

Em `app/(app)/conciliacoes/nova/page.test.tsx`, dentro do `describe` principal, acrescente:

```tsx
  it("states the golden rule in plain sentences, without a dash", () => {
    render(<NovaConciliacaoPage />);
    const regra = screen.getByText(/O extrato do banco é sempre a fonte da verdade\./);

    expect(regra).toHaveTextContent(
      "O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como “o sistema diverge do banco”. Se o valor no seu sistema estiver diferente, é ele que precisa de ajuste.",
    );
    expect(regra.textContent).not.toContain("—");
  });
```

- [ ] **Step 2: Atualizar as respostas do assistente nos testes**

Em `app/(app)/assistente/respostas.test.ts`, a linha 106 fica:

```ts
      "Setembro: 6 lançamentos. 3 casaram sozinhos (50,0%). Ficaram R$ 4.261 em aberto, em 3 linhas.",
```

E a linha 113 fica:

```ts
      "Os R$ 4.261 em aberto saem de 3 linhas. Valor diverge na mesma data: 1 (R$ 36); Sem correspondência no sistema: 1 (R$ 4.180) e Tarifa bancária: 1 (R$ 45).",
```

Logo depois do teste `"diz de onde sai o dinheiro em aberto, grupo a grupo"`, acrescente o caso de uma linha só:

```ts
  it("diz de onde sai o dinheiro em aberto quando sobrou uma linha só", () => {
    const linhas = [linha("l1", "match_exato", 100, 100), linha("l6", "tarifa_bancaria", -45, null)];
    expect(texto("Por que sobrou R$ 45?", contexto(linhas))).toBe(
      "Os R$ 45 em aberto saem de 1 linha. Tarifa bancária: 1 (R$ 45).",
    );
  });
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run "app/(app)/conciliacoes/nova/page.test.tsx" "app/(app)/assistente/respostas.test.ts"`
Expected: FAIL no teste novo da Regra de ouro e nos três do assistente (o texto recebido ainda tem "—").

- [ ] **Step 4: Reescrever as frases**

`app/(app)/conciliacoes/nova/page.tsx`, o parágrafo da Regra de ouro fica:

```tsx
          <p style={{ margin: 0, fontSize: 14 }}>
            O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como
            &ldquo;o sistema diverge do banco&rdquo;. Se o valor no seu sistema estiver diferente,
            é ele que precisa de ajuste.
          </p>
```

`app/(app)/conciliacoes/[id]/page.tsx:404`:

```tsx
                : "Nada em revisão nesta competência: todos os lançamentos bateram."}
```

`app/(app)/visao-geral/page.tsx:405`:

```tsx
    texto: "O CSV exportado do seu ERP funciona: Cigam, Bling, Tiny ou outro.",
```

`app/(app)/assistente/respostas.ts:138`:

```ts
      texto: `${plural(tarifas.quantidade, "tarifa bancária", "tarifas bancárias")} em ${mes}, somando ${formatarMoedaCurta(tarifas.valor)}. Estão no extrato do banco e não no sistema de gestão. É a sobra que o Ledgr já sabe explicar, por isso tem categoria própria.`,
```

`app/(app)/assistente/respostas.ts:181`:

```ts
    return { texto: `${inicio}. ${lista(partes)}.`, link: { href: contexto.caminho, rotulo: "Abrir a lista" } };
```

`app/(app)/assistente/respostas.ts:192`:

```ts
      texto: `${Mes}: ${plural(contexto.processados, "lançamento", "lançamentos")}. ${formatarInteiro(contexto.batidos)} casaram sozinhos (${formatarPercentual(contexto.taxa)}).${aberto}${naoLidas(contexto)}`,
```

`lib/planos.ts:25`:

```ts
    limite: "acima de 5.000, para indústria e multi-banco",
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run "app/(app)" lib`
Expected: PASS em tudo, inclusive os testes das tabelas que conferem "—" em célula vazia.

- [ ] **Step 6: Conferir que só sobrou o que deve ficar**

Run:

```bash
grep -rn "—" "app/(app)" lib --include=*.tsx --include=*.ts | grep -v "\.test\." | grep -v -E "^\S+:[0-9]+:\s*(//|\*|/\*|\{/\*)"
```

Expected: só as linhas de célula vazia listadas em Global Constraints, a continuação de comentário em `dashboard/page.tsx:183` e `conciliacoes/[id]/page.tsx:267`, e as três descrições de `lib/mock-data.ts`.

- [ ] **Step 7: Conferir na tela**

Run: `npm run dev`, entre com a conta de teste.
Expected: em `/conciliacoes/nova`, a Regra de ouro em três frases; em `/assinatura`, o cartão "Volume" com "acima de 5.000, para indústria e multi-banco" cabendo sem estourar a altura dos outros cartões; em `/` (landing), o mesmo texto na tabela de preços.

- [ ] **Step 8: Commit**

```bash
npm run test && npm run lint && npm run build
git add "app/(app)/conciliacoes/nova/page.tsx" "app/(app)/conciliacoes/nova/page.test.tsx" "app/(app)/conciliacoes/[id]/page.tsx" "app/(app)/visao-geral/page.tsx" "app/(app)/assistente/respostas.ts" "app/(app)/assistente/respostas.test.ts" lib/planos.ts
git commit -m "fix: texto do app sem travessão, a começar pela Regra de ouro"
```

---

### Task 2: Travessões da landing

**Files:**
- Modify: `app/(marketing)/page.tsx:60`, `:67`, `:123`, `:148`, `:273-275`, `:444-445`, `:505-507`, `:738-740`
- Modify: `app/opengraph-image.tsx:14`
- Test: `app/(marketing)/page.test.tsx`

**Interfaces:**
- Consumes: `lib/planos.ts` já sem travessão (tarefa 1). Se a tarefa 1 não entrou, esta funciona igual; só o preço do "Volume" continua com o travessão.
- Produces: nada que outra tarefa use.

- [ ] **Step 1: Pedir o texto novo da landing**

Em `app/(marketing)/page.test.tsx`, dentro do `describe("LandingPage")`, acrescente:

```tsx
  it("writes its copy without dashes between clauses", () => {
    render(<LandingPage />);

    expect(
      screen.getByText(/Em minutos você recebe o relatório do que bate e do que não bate, lançamento por lançamento, sem planilha no meio\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/entrega um relatório categorizado, sem planilha e sem conferência manual linha por linha\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não. O Ledgr lê o arquivo que o internet banking já exporta, em OFX ou CSV. Nenhuma credencial bancária é pedida."),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "app/(marketing)/page.test.tsx"`
Expected: FAIL com `Unable to find an element with the text: /Em minutos você recebe .../`.

- [ ] **Step 3: Reescrever as frases**

`app/(marketing)/page.tsx:60`:

```tsx
    explicacao: "Diferença de R$ 0,05: taxa de arredondamento aplicada pela operadora do cartão.",
```

`app/(marketing)/page.tsx:67`:

```tsx
  "O banco debitou em 11/08; o sistema lançou a mesma despesa em 12/08. Mesmo valor, datas diferentes. O Ledgr não junta as duas automaticamente.";
```

`app/(marketing)/page.tsx:123`:

```tsx
      "Não. O Ledgr lê o arquivo que o internet banking já exporta, em OFX ou CSV. Nenhuma credencial bancária é pedida.",
```

`app/(marketing)/page.tsx:148`:

```tsx
      "Não. Você paga só pelo volume de lançamentos conferidos no mês, sem contrato de fidelidade, taxa de setup ou cobrança por usuário adicional.",
```

`app/(marketing)/page.tsx:273-275`:

```tsx
              Suba o extrato do banco e o extrato do seu sistema de gestão. Em minutos você recebe o
              relatório do que bate e do que não bate, lançamento por lançamento, sem planilha no
              meio.
```

`app/(marketing)/page.tsx:444-445`:

```tsx
                O Ledgr cruza extrato do banco com o razão do ERP e entrega um relatório categorizado,
                sem planilha e sem conferência manual linha por linha.
```

`app/(marketing)/page.tsx:505-507`:

```tsx
                Conferir o extrato do banco contra o extrato do sistema de gestão linha a linha é lento,
                cansa e deixa passar erro. Quanto maior o volume de lançamentos, pior fica. E o mês
                fecha sempre no aperto.
```

`app/(marketing)/page.tsx:738-740`:

```tsx
              O Ledgr aceita OFX e CSV de qualquer banco. Suba o extrato do banco, suba o razão do
              seu ERP ou sistema de gestão no mesmo período e receba o relatório categorizado. Sem
              integração pra configurar, sem instalar nada.
```

`app/opengraph-image.tsx:14`:

```tsx
export const alt = "Ledgr: pare de conciliar extrato à mão.";
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run "app/(marketing)"`
Expected: PASS, inclusive o teste que já pedia o título "Pare de conciliar extrato à mão." (o título da página não muda; só o `alt` da imagem).

- [ ] **Step 5: Conferir que só sobrou o que deve ficar**

Run:

```bash
grep -rn "—" "app/(marketing)" app/opengraph-image.tsx app/layout.tsx --include=*.tsx --include=*.ts | grep -v "\.test\." | grep -v -E "^\S+:[0-9]+:\s*(//|\*|/\*|\{/\*)"
```

Expected: só `comparacao.tsx:63` e `:67` (células vazias) e a continuação de comentário em `app/layout.tsx:74`.

- [ ] **Step 6: Conferir na tela**

Run: `npm run dev` e abra `http://localhost:3000/`.
Expected: nenhuma frase da landing com travessão; o texto do hero e o do "Em números" quebram em linhas sem sobra estranha no desktop (1280 px) e no celular (375 px). Abra `http://localhost:3000/opengraph-image` para ver que a imagem continua gerando.

- [ ] **Step 7: Commit**

```bash
npm run test && npm run lint && npm run build
git add "app/(marketing)/page.tsx" "app/(marketing)/page.test.tsx" app/opengraph-image.tsx
git commit -m "fix: landing sem travessão entre as orações"
```
