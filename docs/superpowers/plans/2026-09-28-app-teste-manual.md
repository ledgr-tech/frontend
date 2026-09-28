# App: atalho da busca e linhas das configurações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver os dois apontamentos do teste manual de 28/09 no app logado: o atalho da busca no cabeçalho aparece como ⌘K para quem usa Windows, e na janela de configurações o seletor de tema pula para baixo quando a descrição muda.

**Architecture:** A detecção de Mac que hoje vive dentro de `configuracoes.tsx` vai para `lib/plataforma.ts`, como um hook (`useTeclaDeAtalho`) que o cabeçalho e as configurações usam. O salto do seletor é CSS: a coluna de texto da linha passa a ter uma base fixa no `flex`, e o controle só desce quando de fato não cabe.

**Tech Stack:** Next.js 16 (App Router), React 19 (`useSyncExternalStore`), TypeScript, Vitest + Testing Library (jsdom), CSS em `app/globals.css`.

**Spec:** [docs/superpowers/specs/2026-09-28-teste-manual-28-09-design.md](../specs/2026-09-28-teste-manual-28-09-design.md) (decisão 5 e item 10)

**Branch:** `feature/app-teste-manual`, a partir do `develop`, num worktree em `.worktrees/app-teste-manual`. PR para o `develop`.

## Global Constraints

- O atalho segue a plataforma: "⌘K" no Mac, iPhone e iPad; "Ctrl K" no resto. No servidor sai "Ctrl K".
- Nada de erro de hidratação: o valor do servidor e o primeiro do cliente são iguais ("Ctrl"), e o Mac troca depois.
- Os atalhos em si não mudam: Ctrl+K e ⌘+K continuam focando a busca nas duas plataformas.
- Antes de cada commit: `npm run test && npm run lint && npm run build` (CLAUDE.md).
- Os testes seguem o estilo do arquivo: `describe`/`it` em inglês, textos da tela em português.

## Review Focus

1. **Mac depois da hidratação**: o HTML do servidor diz "Ctrl K" e, num Mac, a tela troca para "⌘K" sem aviso de hidratação no console. O jsdom não hidrata HTML do servidor, então é conferido à mão no passo de verificação da tarefa 1.
2. **O atalho com a outra tecla**: quem está no Windows e aperta ⌘ (teclado de Mac num PC) ou o contrário continua chegando na busca. Teste na tarefa 1.
3. **Linha com formulário aberto** (trocar senha; a troca de e-mail e a exclusão de conta saíram no PR #72): o formulário continua descendo para a largura toda. Conferido à mão na tarefa 2.
4. **Janela estreita** (entre 720 e 900 px de largura): o controle pode descer quando não cabe ao lado, e isso é o esperado; abaixo de 720 px as linhas já empilham. Conferido à mão na tarefa 2.
5. **Tema escuro e claro com a mesma largura**: as três opções do tema ficam no mesmo lugar nos dois temas. Conferido à mão na tarefa 2.

---

### Task 1: O atalho da busca segue a plataforma

**Files:**
- Create: `lib/plataforma.ts`
- Create: `lib/plataforma.test.ts`
- Modify: `app/(app)/barra-superior.tsx` (import, um hook novo e o `<span className="app-busca-atalho">` perto da linha 159)
- Modify: `app/(app)/configuracoes.tsx` (troca o estado `mac` pelo hook: a declaração do estado, o `setMac` no efeito que abre a janela e o `const ctrl`)
- Test: `app/(app)/barra-superior.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export function ehMac(): boolean` (Mac, iPhone ou iPad, por `navigator.platform`)
  - `export function useTeclaDeAtalho(): "⌘" | "Ctrl"` ("Ctrl" no servidor e na hidratação)

- [ ] **Step 1: Escrever o teste do hook**

Crie `lib/plataforma.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTeclaDeAtalho } from "./plataforma";

function fingirPlataforma(valor: string) {
  Object.defineProperty(window.navigator, "platform", { value: valor, configurable: true });
}

describe("useTeclaDeAtalho", () => {
  afterEach(() => {
    // apaga a propriedade própria: volta a valer a do protótipo, a do jsdom
    delete (window.navigator as unknown as Record<string, unknown>).platform;
  });

  it("is Ctrl on Windows", () => {
    fingirPlataforma("Win32");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("Ctrl");
  });

  it("is Ctrl on Linux", () => {
    fingirPlataforma("Linux x86_64");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("Ctrl");
  });

  it("is ⌘ on a Mac", () => {
    fingirPlataforma("MacIntel");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("⌘");
  });

  it("is ⌘ on an iPad", () => {
    fingirPlataforma("iPad");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("⌘");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/plataforma.test.ts`
Expected: FAIL com `Failed to resolve import "./plataforma"`.

- [ ] **Step 3: Criar `lib/plataforma.ts`**

```ts
import { useSyncExternalStore } from "react";

/** Mac, iPhone e iPad usam ⌘ nos atalhos; o resto, Ctrl. */
export function ehMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

// a plataforma não muda com a página aberta: não há o que assinar
function semAssinatura() {
  return () => {};
}

/**
 * A tecla dos atalhos neste computador. No servidor e na hidratação é "Ctrl", a
 * do Windows, que é o caso da maioria; num Mac troca para "⌘" logo depois, sem
 * erro de hidratação.
 */
export function useTeclaDeAtalho(): "⌘" | "Ctrl" {
  return useSyncExternalStore(
    semAssinatura,
    () => (ehMac() ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/plataforma.test.ts`
Expected: PASS nos quatro.

- [ ] **Step 5: Escrever os testes do cabeçalho**

Em `app/(app)/barra-superior.test.tsx`:

1. No import do vitest, acrescente `afterEach`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

2. Dentro do `describe("BarraSuperior")`, logo depois do `beforeEach`, acrescente:

```tsx
  afterEach(() => {
    delete (window.navigator as unknown as Record<string, unknown>).platform;
  });

  function fingirPlataforma(valor: string) {
    Object.defineProperty(window.navigator, "platform", { value: valor, configurable: true });
  }
```

3. Logo depois do teste `"focuses the search box on the announced shortcut"`, acrescente:

```tsx
  it("announces the search shortcut with Ctrl on Windows", async () => {
    fingirPlataforma("Win32");
    const { container } = await montar();
    expect(container.querySelector(".app-busca-atalho")).toHaveTextContent("Ctrl K");
  });

  it("announces the search shortcut with ⌘ on a Mac", async () => {
    fingirPlataforma("MacIntel");
    const { container } = await montar();
    expect(container.querySelector(".app-busca-atalho")).toHaveTextContent("⌘K");
  });

  it("also focuses the search box with ⌘K, whatever the label says", async () => {
    fingirPlataforma("Win32");
    const user = userEvent.setup();
    await montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    await user.keyboard("{Meta>}k{/Meta}");
    expect(campo).toHaveFocus();
  });
```

O terceiro já passa hoje (o `keydown` aceita `metaKey` ou `ctrlKey`); ele fica para segurar esse comportamento.

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run "app/(app)/barra-superior.test.tsx"`
Expected: FAIL só em `"announces the search shortcut with Ctrl on Windows"`, com `Expected element to have text content: Ctrl K` e `Received: ⌘K`.

- [ ] **Step 7: Usar o hook no cabeçalho**

Em `app/(app)/barra-superior.tsx`:

1. Nos imports, logo depois de `import { caminhoDaConciliacao } from "@/lib/caminhos";`:

```tsx
import { useTeclaDeAtalho } from "@/lib/plataforma";
```

2. Junto dos outros hooks, logo depois de `const [lidos, setLidos] = useState<string[]>([]);`:

```tsx
  const tecla = useTeclaDeAtalho();
```

3. O `<span>` do atalho (perto da linha 159) fica:

```tsx
          <span aria-hidden="true" className="app-busca-atalho">
            {tecla === "⌘" ? "⌘K" : "Ctrl K"}
          </span>
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run "app/(app)/barra-superior.test.tsx" lib/plataforma.test.ts`
Expected: PASS.

- [ ] **Step 9: As configurações passam a usar o mesmo hook**

Em `app/(app)/configuracoes.tsx`:

1. Nos imports, logo depois de `import { aplicarTema, escolhaDeTema, seguirSistema, temaDoSistema, type EscolhaDeTema, type Tema } from "./tema";`:

```tsx
import { useTeclaDeAtalho } from "@/lib/plataforma";
```

2. Troque a declaração `const [mac, setMac] = useState(false);` por:

```tsx
  const ctrl = useTeclaDeAtalho();
```

3. Apague a linha `setMac(/Mac|iPhone|iPad/.test(navigator.platform));`, de dentro do `useEffect` que abre a janela.
4. Apague a linha `const ctrl = mac ? "⌘" : "Ctrl";`. O `ctrl` agora vem do passo 2, e os usos (a descrição do "Menu lateral" e as teclas em Atalhos de teclado) continuam iguais.

Run: `npx vitest run "app/(app)"`
Expected: PASS em tudo de `app/(app)`, inclusive `configuracoes.test.tsx` e `menu-lateral.test.tsx`.

- [ ] **Step 10: Conferir na tela**

Run: `npm run dev`, entre com a conta de teste e abra `http://localhost:3000/visao-geral`.
Expected no Windows: a caixa de busca mostra "Ctrl K"; Ctrl+K põe o foco nela; em Configurações (Ctrl+,), Atalhos de teclado, as teclas dizem "Ctrl".
Para ver o Mac: no DevTools, em Network conditions, desligue "Use browser default" do User agent, escolha "Chrome — Mac" e recarregue. Expected: a busca mostra "⌘K" e o console não tem aviso de hidratação ("Hydration failed" ou "didn't match").

- [ ] **Step 11: Commit**

```bash
npm run test && npm run lint && npm run build
git add lib/plataforma.ts lib/plataforma.test.ts "app/(app)/barra-superior.tsx" "app/(app)/barra-superior.test.tsx" "app/(app)/configuracoes.tsx"
git commit -m "fix: atalho da busca mostra Ctrl K no Windows e ⌘K no Mac"
```

---

### Task 2: O controle da linha de configuração não pula para baixo

**Por que pula:** `.cfg-linha` é `flex` com `flex-wrap: wrap`, e a coluna de texto (`.cfg-linha-texto`) entra com a largura do próprio conteúdo, até `58ch`. Com "Modo claro, como no papel." o texto é curto e o seletor cabe ao lado. Com "Modo escuro em todas as telas. Poupa a vista nos fechamentos de fim de noite." o texto ocupa quase `58ch`, texto + seletor + espaço passam da largura da janela, e o seletor quebra para a linha de baixo. A "Densidade das tabelas" já quebra sempre, pelo mesmo motivo.

**Files:**
- Modify: `app/globals.css:1988` (`.cfg-linha-texto`)

**Interfaces:**
- Consumes: nada.
- Produces: nada que outra tarefa use.

O jsdom não calcula layout, então esta tarefa não tem teste automático; a prova é a medição no navegador do passo 3.

- [ ] **Step 1: Medir antes, para ver o problema**

Run: `npm run dev`, entre com a conta de teste, abra as configurações (Ctrl+,) em Aparência, com a janela do navegador em 1280 px de largura. Escolha "Escuro" e rode no console:

```js
[...document.querySelectorAll(".cfg-linha")].map((linha) => {
  const texto = linha.querySelector(".cfg-linha-texto").getBoundingClientRect();
  const controle = linha.querySelector(".cfg-linha-controle")?.getBoundingClientRect();
  return [linha.querySelector(".cfg-linha-titulo").textContent, controle ? controle.left > texto.right : null];
});
```

Expected: `["Tema", false]` e `["Densidade das tabelas", false]` (controle embaixo do texto); `["Menu lateral", true]`.

- [ ] **Step 2: Dar base fixa à coluna de texto**

Em `app/globals.css`, a linha 1988 fica:

```css
/* base de 16rem: é com ela que o flex decide se o controle cabe ao lado, e não com o
   tamanho da descrição, que muda com a opção escolhida (o tema, por exemplo); cabendo,
   o texto cresce até 58ch */
.cfg-linha-texto { display: flex; flex-direction: column; gap: 4px; flex: 1 1 16rem; min-width: 0; max-width: 58ch; }
```

- [ ] **Step 3: Medir depois, nos dois temas e em três larguras**

Recarregue, abra Aparência de novo e rode o mesmo trecho do passo 1 com "Claro" e com "Escuro".
Expected em 1280 px: `true` nas três linhas, nos dois temas; o seletor do tema não muda de lugar ao trocar a opção.
Expected em 800 px de largura: o seletor pode descer só se não couber ao lado (nunca por causa da troca de tema); com "Claro" e "Escuro" o resultado é o mesmo.
Expected em 375 px (celular): as linhas continuam empilhadas pela regra de `@media (max-width: 720px)`, texto em cima e controle embaixo.
Em Conta, abra "Trocar senha": o formulário continua descendo para a largura toda.

- [ ] **Step 4: Rodar a suíte e commitar**

```bash
npm run test && npm run lint && npm run build
git add app/globals.css
git commit -m "fix: seletor das configurações não pula para baixo ao trocar o tema"
```
