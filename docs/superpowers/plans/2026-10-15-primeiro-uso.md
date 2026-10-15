# Primeiro uso Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guiar o primeiro uso do Ledgr: cadastro sem o passo do banco, tutorial do mascote em cada tela, roteiro de primeiros passos na Visão geral e o plano em teste de 14 dias.

**Architecture:** Quatro entregas, um PR cada, na ordem: (A) cadastro e link de regras, (B) tutorial, (C) roteiro, (D) plano e teste. As preferências ("não mostrar de novo", "Já sei usar") ficam num contexto do cliente (`app/(app)/conta.tsx`) que junta o que o `GET /me` mandar com o `localStorage`; a escrita vai para o navegador e, em paralelo, para o backend, que pode ainda não ter a rota. O plano e o teste vêm do `GET /me`; sem os campos, nada bloqueia.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Vitest + Testing Library (jsdom), CSS em `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-10-15-primeiro-uso-design.md`

## Global Constraints

- Antes de cada commit: `npm run test && npm run lint && npm run build` (o `build` pega erro de grupo de rota que os testes não pegam).
- Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever rota nova (Next 16 mudou convenções).
- Estilo: tokens e classes de `app/globals.css` (`.card`, `.btn`, `.selo`, `--color-*`, `--shadow-lg`); destaque do tutorial em traço neutro (`--color-text`), nunca dourado.
- Texto de tela em português, sem travessão entre orações (PR #82), frases curtas.
- `localStorage` sempre dentro de `try/catch`; a tela funciona sem ele.
- Sem o campo no `GET /me` (`situacao`, `preferencias`), o front **não bloqueia ninguém** e usa o navegador.
- Tutorial: `role="dialog"` não modal, Esc fecha e devolve o foco; com `prefers-reduced-motion`, sem animação nem rolagem suave.
- Trabalhar no branch `feat/primeiro-uso` (worktree em `.worktrees/`), PR para `develop`. Nunca commitar na `main`.

## Review Focus

- **Navegador sem `localStorage`** (aba privada, bloqueado): o tutorial abre, fecha e não quebra; só não lembra. Teste em Task 3.
- **Tela vazia sem o alvo do passo** (conta nova em Extratos, sem cartão nenhum): o passo aparece sem destaque, sem erro. Teste em Task 6.
- **Navegar com o tutorial aberto**: o destaque some da tela anterior (o atributo `data-tutorial-ativo` não fica preso). Teste em Task 6.
- **`/me` com `situacao` desconhecida ou `teste_termina_em` inválido**: trata como ausente, ninguém é bloqueado. Teste em Task 10.
- **Conta sem plano abrindo `/plano` quando o backend ainda não tem a rota de escolher**: mostra "Ainda não disponível" e não fica girando. Teste em Task 11.

---

## Entrega A: cadastro e regras (PR 1)

### Task 1: Cadastro sem o passo do banco

**Files:**
- Modify: `app/(auth)/cadastro/passos.ts` (tipo `PassoCadastro.id`, o passo `banco`, eyebrow do `sistema`)
- Modify: `app/(auth)/cadastro/page.tsx:181` (destino depois do cadastro)
- Modify: `app/(auth)/acoes.ts:107-110` (comentário de `cadastrar`)
- Test: `app/(auth)/cadastro/page.test.tsx`

**Interfaces:**
- Produces: `PASSOS` com três itens, ids `"acesso" | "empresa" | "sistema"`. O cadastro termina em `/visao-geral` (onde o roteiro da Entrega C começa).

- [ ] **Step 1: Ajustar os testes para três passos**

Em `page.test.tsx`: apagar a constante `BANCO` e toda chamada `await preencher(user, BANCO); await continuar(user);`. Trocar as asserções que esperavam o passo do banco:

```ts
  it("walks through the company and management-system steps", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await preencher(user, ACESSO);
    await continuar(user);
    expect(titulo()).toHaveTextContent("Vamos cadastrar a empresa.");
    expect(screen.getByText("Passo I de II")).toBeInTheDocument();

    await preencher(user, EMPRESA);
    await continuar(user);
    expect(titulo()).toHaveTextContent("E o sistema de gestão?");
    expect(screen.getByText("Passo II de II")).toBeInTheDocument();
    expect(screen.queryByText("Qual banco você vai conciliar?")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Conta corrente")).not.toBeInTheDocument();
  });
```

Nos testes de CNPJ que terminavam em `expect(titulo()).toHaveTextContent("Qual banco você vai conciliar?")`, trocar por `expect(titulo()).toHaveTextContent("E o sistema de gestão?")`. Apagar o teste `"does not limit the account field to a numeric keyboard…"` (o campo não existe mais). Em todo `expect(push).toHaveBeenCalledWith("/conciliacoes/nova")` trocar por `"/visao-geral"`. Trocar o comentário `// banco e sistema de gestão o backend ainda não guarda…` por `// o sistema de gestão o backend ainda não guarda: não sai do navegador`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "app/(auth)/cadastro/page.test.tsx"`
Expected: FAIL (ainda aparece "Qual banco você vai conciliar?", "Passo I de III").

- [ ] **Step 3: Tirar o passo**

Em `passos.ts`: `id: "acesso" | "empresa" | "sistema";`. Apagar o objeto inteiro de `id: "banco"` em `PASSOS`. No passo `empresa`, `eyebrow: "Passo I de II"`; no `sistema`, `eyebrow: "Passo II de II"`. No comentário do topo, "os três seguintes" vira "os dois seguintes".

Em `page.tsx`, no `concluir()`: `router.push(resultado.entrou ? "/visao-geral" : "/login");`. Procurar `banco` no arquivo (comentário da linha ~137 "não depois do banco e do sistema") e ajustar para "não depois do sistema".

Em `acoes.ts`, o comentário de `cadastrar`: "O sistema de gestão, que o formulário também pede, o backend ainda não guarda: fica no navegador."

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run "app/(auth)/cadastro"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/cadastro" "app/(auth)/acoes.ts"
git commit -m "feat(cadastro): tira o passo do banco, que não ia para lugar nenhum"
```

### Task 2: Sair o link "Criar regra para este fornecedor"

**Files:**
- Modify: `app/(app)/conciliacoes/[id]/[linha]/detalhe.tsx:316-321`
- Test: o teste do detalhe que procura o link (`grep -rn "Criar regra" "app/(app)/conciliacoes"`)

- [ ] **Step 1: Teste**

No teste do detalhe que cobre o bloco "O mesmo fornecedor divergiu", trocar a asserção do link por:

```ts
    expect(screen.queryByRole("link", { name: "Criar regra para este fornecedor" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(app)/conciliacoes/[id]/[linha]"` → FAIL.

- [ ] **Step 3: Tirar o bloco**

Apagar em `detalhe.tsx` o `<div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>…<Link href="/regras" …>Criar regra para este fornecedor</Link></div>` e o comentário acima dele. Se `Link` ficar sem uso, tirar o import.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.

- [ ] **Step 5: Verificar e abrir o PR A**

```bash
npm run test && npm run lint && npm run build
git add "app/(app)/conciliacoes/[id]/[linha]"
git commit -m "feat(detalhe): tira o atalho para a tela de regras de demonstração"
git push -u origin feat/primeiro-uso
gh pr create --base develop --title "Primeiro uso, parte A: cadastro sem o banco e sem o atalho de regras" --body "Parte 1 de docs/superpowers/specs/2026-10-15-primeiro-uso-design.md."
```

---

## Entrega B: tutorial (PR 2)

Novo branch a partir do `develop` com a Entrega A juntada: `git checkout -b feat/tutorial origin/develop`.

### Task 3: Preferências no navegador

**Files:**
- Create: `lib/preferencias.ts`
- Test: `lib/preferencias.test.ts`

**Interfaces:**
- Produces:
  - `type TelaDoTutorial = "visao-geral" | "conciliacoes" | "nova-conciliacao" | "comparacao" | "divergencia" | "extratos" | "historico" | "fechamentos" | "configuracoes"`
  - `type Preferencias = { tutoriaisDispensados: TelaDoTutorial[]; roteiroDispensado: boolean }`
  - `const PREFERENCIAS_VAZIAS: Preferencias`
  - `preferenciasLocais(): Preferencias`
  - `guardarLocal(p: Preferencias): void`
  - `juntar(a: Preferencias, b: Preferencias): Preferencias`

- [ ] **Step 1: Testes**

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { guardarLocal, juntar, preferenciasLocais, PREFERENCIAS_VAZIAS } from "./preferencias";

describe("preferências no navegador", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("começa vazia", () => {
    expect(preferenciasLocais()).toEqual(PREFERENCIAS_VAZIAS);
  });

  it("guarda e lê de volta", () => {
    guardarLocal({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
    expect(preferenciasLocais()).toEqual({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
  });

  it("ignora o que não é uma tela conhecida e o JSON quebrado", () => {
    window.localStorage.setItem("ledgr:preferencias", '{"tutoriaisDispensados":["extratos","xyz"],"roteiroDispensado":"sim"}');
    expect(preferenciasLocais()).toEqual({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false });
    window.localStorage.setItem("ledgr:preferencias", "{quebrado");
    expect(preferenciasLocais()).toEqual(PREFERENCIAS_VAZIAS);
  });

  it("sem localStorage, lê vazio e guardar não lança", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(preferenciasLocais()).toEqual(PREFERENCIAS_VAZIAS);
    expect(() => guardarLocal({ tutoriaisDispensados: ["historico"], roteiroDispensado: false })).not.toThrow();
  });

  it("junta as duas fontes sem repetir", () => {
    expect(
      juntar(
        { tutoriaisDispensados: ["extratos"], roteiroDispensado: false },
        { tutoriaisDispensados: ["extratos", "historico"], roteiroDispensado: true },
      ),
    ).toEqual({ tutoriaisDispensados: ["extratos", "historico"], roteiroDispensado: true });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/preferencias.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
/**
 * O que a pessoa dispensou no primeiro uso: os tutoriais marcados com "Não mostrar de novo" e o
 * roteiro fechado com "Já sei usar". A fonte certa é a conta (`preferencias` do `GET /me`); o
 * navegador é a reserva enquanto o backend não tem a rota, e continua valendo depois, junto.
 */

export const TELAS_DO_TUTORIAL = [
  "visao-geral",
  "conciliacoes",
  "nova-conciliacao",
  "comparacao",
  "divergencia",
  "extratos",
  "historico",
  "fechamentos",
  "configuracoes",
] as const;

export type TelaDoTutorial = (typeof TELAS_DO_TUTORIAL)[number];

export type Preferencias = { tutoriaisDispensados: TelaDoTutorial[]; roteiroDispensado: boolean };

export const PREFERENCIAS_VAZIAS: Preferencias = { tutoriaisDispensados: [], roteiroDispensado: false };

const CHAVE = "ledgr:preferencias";

export function ehTela(valor: unknown): valor is TelaDoTutorial {
  return typeof valor === "string" && (TELAS_DO_TUTORIAL as readonly string[]).includes(valor);
}

export function preferenciasLocais(): Preferencias {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) ?? "null") as Partial<Record<keyof Preferencias, unknown>> | null;
    if (!bruto || typeof bruto !== "object") return PREFERENCIAS_VAZIAS;
    const telas = Array.isArray(bruto.tutoriaisDispensados) ? bruto.tutoriaisDispensados.filter(ehTela) : [];
    return { tutoriaisDispensados: telas, roteiroDispensado: bruto.roteiroDispensado === true };
  } catch {
    // aba privada, armazenamento bloqueado ou JSON quebrado: só não lembra
    return PREFERENCIAS_VAZIAS;
  }
}

export function guardarLocal(preferencias: Preferencias): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(preferencias));
  } catch {
    // sem armazenamento: a escolha vale até recarregar
  }
}

export function juntar(a: Preferencias, b: Preferencias): Preferencias {
  return {
    tutoriaisDispensados: [...new Set([...a.tutoriaisDispensados, ...b.tutoriaisDispensados])],
    roteiroDispensado: a.roteiroDispensado || b.roteiroDispensado,
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.

- [ ] **Step 5: Commit** — `git add lib/preferencias.ts lib/preferencias.test.ts && git commit -m "feat(tutorial): preferências do primeiro uso guardadas no navegador"`

### Task 4: Preferências da conta e o contexto do app

**Files:**
- Modify: `app/(auth)/acoes.ts` (`ContaDaSessao`, `contaDaSessao`, nova `salvarPreferencias`)
- Create: `app/(app)/conta.tsx`
- Modify: `app/(app)/layout.tsx`, `app/(app)/shell.tsx`
- Test: `app/(auth)/acoes.test.ts`, `app/(app)/conta.test.tsx`

**Interfaces:**
- Consumes: `Preferencias`, `PREFERENCIAS_VAZIAS`, `preferenciasLocais`, `guardarLocal`, `juntar`, `ehTela`, `TelaDoTutorial` (Task 3).
- Produces:
  - `ContaDaSessao.preferencias: Preferencias | null` (null: o backend não mandou).
  - `salvarPreferencias(p: Preferencias): Promise<boolean>` (Server Action, `PATCH /me/preferencias`).
  - `ProvedorDaConta({ preferencias, children })` e `usePreferencias(): { carregado: boolean; tutorialDispensado(tela): boolean; dispensarTutorial(tela): void; roteiroDispensado: boolean; dispensarRoteiro(): void }`.
  - `Shell` recebe a prop nova `preferencias: Preferencias | null`.

- [ ] **Step 1: Testes da action** (em `app/(auth)/acoes.test.ts`, seguindo o mock de `chamarBackend` que o arquivo já usa)

```ts
describe("preferências da conta", () => {
  it("lê as preferências do GET /me", async () => {
    chamarBackend.mockResolvedValueOnce({
      razao_social: "Telha Certa Ltda",
      metodos_login: ["senha"],
      preferencias: { tutoriais_dispensados: ["extratos", "nao-existe"], roteiro_dispensado: true },
    });
    expect((await contaDaSessao()).preferencias).toEqual({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
  });

  it("sem o campo, preferências é null", async () => {
    chamarBackend.mockResolvedValueOnce({ razao_social: "Telha Certa Ltda", metodos_login: ["senha"] });
    expect((await contaDaSessao()).preferencias).toBeNull();
  });

  it("salva pelo PATCH /me/preferencias e diz se deu certo", async () => {
    chamarBackend.mockResolvedValueOnce({});
    await expect(salvarPreferencias({ tutoriaisDispensados: ["historico"], roteiroDispensado: false })).resolves.toBe(true);
    expect(chamarBackend).toHaveBeenLastCalledWith("/me/preferencias", {
      method: "PATCH",
      corpo: { tutoriais_dispensados: ["historico"], roteiro_dispensado: false },
    });
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Not Found", []));
    await expect(salvarPreferencias({ tutoriaisDispensados: [], roteiroDispensado: true })).resolves.toBe(false);
  });
});
```

(Conferir no topo do arquivo de teste como `ErroBackend` é construído e ajustar os argumentos do `new ErroBackend(...)` ao construtor real de `lib/backend.ts`.)

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(auth)/acoes.test.ts"` → FAIL.

- [ ] **Step 3: Implementar em `acoes.ts`**

```ts
import { ehTela, type Preferencias } from "@/lib/preferencias";

type PreferenciasAPI = { tutoriais_dispensados?: unknown; roteiro_dispensado?: unknown };

function adaptarPreferencias(bruto: PreferenciasAPI | undefined | null): Preferencias | null {
  if (!bruto || typeof bruto !== "object") return null;
  const telas = Array.isArray(bruto.tutoriais_dispensados) ? bruto.tutoriais_dispensados.filter(ehTela) : [];
  return { tutoriaisDispensados: telas, roteiroDispensado: bruto.roteiro_dispensado === true };
}
```

Em `ContaDaSessao`, acrescentar:

```ts
  /** O que a pessoa dispensou no primeiro uso; null quando o `GET /me` ainda não manda o campo. */
  preferencias: Preferencias | null;
```

`contaDaSessao` passa a tipar a resposta com `preferencias?: PreferenciasAPI` e devolver `preferencias: adaptarPreferencias(eu.preferencias)`; no `catch`, `preferencias: null`.

```ts
/**
 * Guarda as preferências do primeiro uso na conta (`PATCH /me/preferencias`). Falso quando o
 * backend ainda não tem a rota ou não respondeu: o navegador já guardou, a tela não avisa nada.
 */
export async function salvarPreferencias(preferencias: Preferencias): Promise<boolean> {
  try {
    await chamarBackend("/me/preferencias", {
      method: "PATCH",
      corpo: { tutoriais_dispensados: preferencias.tutoriaisDispensados, roteiro_dispensado: preferencias.roteiroDispensado },
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Teste do contexto** (`app/(app)/conta.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ProvedorDaConta, usePreferencias } from "./conta";

const salvarPreferencias = vi.fn(async () => true);
vi.mock("../(auth)/acoes", () => ({ salvarPreferencias: (p: unknown) => salvarPreferencias(p) }));

function Sonda() {
  const p = usePreferencias();
  return (
    <div>
      <span>{p.carregado ? "carregado" : "carregando"}</span>
      <span>{p.tutorialDispensado("extratos") ? "extratos dispensado" : "extratos ativo"}</span>
      <button onClick={() => p.dispensarTutorial("extratos")}>dispensar</button>
    </div>
  );
}

describe("ProvedorDaConta", () => {
  beforeEach(() => { window.localStorage.clear(); salvarPreferencias.mockClear(); });

  it("junta o que veio da conta com o navegador", async () => {
    window.localStorage.setItem("ledgr:preferencias", JSON.stringify({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false }));
    render(<ProvedorDaConta preferencias={null}><Sonda /></ProvedorDaConta>);
    await waitFor(() => expect(screen.getByText("carregado")).toBeInTheDocument());
    expect(screen.getByText("extratos dispensado")).toBeInTheDocument();
  });

  it("dispensar guarda no navegador e manda para a conta", async () => {
    render(<ProvedorDaConta preferencias={null}><Sonda /></ProvedorDaConta>);
    await act(async () => screen.getByText("dispensar").click());
    expect(screen.getByText("extratos dispensado")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("ledgr:preferencias")!).tutoriaisDispensados).toEqual(["extratos"]);
    expect(salvarPreferencias).toHaveBeenCalledWith({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false });
  });
});
```

- [ ] **Step 5: Implementar `app/(app)/conta.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { salvarPreferencias } from "../(auth)/acoes";
import {
  guardarLocal,
  juntar,
  PREFERENCIAS_VAZIAS,
  preferenciasLocais,
  type Preferencias,
  type TelaDoTutorial,
} from "@/lib/preferencias";

type ValorDaConta = {
  /** Falso até ler o navegador: antes disso, ninguém abre tutorial nem roteiro. */
  carregado: boolean;
  tutorialDispensado: (tela: TelaDoTutorial) => boolean;
  dispensarTutorial: (tela: TelaDoTutorial) => void;
  roteiroDispensado: boolean;
  dispensarRoteiro: () => void;
};

const Contexto = createContext<ValorDaConta | null>(null);

/** As preferências do primeiro uso: as da conta somadas às do navegador. */
export function ProvedorDaConta({ preferencias, children }: { preferencias: Preferencias | null; children: ReactNode }) {
  const [atuais, setAtuais] = useState<Preferencias>(preferencias ?? PREFERENCIAS_VAZIAS);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    // localStorage só existe no cliente; ler fora do render é o padrão do projeto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAtuais((anteriores) => juntar(anteriores, preferenciasLocais()));
    setCarregado(true);
  }, []);

  const guardar = useCallback((mudar: (p: Preferencias) => Preferencias) => {
    setAtuais((anteriores) => {
      const novas = mudar(anteriores);
      guardarLocal(novas);
      void salvarPreferencias(novas).catch(() => false);
      return novas;
    });
  }, []);

  const valor = useMemo<ValorDaConta>(
    () => ({
      carregado,
      tutorialDispensado: (tela) => atuais.tutoriaisDispensados.includes(tela),
      dispensarTutorial: (tela) =>
        guardar((p) => ({ ...p, tutoriaisDispensados: [...new Set([...p.tutoriaisDispensados, tela])] })),
      roteiroDispensado: atuais.roteiroDispensado,
      dispensarRoteiro: () => guardar((p) => ({ ...p, roteiroDispensado: true })),
    }),
    [atuais, carregado, guardar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePreferencias(): ValorDaConta {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usePreferencias fora do ProvedorDaConta");
  return valor;
}
```

Se o `setAtuais` com efeito colateral (guardar dentro do updater) causar chamada dupla no StrictMode, mover `guardarLocal` e `salvarPreferencias` para fora: calcular `novas` a partir de `atuais` no próprio `dispensar*` (dependência `atuais` no `useCallback`).

- [ ] **Step 6: Ligar no layout e no Shell**

`layout.tsx`: `<Shell email={…} empresa={conta.empresa} temSenha={conta.temSenha} preferencias={conta.preferencias}>`.

`shell.tsx`: prop nova `preferencias: Preferencias | null` e, por fora do `<LucideProvider>`:

```tsx
    <EmpresaDaSessao value={empresa}>
      <ProvedorDaConta preferencias={preferencias}>
        <LucideProvider strokeWidth={TRACO_ICONE}>…</LucideProvider>
      </ProvedorDaConta>
    </EmpresaDaSessao>
```

Atualizar `shell.test.tsx` e `layout.test.tsx` para passar/esperar `preferencias` (o mock de `contaDaSessao` nos testes do layout passa a devolver `preferencias: null`), e mockar `salvarPreferencias` onde `../(auth)/acoes` já é mockado.

- [ ] **Step 7: Rodar** — `npx vitest run "app/(auth)/acoes.test.ts" "app/(app)/conta.test.tsx" "app/(app)/shell.test.tsx" "app/(app)/layout.test.tsx"` → PASS.

- [ ] **Step 8: Commit** — `git commit -am "feat(tutorial): preferências da conta, com o navegador como reserva"` (e `git add` de `conta.tsx`/`conta.test.tsx`).

### Task 5: Os textos de cada tela

**Files:**
- Create: `app/(app)/tutorial/roteiros.ts`
- Test: `app/(app)/tutorial/roteiros.test.ts`

**Interfaces:**
- Consumes: `TelaDoTutorial`, `TELAS_DO_TUTORIAL` (Task 3).
- Produces:
  - `type PassoDoTutorial = { alvo: string; titulo: string; texto: string }`
  - `type TutorialDaTela = { nome: string; mascote: string; passos: PassoDoTutorial[] }`
  - `const TUTORIAIS: Record<TelaDoTutorial, TutorialDaTela>`
  - `telaDoCaminho(caminho: string): TelaDoTutorial | null`

- [ ] **Step 1: Testes**

```ts
import { describe, it, expect } from "vitest";
import { TELAS_DO_TUTORIAL } from "@/lib/preferencias";
import { telaDoCaminho, TUTORIAIS } from "./roteiros";

describe("tutoriais", () => {
  it("cada tela tem de 2 a 4 passos curtos, com alvo", () => {
    for (const tela of TELAS_DO_TUTORIAL) {
      const { passos } = TUTORIAIS[tela];
      expect(passos.length).toBeGreaterThanOrEqual(2);
      expect(passos.length).toBeLessThanOrEqual(4);
      for (const passo of passos) {
        expect(passo.alvo).toMatch(/^[a-z-]+$/);
        expect(passo.texto.length).toBeLessThanOrEqual(220);
        expect(passo.texto).not.toMatch(/ — /);
      }
    }
  });

  it("acha a tela pelo endereço", () => {
    expect(telaDoCaminho("/visao-geral")).toBe("visao-geral");
    expect(telaDoCaminho("/dashboard")).toBe("conciliacoes");
    expect(telaDoCaminho("/conciliacoes/nova")).toBe("nova-conciliacao");
    expect(telaDoCaminho("/conciliacoes/abc")).toBe("comparacao");
    expect(telaDoCaminho("/conciliacoes/abc/linha-1")).toBe("divergencia");
    expect(telaDoCaminho("/extratos")).toBe("extratos");
    expect(telaDoCaminho("/historico")).toBe("historico");
    expect(telaDoCaminho("/fechamentos")).toBe("fechamentos");
    expect(telaDoCaminho("/fechamentos/2026-09/relatorio")).toBeNull();
    expect(telaDoCaminho("/assinatura")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(app)/tutorial"` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import type { TelaDoTutorial } from "@/lib/preferencias";

/**
 * O tutorial de cada tela, apresentado pelo mascote (spec 2026-10-15-primeiro-uso, parte 3).
 * `alvo` é o `data-tutorial` do elemento que o passo destaca; sem ele na tela, o passo aparece
 * sem destaque. Rascunho: o texto final passa pela revisão dos sócios.
 */
export type PassoDoTutorial = { alvo: string; titulo: string; texto: string };
export type TutorialDaTela = { nome: string; mascote: string; passos: PassoDoTutorial[] };

export const TUTORIAIS: Record<TelaDoTutorial, TutorialDaTela> = {
  "visao-geral": {
    nome: "Visão geral",
    mascote: "/mascotes/mascote-apresenta.png",
    passos: [
      { alvo: "roteiro", titulo: "Este é o seu roteiro.", texto: "Cada passo se marca sozinho quando você faz. Comece pela tolerância de dias: ela diz quantos dias de diferença entre o banco e o sistema ainda contam como bateu." },
      { alvo: "estado-do-mes", titulo: "O mês em um número.", texto: "Quantos lançamentos do mês aberto já bateram e quanto ainda está em aberto." },
      { alvo: "atalhos", titulo: "Atalhos para o resto.", texto: "Extratos, conciliações, fechamentos e histórico, com o que mudou desde a última vez." },
    ],
  },
  conciliacoes: {
    nome: "Conciliações",
    mascote: "/mascotes/mascote-caminhando.png",
    passos: [
      { alvo: "continuar", titulo: "Continue de onde parou.", texto: "A conciliação que ainda pede decisão fica aqui em cima, com um botão que volta direto para ela." },
      { alvo: "filtros", titulo: "Filtre a fila.", texto: "Veja só o que pede decisão, o que já está sem pendência ou os meses fechados." },
      { alvo: "lista", titulo: "Sua fila de conciliações.", texto: "Cada linha é um extrato do banco, com a rodada que vale. Clique na linha para abrir a comparação." },
    ],
  },
  "nova-conciliacao": {
    nome: "Nova conciliação",
    mascote: "/mascotes/mascote-joinha.png",
    passos: [
      { alvo: "encaixe", titulo: "Encaixe os dois extratos.", texto: "O do banco vai à esquerda e o do sistema de gestão à direita, do mesmo período." },
      { alvo: "conciliar", titulo: "Concilie.", texto: "Com os dois arquivos, o botão libera. A comparação abre sozinha quando terminar." },
    ],
  },
  comparacao: {
    nome: "Comparação",
    mascote: "/mascotes/mascote-lupa.png",
    passos: [
      { alvo: "resumo", titulo: "O resumo antes da lista.", texto: "Cada categoria diz quantos lançamentos caíram nela e quanto valem. Clique numa para ver só essas linhas." },
      { alvo: "filtros", titulo: "Escolha o que ver.", texto: "Os filtros mostram tudo, só o que pede decisão ou só o que já bateu." },
      { alvo: "conferida", titulo: "Marque o que você já olhou.", texto: "A coluna Conferida é sua: marque as divergências que já conferiu. As que bateram não precisam." },
    ],
  },
  divergencia: {
    nome: "Detalhe da divergência",
    mascote: "/mascotes/mascote-lupa.png",
    passos: [
      { alvo: "lados", titulo: "Banco de um lado, sistema do outro.", texto: "A diferença aparece entre os dois. É o sistema que diverge do banco, nunca o contrário." },
      { alvo: "causa", titulo: "O provável motivo.", texto: "Confira o motivo e decida: marque como conferida ou justifique. A decisão vai para o fechamento." },
    ],
  },
  extratos: {
    nome: "Extratos",
    mascote: "/mascotes/mascote-explicando.png",
    passos: [
      { alvo: "filtros", titulo: "Separe o banco do sistema.", texto: "Os filtros mostram só os arquivos do banco, só os do sistema ou os que tiveram problema na leitura." },
      { alvo: "arquivos", titulo: "Todos os arquivos que você enviou.", texto: "Agrupados pelo mês do extrato. Clique num arquivo para ver os detalhes ao lado." },
      { alvo: "painel", titulo: "O que aconteceu com o arquivo.", texto: "Quantas linhas foram lidas, quando foi conciliado e o atalho para a conciliação dele." },
    ],
  },
  historico: {
    nome: "Histórico",
    mascote: "/mascotes/mascote-sentado.png",
    passos: [
      { alvo: "grafico", titulo: "Como os meses andaram.", texto: "O gráfico mostra quanto bateu em cada mês." },
      { alvo: "lista", titulo: "Tudo o que foi conciliado.", texto: "Cada conciliação com as rodadas que ela teve. Clique para abrir a comparação daquela rodada." },
    ],
  },
  fechamentos: {
    nome: "Fechamentos",
    mascote: "/mascotes/mascote-comemorando.png",
    passos: [
      { alvo: "meses", titulo: "Um cartão por mês.", texto: "A cor e a porcentagem mostram o que já bateu. Escolha o mês que quer fechar." },
      { alvo: "painel", titulo: "O que falta para fechar.", texto: "Os passos que faltam, o relatório em PDF e o botão de fechar o mês aparecem aqui." },
    ],
  },
  configuracoes: {
    nome: "Configurações",
    mascote: "/mascotes/mascote-apresenta.png",
    passos: [
      { alvo: "tolerancia", titulo: "A sua regra da conciliação.", texto: "A tolerância diz quantos dias de diferença entre o banco e o sistema ainda contam como bateu. Vale a partir da próxima conciliação." },
      { alvo: "fonte-da-verdade", titulo: "O banco é a referência.", texto: "Toda divergência aparece como o sistema divergindo do banco. É no sistema que se corrige." },
    ],
  },
};

/** A tela do tutorial pelo endereço; null onde não há tutorial (relatório, assinatura, 404). */
export function telaDoCaminho(caminho: string): TelaDoTutorial | null {
  const partes = caminho.split("/").filter(Boolean);
  if (partes[0] === "visao-geral") return "visao-geral";
  if (partes[0] === "dashboard") return "conciliacoes";
  if (partes[0] === "extratos") return "extratos";
  if (partes[0] === "historico") return "historico";
  if (partes[0] === "fechamentos" && partes.length === 1) return "fechamentos";
  if (partes[0] === "conciliacoes") {
    if (partes[1] === "nova") return "nova-conciliacao";
    if (partes.length === 2) return "comparacao";
    if (partes.length === 3) return "divergencia";
  }
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.

- [ ] **Step 5: Commit** — `git add "app/(app)/tutorial" && git commit -m "feat(tutorial): textos do mascote para cada tela"`

### Task 6: O cartão do tutorial

**Files:**
- Create: `app/(app)/tutorial/tutorial.tsx`, `lib/eventos.ts`
- Modify: `app/globals.css` (bloco `.tutorial` e `[data-tutorial-ativo]`)
- Test: `app/(app)/tutorial/tutorial.test.tsx`

**Interfaces:**
- Consumes: `usePreferencias` (Task 4), `TUTORIAIS`, `TelaDoTutorial` (Tasks 3 e 5).
- Produces:
  - `Tutorial({ tela, atraso = 600 }: { tela: TelaDoTutorial; atraso?: number })`
  - `lib/eventos.ts`: `ABRIR_TUTORIAL = "ledgr:abrir-tutorial"`, `abrirTutorial(): void`, `ABRIR_CONFIGURACOES = "ledgr:abrir-configuracoes"`, `abrirConfiguracoes(secao: string): void`.

- [ ] **Step 1: Testes**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tutorial } from "./tutorial";
import { ProvedorDaConta } from "../conta";
import { abrirTutorial } from "@/lib/eventos";

vi.mock("../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

function montar(conteudo = <div data-tutorial="filtros">filtros</div>) {
  return render(
    <ProvedorDaConta preferencias={null}>
      {conteudo}
      <button>fora</button>
      <Tutorial tela="extratos" atraso={0} />
    </ProvedorDaConta>,
  );
}

describe("Tutorial", () => {
  beforeEach(() => window.localStorage.clear());

  it("abre sozinho na primeira visita e destaca o alvo do passo", async () => {
    montar();
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
    expect(screen.getByText("Extratos · 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("filtros")).toHaveAttribute("data-tutorial-ativo");
  });

  it("anda pelos passos e o passo sem alvo aparece sem destaque", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("dialog", { name: "Todos os arquivos que você enviou." })).toBeInTheDocument();
    expect(screen.getByText("filtros")).not.toHaveAttribute("data-tutorial-ativo");
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
  });

  it("Esc fecha, devolve o foco e volta na próxima visita", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    screen.getByRole("button", { name: "fora" }).focus();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
    unmount();
    montar();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("com a caixa marcada, não volta mais", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    await screen.findByRole("dialog");
    await user.click(screen.getByLabelText("Não mostrar de novo"));
    await user.click(screen.getByRole("button", { name: "Pular" }));
    unmount();
    montar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o botão ? reabre mesmo dispensado", async () => {
    window.localStorage.setItem("ledgr:preferencias", JSON.stringify({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false }));
    montar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => abrirTutorial());
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
  });

  it("desmontar com o tutorial aberto tira o destaque", async () => {
    const { unmount } = montar();
    await screen.findByRole("dialog");
    unmount();
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run "app/(app)/tutorial/tutorial.test.tsx"` → FAIL.

- [ ] **Step 3: `lib/eventos.ts`**

```ts
/** Eventos de janela entre partes do app que não se conhecem (a barra do topo e o tutorial, o roteiro e as Configurações). */
export const ABRIR_TUTORIAL = "ledgr:abrir-tutorial";
export const ABRIR_CONFIGURACOES = "ledgr:abrir-configuracoes";

export function abrirTutorial(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_TUTORIAL));
}

export function abrirConfiguracoes(secao: string): void {
  window.dispatchEvent(new CustomEvent(ABRIR_CONFIGURACOES, { detail: { secao } }));
}
```

- [ ] **Step 4: `app/(app)/tutorial/tutorial.tsx`**

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { ABRIR_TUTORIAL } from "@/lib/eventos";
import type { TelaDoTutorial } from "@/lib/preferencias";
import { usePreferencias } from "../conta";
import { TUTORIAIS } from "./roteiros";

const ATIVO = "data-tutorial-ativo";

/**
 * O tutorial de uma tela: um cartão do mascote no canto, que destaca a parte da tela de cada passo.
 * Abre sozinho na primeira visita; "Não mostrar de novo" guarda na conta; o "?" da barra do topo
 * reabre. Não é modal: dá para clicar fora.
 */
export function Tutorial({ tela, atraso = 600 }: { tela: TelaDoTutorial; atraso?: number }) {
  const { carregado, tutorialDispensado, dispensarTutorial } = usePreferencias();
  const { nome, mascote, passos } = TUTORIAIS[tela];
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const cartao = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const titulo = useId();

  // primeira visita: abre depois que a tela carregou
  useEffect(() => {
    if (!carregado || tutorialDispensado(tela)) return;
    const timer = setTimeout(() => abrir(), atraso);
    return () => clearTimeout(timer);
    // só na montagem e quando as preferências chegam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, tela]);

  // o "?" da barra do topo
  useEffect(() => {
    const reabrir = () => abrir();
    window.addEventListener(ABRIR_TUTORIAL, reabrir);
    return () => window.removeEventListener(ABRIR_TUTORIAL, reabrir);
  }, []);

  function abrir() {
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIndice(0);
    setNaoMostrar(false);
    setAberto(true);
  }

  // destaque do passo atual; sai ao trocar de passo, fechar ou desmontar
  useEffect(() => {
    if (!aberto) return;
    const alvo = document.querySelector<HTMLElement>(`[data-tutorial="${passos[indice].alvo}"]`);
    if (!alvo) return;
    const estatico = getComputedStyle(alvo).position === "static";
    if (estatico) alvo.style.position = "relative";
    alvo.setAttribute(ATIVO, "");
    const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    alvo.scrollIntoView?.({ block: "center", behavior: suave ? "smooth" : "auto" });
    return () => {
      alvo.removeAttribute(ATIVO);
      if (estatico) alvo.style.position = "";
    };
  }, [aberto, indice, passos]);

  useEffect(() => {
    if (aberto) cartao.current?.focus();
  }, [aberto, indice]);

  function fechar() {
    if (naoMostrar) dispensarTutorial(tela);
    setAberto(false);
    focoAnterior.current?.focus?.();
  }

  if (!aberto) return null;
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  return (
    <div
      ref={cartao}
      role="dialog"
      aria-labelledby={titulo}
      tabIndex={-1}
      className="card tutorial"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          evento.stopPropagation();
          fechar();
        }
      }}
    >
      <div className="tutorial-topo">
        <Image src={mascote} alt="" width={52} height={52} className="tutorial-mascote" />
        <span className="tutorial-contagem">{`${nome} · ${indice + 1} de ${passos.length}`}</span>
        <button type="button" className="app-icone-botao" aria-label="Fechar o tutorial" onClick={fechar}>
          <X size={16} />
        </button>
      </div>
      <h2 id={titulo} className="tutorial-titulo">
        {passo.titulo}
      </h2>
      <p className="tutorial-texto">{passo.texto}</p>
      <label className="tutorial-caixa">
        <input type="checkbox" checked={naoMostrar} onChange={(e) => setNaoMostrar(e.target.checked)} />
        Não mostrar de novo
      </label>
      <div className="tutorial-acoes">
        <span className="tutorial-pontos" aria-hidden="true">
          {passos.map((_, i) => (
            <span key={i} data-atual={i === indice || undefined} />
          ))}
        </span>
        <button type="button" className="btn btn-ghost" onClick={fechar}>
          Pular
        </button>
        <button type="button" className="btn btn-primary" onClick={() => (ultimo ? fechar() : setIndice(indice + 1))}>
          {ultimo ? "Entendi" : "Próximo"}
        </button>
      </div>
    </div>
  );
}
```

O Esc também precisa funcionar com o foco fora do cartão: acrescentar um `keydown` na janela enquanto `aberto`, que chama `fechar()` com `Escape` — mas só quando nenhum `<dialog open>` está na tela (a janela de Configurações usa o Esc dela). Escrever o teste do Esc com o foco no cartão (o caso acima) e mais um com o foco em `fora`.

- [ ] **Step 5: CSS em `app/globals.css`** (ao lado dos blocos do app)

```css
/* Tutorial do mascote (primeiro uso, 15/10): cartão no canto, destaque em traço neutro. */
.tutorial {
  position: fixed;
  right: max(24px, env(safe-area-inset-right, 0px));
  bottom: max(24px, env(safe-area-inset-bottom, 0px));
  z-index: 60;
  width: min(372px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 16px;
  background: var(--color-bg);
  box-shadow: var(--shadow-lg);
}
.tutorial:focus-visible { outline: 2px solid var(--color-text); outline-offset: 3px; }
.tutorial-topo { display: flex; align-items: center; gap: 12px; }
.tutorial-mascote { width: 52px; height: 52px; object-fit: contain; flex: none; }
.tutorial-contagem { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--texto-apagado); }
.tutorial-topo .app-icone-botao { margin-left: auto; }
.tutorial-titulo { margin: 0; font-family: var(--font-titulo); font-size: 21px; font-weight: 600; line-height: 1.25; }
.tutorial-texto { margin: 0; font-size: 14.5px; line-height: 1.6; }
.tutorial-caixa { display: flex; align-items: center; gap: 9px; font-size: 14px; color: var(--texto-apagado); cursor: pointer; }
.tutorial-caixa input { width: 16px; height: 16px; accent-color: var(--color-text); }
.tutorial-acoes { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
.tutorial-acoes .btn-ghost { margin-left: auto; }
.tutorial-pontos { display: flex; gap: 5px; }
.tutorial-pontos span { width: 6px; height: 6px; border-radius: 999px; background: var(--color-divider); }
.tutorial-pontos span[data-atual] { width: 18px; background: var(--color-text); }
[data-tutorial-ativo] {
  z-index: 45;
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 6px var(--color-bg), 0 0 0 8px var(--color-text), 0 0 0 100vmax rgb(12 11 10 / 0.28);
}
@media (prefers-reduced-motion: no-preference) {
  .tutorial { animation: tutorial-entra 0.22s ease-out; }
  @keyframes tutorial-entra { from { opacity: 0; transform: translateY(8px); } }
}
@media (max-width: 640px) {
  .tutorial { left: 16px; right: 16px; bottom: 16px; width: auto; }
}
```

- [ ] **Step 6: Rodar e ver passar** — `npx vitest run "app/(app)/tutorial"` → PASS.

- [ ] **Step 7: Commit** — `git add "app/(app)/tutorial" lib/eventos.ts app/globals.css && git commit -m "feat(tutorial): cartão do mascote com destaque e Não mostrar de novo"`

### Task 7: Ligar o tutorial nas telas

**Files:**
- Create: `app/(app)/tutorial/tutorial-da-rota.tsx`
- Modify: `app/(app)/shell.tsx`, `app/(app)/barra-superior.tsx`, `app/(app)/faixa-filtros.tsx`, `app/(app)/configuracoes.tsx`, e as telas com os alvos (lista abaixo)
- Test: `app/(app)/barra-superior.test.tsx`, `app/(app)/tutorial/tutorial-da-rota.test.tsx`

**Interfaces:**
- Consumes: `Tutorial`, `telaDoCaminho`, `abrirTutorial`.
- Produces: `FaixaFiltros` aceita `tutorial?: string` (vira `data-tutorial`).

- [ ] **Step 1: Teste da rota e do "?"**

```tsx
// tutorial-da-rota.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvedorDaConta } from "../conta";
import { TutorialDaRota } from "./tutorial-da-rota";

let caminho = "/extratos";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));
vi.mock("../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

describe("TutorialDaRota", () => {
  it("abre o tutorial da tela do endereço", async () => {
    render(<ProvedorDaConta preferencias={null}><TutorialDaRota atraso={0} /></ProvedorDaConta>);
    expect(await screen.findByText("Extratos · 1 de 3")).toBeInTheDocument();
  });

  it("não abre nada onde não há tutorial", async () => {
    caminho = "/assinatura";
    render(<ProvedorDaConta preferencias={null}><TutorialDaRota atraso={0} /></ProvedorDaConta>);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

Em `barra-superior.test.tsx`:

```tsx
  it("o ? pede o tutorial da tela", async () => {
    const ouvinte = vi.fn();
    window.addEventListener("ledgr:abrir-tutorial", ouvinte);
    const user = userEvent.setup();
    render(<BarraSuperior />);
    await user.click(screen.getByRole("button", { name: "Ver o tutorial desta tela" }));
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener("ledgr:abrir-tutorial", ouvinte);
  });
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: `tutorial-da-rota.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Tutorial } from "./tutorial";
import { telaDoCaminho } from "./roteiros";

/** O tutorial da tela aberta. A `key` remonta o cartão ao trocar de tela, e o destaque da anterior sai. */
export function TutorialDaRota({ atraso }: { atraso?: number }) {
  const tela = telaDoCaminho(usePathname());
  return tela ? <Tutorial key={tela} tela={tela} atraso={atraso} /> : null;
}
```

No `shell.tsx`, logo depois de `<div className="app-conteudo">{children}</div>`: `<TutorialDaRota />`.

- [ ] **Step 4: O "?" na barra**

Em `barra-superior.tsx`, antes do `<div style={{ position: "relative", flex: "none" }} ref={caixaAvisos}>`:

```tsx
      <button
        type="button"
        className="app-icone-botao app-dica app-ajuda"
        aria-label="Ver o tutorial desta tela"
        data-dica="Tutorial desta tela"
        onClick={abrirTutorial}
      >
        ?
      </button>
```

CSS: `.app-ajuda { font-family: var(--font-titulo); font-size: 17px; font-weight: 600; width: 36px; height: 36px; flex: none; }`.

- [ ] **Step 5: Os alvos (`data-tutorial`) em cada tela**

`faixa-filtros.tsx`: prop `tutorial?: string` repassada como `data-tutorial={tutorial}` no elemento raiz. Depois:

| Tela | Arquivo | Elemento | `data-tutorial` |
|---|---|---|---|
| Visão geral | `app/(app)/visao-geral/page.tsx` | `<section className="vg-estado" …>` | `estado-do-mes` |
| Visão geral | idem | o `<nav aria-labelledby="vg-atalhos-titulo">` | `atalhos` |
| Conciliações | `app/(app)/dashboard/em-andamento.tsx` | `<section className="conc-continuar" …>` | `continuar` |
| Conciliações | `app/(app)/dashboard/lista-de-trabalho.tsx` | `<FaixaFiltros>` → `<FaixaFiltros tutorial="filtros">`; `<table className="table conc-tabela">` | `filtros`, `lista` |
| Nova conciliação | `app/(app)/conciliacoes/nova/page.tsx` | o elemento `.nova-encaixe`; o botão `.nova-conciliar` | `encaixe`, `conciliar` |
| Comparação | `app/(app)/conciliacoes/[id]/relatorio.tsx` | raiz `className="relatorio"` | `resumo` |
| Comparação | `app/(app)/conciliacoes/[id]/page.tsx` | `.tabela-filtros`; `<th className="th-conferir" …>` | `filtros`, `conferida` |
| Divergência | `app/(app)/conciliacoes/[id]/[linha]/detalhe.tsx` | `.det-comparacao`; `.det-causa` | `lados`, `causa` |
| Extratos | `app/(app)/extratos/galeria.tsx` | `<FaixaFiltros tutorial="filtros">`; o primeiro `.extratos-grade` (no `.grupos`); o painel do arquivo (`region` "Arquivo selecionado") | `filtros`, `arquivos`, `painel` |
| Histórico | `app/(app)/historico/grafico.tsx` | `.hist-grafico-bloco`; e a tabela `.hist-tabela` (onde ela é renderizada) | `grafico`, `lista` |
| Fechamentos | `app/(app)/fechamentos/mesa.tsx` | a grade de meses (`.extratos-grade`); `.fech-painel` | `meses`, `painel` |
| Configurações | `app/(app)/configuracoes.tsx` | a `.cfg-linha` da tolerância (a do `aria-label="Tolerância de data, em dias"`); a da "Fonte da verdade" | `tolerancia`, `fonte-da-verdade` |

Atributo em JSX: `data-tutorial="estado-do-mes"`. Em elementos repetidos (cartões, linhas), só no primeiro (`data-tutorial={indice === 0 ? "arquivos" : undefined}`).

Configurações: na seção "Conciliação" (onde ficam as `cfg-linha`), renderizar `<Tutorial tela="configuracoes" />` dentro do `<dialog>` (o cartão fica na camada de cima junto com a janela). A janela é modal e trava o fundo: o destaque continua funcionando porque o alvo está dentro dela.

- [ ] **Step 6: Rodar tudo** — `npm run test`. Testes de tela que contam `role="dialog"` podem precisar de `vi.mock("./tutorial/tutorial-da-rota", () => ({ TutorialDaRota: () => null }))` no `shell.test.tsx`.

- [ ] **Step 7: Verificar e abrir o PR B**

```bash
npm run test && npm run lint && npm run build
git add -A "app/(app)" lib app/globals.css
git commit -m "feat(tutorial): tutorial do mascote em cada tela e o ? na barra do topo"
git push -u origin feat/tutorial
gh pr create --base develop --title "Primeiro uso, parte B: tutorial do mascote em cada tela" --body "Parte 3 de docs/superpowers/specs/2026-10-15-primeiro-uso-design.md. Sem a rota de preferências no backend, o Não mostrar de novo fica no navegador."
```

Conferir no navegador (`npm run dev`): cada tela abre o tutorial na primeira visita; marcar a caixa e recarregar não reabre; o "?" reabre; tela vazia não quebra; Esc fecha; no celular (390 px) o cartão fica embaixo, na largura toda.

---

## Entrega C: roteiro (PR 3)

Branch `feat/roteiro` a partir do `develop` com a B juntada.

### Task 8: Os passos do roteiro

**Files:**
- Create: `app/(app)/visao-geral/roteiro.ts`
- Modify: `app/(app)/conciliacoes/acoes.ts` (nova `carregarRoteiro`)
- Test: `app/(app)/visao-geral/roteiro.test.ts`, `app/(app)/conciliacoes/acoes.test.ts`

**Interfaces:**
- Produces:
  - `type DadosDoRoteiro = { toleranciaRevisada: boolean; temExtratoDoBanco: boolean; conciliou: boolean; resolveuAlguma: boolean; fechouAlgum: boolean; conciliacaoComPendencia: string | null }`
  - `type PassoDoRoteiro = { id: "plano" | "tolerancia" | "banco" | "conciliar" | "divergencias" | "fechar"; titulo: string; texto: string; feito: boolean; destino: { tipo: "link"; href: string } | { tipo: "configuracoes" } | null }`
  - `passosDoRoteiro(d: DadosDoRoteiro): PassoDoRoteiro[]`
  - `roteiroVisivel(d: DadosDoRoteiro): boolean` (falso depois do primeiro mês fechado)
  - `carregarRoteiro(): Promise<DadosDoRoteiro | null>` (null quando não deu para ler: a Visão geral fica sem roteiro)

- [ ] **Step 1: Testes do puro**

```ts
import { describe, it, expect } from "vitest";
import { passosDoRoteiro, roteiroVisivel, type DadosDoRoteiro } from "./roteiro";

const NADA: DadosDoRoteiro = {
  toleranciaRevisada: false, temExtratoDoBanco: false, conciliou: false,
  resolveuAlguma: false, fechouAlgum: false, conciliacaoComPendencia: null,
};

describe("roteiro", () => {
  it("conta nova: só o plano feito", () => {
    const passos = passosDoRoteiro(NADA);
    expect(passos.map((p) => p.id)).toEqual(["plano", "tolerancia", "banco", "conciliar", "divergencias", "fechar"]);
    expect(passos.filter((p) => p.feito).map((p) => p.id)).toEqual(["plano"]);
    expect(passos[1].destino).toEqual({ tipo: "configuracoes" });
  });

  it("cada passo marca pelo dado certo", () => {
    const passos = passosDoRoteiro({ ...NADA, toleranciaRevisada: true, temExtratoDoBanco: true, conciliou: true, conciliacaoComPendencia: "/conciliacoes/b1" });
    expect(passos.filter((p) => p.feito).map((p) => p.id)).toEqual(["plano", "tolerancia", "banco", "conciliar"]);
    expect(passos.find((p) => p.id === "divergencias")?.destino).toEqual({ tipo: "link", href: "/conciliacoes/b1" });
  });

  it("conciliar sem extrato listado ainda conta o banco como enviado", () => {
    const passos = passosDoRoteiro({ ...NADA, conciliou: true });
    expect(passos.find((p) => p.id === "banco")?.feito).toBe(true);
  });

  it("some depois do primeiro mês fechado", () => {
    expect(roteiroVisivel(NADA)).toBe(true);
    expect(roteiroVisivel({ ...NADA, fechouAlgum: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: `roteiro.ts`**

```ts
/**
 * O roteiro de primeiros passos da Visão geral (spec 2026-10-15-primeiro-uso, parte 4). Cada passo
 * se marca pelo que já existe na conta. "Escolher o plano" está sempre feito: quem chega à Visão
 * geral sem plano é levado antes para /plano.
 */
export type DadosDoRoteiro = {
  /** A tolerância já foi salva alguma vez (`atualizado_em` de `/empresa/configuracoes`). */
  toleranciaRevisada: boolean;
  temExtratoDoBanco: boolean;
  conciliou: boolean;
  /** Alguma conciliação sem nada pedindo decisão. */
  resolveuAlguma: boolean;
  fechouAlgum: boolean;
  /** O endereço da conciliação com mais pendências, para o passo das divergências. */
  conciliacaoComPendencia: string | null;
};

type Destino = { tipo: "link"; href: string } | { tipo: "configuracoes" } | null;

export type PassoDoRoteiro = {
  id: "plano" | "tolerancia" | "banco" | "conciliar" | "divergencias" | "fechar";
  titulo: string;
  texto: string;
  feito: boolean;
  destino: Destino;
};

export function passosDoRoteiro(d: DadosDoRoteiro): PassoDoRoteiro[] {
  return [
    { id: "plano", titulo: "Escolher o plano", texto: "O teste de 14 dias começou.", feito: true, destino: null },
    { id: "tolerancia", titulo: "Definir a tolerância de dias", texto: "Quantos dias de diferença ainda contam como bateu.", feito: d.toleranciaRevisada, destino: { tipo: "configuracoes" } },
    { id: "banco", titulo: "Enviar o extrato do banco", texto: "OFX ou CSV do internet banking.", feito: d.temExtratoDoBanco || d.conciliou, destino: { tipo: "link", href: "/conciliacoes/nova" } },
    { id: "conciliar", titulo: "Enviar o extrato do sistema e conciliar", texto: "O CSV exportado do seu sistema de gestão.", feito: d.conciliou, destino: { tipo: "link", href: "/conciliacoes/nova" } },
    { id: "divergencias", titulo: "Resolver as divergências", texto: "Conferir ou justificar o que não bateu.", feito: d.resolveuAlguma, destino: d.conciliacaoComPendencia ? { tipo: "link", href: d.conciliacaoComPendencia } : null },
    { id: "fechar", titulo: "Fechar o mês", texto: "Com o relatório em PDF para o cliente.", feito: d.fechouAlgum, destino: { tipo: "link", href: "/fechamentos" } },
  ];
}

export function roteiroVisivel(d: DadosDoRoteiro): boolean {
  return !d.fechouAlgum;
}
```

- [ ] **Step 4: `carregarRoteiro` em `acoes.ts`** (com teste no `acoes.test.ts`, mockando `chamarBackend` para `/empresa/configuracoes`, `/extratos?limit=100&offset=0`, `/execucoes…` e `/fechamentos`, no padrão dos testes de `carregarVisaoGeral` do mesmo arquivo)

```ts
/**
 * O que o roteiro da Visão geral precisa saber (spec 2026-10-15-primeiro-uso, parte 4). Null quando
 * alguma leitura falhou: sem certeza, a Visão geral fica sem roteiro em vez de marcar errado.
 */
export async function carregarRoteiro(): Promise<DadosDoRoteiro | null> {
  try {
    const [regras, extratos, lista, fechamentos] = await Promise.all([
      chamarBackend<ConfiguracoesAPI>("/empresa/configuracoes"),
      chamarBackend<ListaExtratosAPI>("/extratos?limit=100&offset=0"),
      listarExecucoes(),
      listarFechamentos(),
    ]);
    if (!lista.ok || fechamentos === null) return null;
    const conciliacoes = porConciliacao(lista.dados.execucoes);
    const comPendencia = [...conciliacoes].sort((a, b) => pedemDecisao(b) - pedemDecisao(a))[0];
    return {
      toleranciaRevisada: adaptarRegras(regras).atualizadoEm !== null,
      temExtratoDoBanco: extratos.itens.some((item) => item.origem === "banco"),
      conciliou: lista.dados.execucoes.length > 0,
      resolveuAlguma: conciliacoes.some((c) => pedemDecisao(c) === 0),
      fechouAlgum: fechamentos.some((f) => f.estado === "fechado"),
      conciliacaoComPendencia: comPendencia && pedemDecisao(comPendencia) > 0 ? caminhoDaConciliacao(comPendencia.extratoBancoId) : null,
    };
  } catch {
    return null;
  }
}
```

Antes de escrever, conferir as assinaturas reais de `porConciliacao` (`../historico/execucoes`) e `pedemDecisao` (`../dashboard/lista`) — `pedemDecisao` recebe um `ConciliacaoNaLista`; se `porConciliacao` não devolver esse tipo, usar o mesmo caminho que `carregarConciliacoes` usa para montar a lista e contar por ele. Importar `type DadosDoRoteiro` de `../visao-geral/roteiro`.

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run "app/(app)/visao-geral/roteiro.test.ts" "app/(app)/conciliacoes/acoes.test.ts"` → PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(roteiro): passos de primeiros passos marcados pelo que existe na conta"`

### Task 9: A faixa do roteiro na Visão geral

**Files:**
- Create: `app/(app)/visao-geral/roteiro-faixa.tsx`
- Modify: `app/(app)/visao-geral/page.tsx`, `app/(app)/menu-lateral.tsx`, `app/(app)/configuracoes.tsx`, `app/globals.css`
- Test: `app/(app)/visao-geral/roteiro-faixa.test.tsx`, `app/(app)/visao-geral/page.test.tsx`

**Interfaces:**
- Consumes: `passosDoRoteiro`, `roteiroVisivel`, `carregarRoteiro`, `usePreferencias().roteiroDispensado/dispensarRoteiro`, `abrirConfiguracoes`.
- Produces: `RoteiroFaixa({ passos, alternativa }: { passos: PassoDoRoteiro[]; alternativa: ReactNode })` — mostra a faixa, ou `alternativa` quando dispensado (a conta nova sem roteiro volta a ver o "Nenhum extrato por aqui ainda").

- [ ] **Step 1: Testes**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaConta } from "../conta";
import { RoteiroFaixa } from "./roteiro-faixa";
import { passosDoRoteiro } from "./roteiro";

vi.mock("../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

const passos = passosDoRoteiro({ toleranciaRevisada: false, temExtratoDoBanco: false, conciliou: false, resolveuAlguma: false, fechouAlgum: false, conciliacaoComPendencia: null });

function montar() {
  return render(<ProvedorDaConta preferencias={null}><RoteiroFaixa passos={passos} alternativa={<p>sem roteiro</p>} /></ProvedorDaConta>);
}

describe("RoteiroFaixa", () => {
  beforeEach(() => window.localStorage.clear());

  it("mostra os seis passos, o progresso e o próximo passo em destaque", async () => {
    montar();
    expect(await screen.findByRole("heading", { name: "Primeiros passos" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Primeiros passos feitos" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("1 de 6")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Definir agora" })).toBeInTheDocument();
  });

  it("Definir agora abre as Configurações na seção Conciliação", async () => {
    const ouvinte = vi.fn();
    window.addEventListener("ledgr:abrir-configuracoes", ouvinte);
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: "Definir agora" }));
    expect((ouvinte.mock.calls[0][0] as CustomEvent).detail).toEqual({ secao: "conciliacao" });
    window.removeEventListener("ledgr:abrir-configuracoes", ouvinte);
  });

  it("Já sei usar troca pela alternativa e não volta", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    await user.click(await screen.findByRole("button", { name: "Já sei usar" }));
    expect(screen.getByText("sem roteiro")).toBeInTheDocument();
    unmount();
    montar();
    await waitFor(() => expect(screen.getByText("sem roteiro")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: `roteiro-faixa.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { abrirConfiguracoes } from "@/lib/eventos";
import { usePreferencias } from "../conta";
import type { PassoDoRoteiro } from "./roteiro";

/** A faixa de primeiros passos no topo da Visão geral, até a pessoa terminar ou dispensar. */
export function RoteiroFaixa({ passos, alternativa }: { passos: PassoDoRoteiro[]; alternativa: ReactNode }) {
  const { carregado, roteiroDispensado, dispensarRoteiro } = usePreferencias();
  if (!carregado) return null;
  if (roteiroDispensado) return <>{alternativa}</>;
  const feitos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito);

  return (
    <section className="card roteiro" aria-labelledby="roteiro-titulo" data-tutorial="roteiro">
      <div className="roteiro-topo">
        <div className="roteiro-cabeca">
          <h2 id="roteiro-titulo" className="roteiro-titulo">Primeiros passos</h2>
          <span className="roteiro-sub">Do primeiro extrato ao mês fechado.</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={dispensarRoteiro}>Já sei usar</button>
      </div>
      <div className="roteiro-progresso">
        <div role="progressbar" aria-label="Primeiros passos feitos" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos} className="roteiro-barra">
          <span style={{ width: `${(feitos / passos.length) * 100}%` }} />
        </div>
        <span className="roteiro-conta">{`${feitos} de ${passos.length}`}</span>
      </div>
      <ol className="roteiro-passos">
        {passos.map((passo, i) => {
          const agora = passo === proximo;
          return (
            <li key={passo.id} className="roteiro-passo" data-feito={passo.feito || undefined} data-agora={agora || undefined}>
              <span className="roteiro-marca" aria-hidden="true">{passo.feito ? <Check size={15} /> : i + 1}</span>
              <span className="roteiro-texto">
                <span className="roteiro-passo-titulo">
                  {passo.titulo}
                  {passo.feito && <span className="sr-only"> (feito)</span>}
                </span>
                <span className="roteiro-passo-detalhe">{passo.texto}</span>
              </span>
              {agora && passo.destino?.tipo === "configuracoes" && (
                <button type="button" className="btn btn-primary" onClick={() => abrirConfiguracoes("conciliacao")}>
                  Definir agora<ArrowRight size={15} />
                </button>
              )}
              {agora && passo.destino?.tipo === "link" && (
                <Link href={passo.destino.href} className="btn btn-primary">
                  Fazer agora<ArrowRight size={15} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

CSS em `globals.css` (mesmo desenho do quadro "Proposta · Visão geral" do canvas):

```css
/* Roteiro de primeiros passos (primeiro uso, 15/10) */
.roteiro { display: flex; flex-direction: column; gap: 18px; padding: 26px 28px; max-width: 760px; }
.roteiro-topo { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.roteiro-cabeca { display: flex; flex-direction: column; gap: 4px; }
.roteiro-titulo { margin: 0; font-family: var(--font-titulo); font-size: 26px; font-weight: 600; }
.roteiro-sub, .roteiro-conta, .roteiro-passo-detalhe { font-size: 14px; color: var(--texto-apagado); }
.roteiro-progresso { display: flex; align-items: center; gap: 14px; }
.roteiro-barra { flex: 1; height: 6px; border-radius: 999px; background: var(--color-divider); overflow: hidden; }
.roteiro-barra span { display: block; height: 100%; background: var(--color-ok-700); }
.roteiro-conta { font-variant-numeric: tabular-nums; }
.roteiro-passos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.roteiro-passo { display: flex; align-items: center; gap: 14px; padding: 13px 0; }
.roteiro-passo + .roteiro-passo { border-top: 1px solid var(--color-divider); }
.roteiro-marca { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--color-divider); display: grid; place-items: center; flex: none; font-size: 13px; }
.roteiro-passo[data-agora] .roteiro-marca { border-color: var(--color-text); }
.roteiro-passo[data-feito] .roteiro-marca { background: var(--color-ok-700); border-color: var(--color-ok-700); color: var(--color-bg); }
.roteiro-texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.roteiro-passo-titulo { font-size: 15.5px; }
.roteiro-passo[data-agora] .roteiro-passo-titulo { font-weight: 600; }
.roteiro-passo[data-feito] .roteiro-passo-titulo { color: var(--texto-apagado); text-decoration: line-through; }
@media (max-width: 640px) { .roteiro { padding: 20px 18px; } .roteiro-passo { flex-wrap: wrap; } }
```

- [ ] **Step 4: Abrir as Configurações por evento**

`menu-lateral.tsx`: estado `const [secaoPedida, setSecaoPedida] = useState<string | undefined>()`; um `useEffect` que escuta `ABRIR_CONFIGURACOES` e faz `setSecaoPedida((e as CustomEvent<{ secao: string }>).detail.secao); setConfigAberta(true);`; passar `secao={secaoPedida}` para `<Configuracoes>` e limpar no `onFechar`. `configuracoes.tsx`: prop nova `secao?: string`; no efeito que abre a janela (`if (aberta && !elemento.open)`), antes do `showModal`, `if (secao) setSecaoId(secao);`. Teste em `menu-lateral.test.tsx`: disparar `abrirConfiguracoes("conciliacao")` e esperar a janela com a seção "Conciliação" ativa.

- [ ] **Step 5: Na Visão geral**

`page.tsx`: carregar em paralelo `const [resposta, roteiro] = await Promise.all([carregarVisaoGeral(), carregarRoteiro()]);`. Logo depois do `<Cabecalho>`:

```tsx
      {roteiro && roteiroVisivel(roteiro) ? (
        <RoteiroFaixa passos={passosDoRoteiro(roteiro)} alternativa={recente === null ? <PrimeirosPassos /> : null} />
      ) : null}
```

E no ramo `recente === null`, só renderizar `<PrimeirosPassos />` quando **não** há roteiro visível (senão a conta nova vê os dois). No `page.test.tsx`, mockar `carregarRoteiro` (devolvendo `null` nos testes antigos) e acrescentar: conta nova com roteiro mostra "Primeiros passos" e não "Nenhum extrato por aqui ainda"; com `fechouAlgum: true` não mostra o roteiro.

- [ ] **Step 6: Rodar, verificar e abrir o PR C**

```bash
npm run test && npm run lint && npm run build
git add -A "app/(app)" app/globals.css
git commit -m "feat(roteiro): primeiros passos na Visão geral, com Já sei usar"
git push -u origin feat/roteiro
gh pr create --base develop --title "Primeiro uso, parte C: roteiro de primeiros passos na Visão geral" --body "Parte 4 de docs/superpowers/specs/2026-10-15-primeiro-uso-design.md."
```

---

## Entrega D: plano e teste de 14 dias (PR 4)

Branch `feat/plano-teste` a partir do `develop` com a C juntada. Liga sozinha quando o `GET /me` trouxer `situacao`.

### Task 10: A assinatura da conta

**Files:**
- Create: `lib/assinatura.ts`
- Modify: `app/(auth)/acoes.ts` (`ContaDaSessao.assinatura`)
- Test: `lib/assinatura.test.ts`, `app/(auth)/acoes.test.ts`

**Interfaces:**
- Produces:
  - `type PlanoId = "essencial" | "padrao" | "avancado"`
  - `type SituacaoDaConta = "sem_plano" | "teste" | "teste_encerrado" | "ativo"`
  - `type Assinatura = { situacao: SituacaoDaConta; plano: PlanoId | null; testeTerminaEm: string | null }`
  - `adaptarAssinatura(bruto: { situacao?: unknown; plano?: unknown; teste_termina_em?: unknown }): Assinatura | null`
  - `diasRestantes(testeTerminaEm: string, agora: Date): number`
  - `fraseDoTeste(dias: number): string`
  - `planosDoTeste(): (Plano & { id: PlanoId })[]`
  - `ContaDaSessao.assinatura: Assinatura | null`

- [ ] **Step 1: Testes**

```ts
import { describe, it, expect } from "vitest";
import { adaptarAssinatura, diasRestantes, fraseDoTeste, planosDoTeste } from "./assinatura";

describe("assinatura", () => {
  it("lê o que o /me manda", () => {
    expect(adaptarAssinatura({ situacao: "teste", plano: "padrao", teste_termina_em: "2026-10-29" })).toEqual({
      situacao: "teste", plano: "padrao", testeTerminaEm: "2026-10-29",
    });
  });

  it("sem situação, ou com uma desconhecida, é ausente: ninguém é bloqueado", () => {
    expect(adaptarAssinatura({})).toBeNull();
    expect(adaptarAssinatura({ situacao: "trial" })).toBeNull();
  });

  it("plano e data inválidos viram null", () => {
    expect(adaptarAssinatura({ situacao: "teste", plano: "ouro", teste_termina_em: "29/10/2026" })).toEqual({
      situacao: "teste", plano: null, testeTerminaEm: null,
    });
  });

  it("conta os dias pelo calendário de São Paulo", () => {
    expect(diasRestantes("2026-10-29", new Date("2026-10-15T12:00:00-03:00"))).toBe(14);
    expect(diasRestantes("2026-10-29", new Date("2026-10-29T23:30:00-03:00"))).toBe(0);
    // 01:00 UTC do dia 16 ainda é dia 15 em São Paulo
    expect(diasRestantes("2026-10-29", new Date("2026-10-16T01:00:00Z"))).toBe(14);
    expect(diasRestantes("2026-10-10", new Date("2026-10-15T12:00:00-03:00"))).toBe(0);
  });

  it("escreve o que falta", () => {
    expect(fraseDoTeste(9)).toBe("Teste grátis · faltam 9 dias");
    expect(fraseDoTeste(1)).toBe("Teste grátis · falta 1 dia");
    expect(fraseDoTeste(0)).toBe("Teste grátis · último dia");
  });

  it("os planos do teste vêm de lib/planos", () => {
    expect(planosDoTeste().map((p) => [p.id, p.nome])).toEqual([
      ["essencial", "Essencial"], ["padrao", "Padrão"], ["avancado", "Avançado"],
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: `lib/assinatura.ts`**

```ts
import { PLANOS, type Plano } from "./planos";

/**
 * O plano e o teste de 14 dias da conta, do `GET /me` (spec 2026-10-15-primeiro-uso, parte 2).
 * Sem `situacao` (backend antigo) ou com valor desconhecido, a assinatura é ausente e nada bloqueia.
 */
export type PlanoId = "essencial" | "padrao" | "avancado";
export type SituacaoDaConta = "sem_plano" | "teste" | "teste_encerrado" | "ativo";
export type Assinatura = { situacao: SituacaoDaConta; plano: PlanoId | null; testeTerminaEm: string | null };

const SITUACOES: SituacaoDaConta[] = ["sem_plano", "teste", "teste_encerrado", "ativo"];
const NOMES: Record<PlanoId, string> = { essencial: "Essencial", padrao: "Padrão", avancado: "Avançado" };

export function adaptarAssinatura(bruto: { situacao?: unknown; plano?: unknown; teste_termina_em?: unknown }): Assinatura | null {
  if (!SITUACOES.includes(bruto.situacao as SituacaoDaConta)) return null;
  const plano = typeof bruto.plano === "string" && bruto.plano in NOMES ? (bruto.plano as PlanoId) : null;
  const data = typeof bruto.teste_termina_em === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bruto.teste_termina_em) ? bruto.teste_termina_em : null;
  return { situacao: bruto.situacao as SituacaoDaConta, plano, testeTerminaEm: data };
}

const HOJE_EM_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** Dias de calendário até o fim do teste, contados em São Paulo; nunca negativo. */
export function diasRestantes(testeTerminaEm: string, agora: Date): number {
  const [a, m, d] = testeTerminaEm.split("-").map(Number);
  const [ha, hm, hd] = HOJE_EM_SP.format(agora).split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86_400_000));
}

export function fraseDoTeste(dias: number): string {
  if (dias === 0) return "Teste grátis · último dia";
  return dias === 1 ? "Teste grátis · falta 1 dia" : `Teste grátis · faltam ${dias} dias`;
}

/** Os três planos do teste, com preço e faixa de lib/planos (a tabela que vale ainda está aberta). */
export function planosDoTeste(): (Plano & { id: PlanoId })[] {
  return (Object.keys(NOMES) as PlanoId[]).map((id) => {
    const plano = PLANOS.find((p) => p.nome === NOMES[id]);
    if (!plano) throw new Error(`Plano "${NOMES[id]}" não está em lib/planos.ts`);
    return { ...plano, id };
  });
}

export const NOME_DO_PLANO = NOMES;
```

- [ ] **Step 4: Na conta da sessão**

`ContaDaSessao` ganha `assinatura: Assinatura | null`; `contaDaSessao` tipa `situacao?: unknown; plano?: unknown; teste_termina_em?: unknown` e devolve `assinatura: adaptarAssinatura(eu)`; no `catch`, `assinatura: null`. Teste em `acoes.test.ts`: `/me` com `{ situacao: "teste", plano: "padrao", teste_termina_em: "2026-10-29" }` → `assinatura` preenchida; sem os campos → `null`.

- [ ] **Step 5: Rodar e ver passar; commit** — `git commit -m "feat(plano): plano e teste de 14 dias lidos do GET /me"`

### Task 11: A tela "Escolha seu plano" e o redirecionamento

**Files:**
- Create: `app/(auth)/plano/page.tsx`, `app/(auth)/plano/escolher-plano.tsx`
- Modify: `app/(auth)/acoes.ts` (nova `escolherPlano`), `app/(app)/layout.tsx`
- Test: `app/(auth)/plano/escolher-plano.test.tsx`, `app/(app)/layout.test.tsx`, `app/(auth)/acoes.test.ts`

**Interfaces:**
- Consumes: `planosDoTeste`, `PlanoId`, `contaDaSessao().assinatura`, `MolduraAuth` (`app/(auth)/_compartilhado/moldura-auth.tsx`).
- Produces: `escolherPlano(plano: PlanoId): Promise<{ ok: true } | { ok: false; erro: string }>` (`POST /empresa/plano`).

- [ ] **Step 1: Ler** `node_modules/next/dist/docs/` sobre `redirect` em layouts e Server Components (Next 16) antes de mexer no layout.

- [ ] **Step 2: Testes**

`acoes.test.ts`:

```ts
  it("escolhe o plano pelo POST /empresa/plano", async () => {
    chamarBackend.mockResolvedValueOnce({});
    await expect(escolherPlano("padrao")).resolves.toEqual({ ok: true });
    expect(chamarBackend).toHaveBeenLastCalledWith("/empresa/plano", { method: "POST", corpo: { plano: "padrao" } });
  });

  it("sem a rota no backend, diz que ainda não está disponível", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Not Found", []));
    await expect(escolherPlano("essencial")).resolves.toEqual({ ok: false, erro: "Ainda não disponível: o servidor do Ledgr ainda não tem esta função." });
  });
```

`escolher-plano.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscolherPlano } from "./escolher-plano";

const escolherPlano = vi.fn();
vi.mock("../acoes", () => ({ escolherPlano: (p: string) => escolherPlano(p) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("EscolherPlano", () => {
  it("mostra os três planos e o teste sem cartão", () => {
    render(<EscolherPlano />);
    expect(screen.getByRole("heading", { name: "Escolha seu plano." })).toBeInTheDocument();
    expect(screen.getByText(/14 dias grátis, sem cartão/)).toBeInTheDocument();
    for (const nome of ["Essencial", "Padrão", "Avançado"]) {
      expect(screen.getByRole("button", { name: `Começar com o ${nome}` })).toBeInTheDocument();
    }
  });

  it("escolher abre a Visão geral", async () => {
    escolherPlano.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EscolherPlano />);
    await user.click(screen.getByRole("button", { name: "Começar com o Padrão" }));
    expect(escolherPlano).toHaveBeenCalledWith("padrao");
    expect(push).toHaveBeenCalledWith("/visao-geral");
  });

  it("se falhar, mostra o motivo e libera os botões", async () => {
    escolherPlano.mockResolvedValue({ ok: false, erro: "Ainda não disponível: o servidor do Ledgr ainda não tem esta função." });
    const user = userEvent.setup();
    render(<EscolherPlano />);
    await user.click(screen.getByRole("button", { name: "Começar com o Essencial" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ainda não disponível");
    expect(screen.getByRole("button", { name: "Começar com o Essencial" })).toBeEnabled();
  });
});
```

`layout.test.tsx`: com `contaDaSessao` devolvendo `assinatura: { situacao: "sem_plano", plano: null, testeTerminaEm: null }`, o layout chama `redirect("/plano")`; com `assinatura: null` ou `situacao: "teste"`, renderiza o Shell.

- [ ] **Step 3: Rodar e ver falhar.**

- [ ] **Step 4: `escolherPlano` em `acoes.ts`**

```ts
/** Começa o teste de 14 dias no plano escolhido (`POST /empresa/plano`). */
export async function escolherPlano(plano: PlanoId): Promise<{ ok: true } | { ok: false; erro: string }> {
  // Server Action é endpoint público: só os três ids chegam ao backend
  if (!["essencial", "padrao", "avancado"].includes(plano)) return { ok: false, erro: FALHA_CONTA };
  try {
    await chamarBackend("/empresa/plano", { method: "POST", corpo: { plano } });
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemDaConta(erro) };
  }
}
```

(`mensagemDaConta` já traduz 404/405 em "Ainda não disponível…" e 409 no texto do backend.)

- [ ] **Step 5: `escolher-plano.tsx`** (cliente; mesmo visual do quadro "Proposta · Escolha seu plano" do canvas)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { planosDoTeste, type PlanoId } from "@/lib/assinatura";
import { escolherPlano } from "../acoes";

const PARA: Record<PlanoId, { para: string; itens: string[]; tag?: string }> = {
  essencial: { para: "Para a empresa que concilia o próprio banco.", itens: ["Conciliação banco × sistema", "Fechamento do mês com relatório em PDF", "Histórico das conciliações"] },
  padrao: { para: "Para o escritório que concilia os clientes.", itens: ["Tudo do Essencial", "Pastas de extratos, uma por cliente"], tag: "Para escritórios" },
  avancado: { para: "Para o escritório com equipe.", itens: ["Tudo do Padrão", "Convites para a equipe"] },
};

export function EscolherPlano() {
  const router = useRouter();
  const [escolhendo, setEscolhendo] = useState<PlanoId | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(plano: PlanoId) {
    setErro(null);
    setEscolhendo(plano);
    const resposta = await escolherPlano(plano).catch(() => ({ ok: false as const, erro: "Não foi possível falar com o servidor." }));
    if (resposta.ok) {
      router.push("/visao-geral");
      return;
    }
    setEscolhendo(null);
    setErro(resposta.erro);
  }

  return (
    <div className="plano-tela">
      <div className="plano-cabeca">
        <span className="eyebrow plano-eyebrow">Último passo</span>
        <h1 className="plano-titulo">Escolha seu plano.</h1>
        <p className="plano-texto">14 dias grátis, sem cartão. No fim do teste você escolhe se continua, e pode trocar de plano quando quiser.</p>
      </div>
      <div className="plano-grade">
        {planosDoTeste().map((plano) => {
          const { para, itens, tag } = PARA[plano.id];
          return (
            <article key={plano.id} className="card plano-cartao" data-destaque={tag ? "" : undefined}>
              <div className="plano-cartao-topo">
                <h2 className="plano-nome">{plano.nome}</h2>
                {tag && <span className="selo">{tag}</span>}
              </div>
              <p className="plano-para">{para}</p>
              <p className="plano-preco"><span>{plano.preco}</span> <small>/mês</small></p>
              <p className="plano-limite">{plano.limite}</p>
              <ul className="plano-itens">
                {itens.map((item) => (
                  <li key={item}><Check size={15} aria-hidden="true" />{item}</li>
                ))}
              </ul>
              <button
                type="button"
                className={tag ? "btn btn-primary" : "btn btn-secondary"}
                disabled={escolhendo !== null}
                onClick={() => void escolher(plano.id)}
              >
                {escolhendo === plano.id ? "Começando…" : `Começar com o ${plano.nome}`}
              </button>
            </article>
          );
        })}
      </div>
      {erro && <p role="alert" className="plano-erro">{erro}</p>}
      <p className="plano-volume">Mais volume? O plano Volume é sob consulta. <a className="link-animado" href="/#contato">Fale com a gente</a></p>
    </div>
  );
}
```

CSS em `globals.css`: `.plano-tela { width: 100%; max-width: 1080px; display: flex; flex-direction: column; gap: 22px; }`, `.plano-grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }` (uma coluna abaixo de 900 px), `.plano-cartao { background: var(--color-bg); display: flex; flex-direction: column; gap: 14px; padding: 24px; }`, `.plano-cartao[data-destaque] { border-color: var(--color-text); }`, `.plano-para { min-height: 3.1em; }`, `.plano-preco span { font-family: var(--font-titulo); font-size: 34px; }`, `.plano-itens li { display: flex; gap: 9px; }` com o ícone em `var(--color-ok-700)`, `.plano-cartao .btn { margin-top: auto; }`, `.plano-erro { color: var(--color-erro); }`.

- [ ] **Step 6: `app/(auth)/plano/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { contaDaSessao } from "../acoes";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { EscolherPlano } from "./escolher-plano";

/** A escolha do plano que começa o teste de 14 dias. Só para quem está logado e ainda não escolheu. */
export default async function PlanoPage() {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");
  const { assinatura } = await contaDaSessao();
  if (assinatura && assinatura.situacao !== "sem_plano") redirect("/visao-geral");
  return (
    <MolduraAuth rotulo="Plano" larguraConteudo={1080}>
      <EscolherPlano />
    </MolduraAuth>
  );
}
```

`layout.tsx` de `(app)`, depois de `contaDaSessao()`: `if (conta.assinatura?.situacao === "sem_plano") redirect("/plano");`.

- [ ] **Step 7: Rodar e ver passar; `npm run build`** (conferir `/plano` na tabela de rotas). **Commit** — `git commit -m "feat(plano): escolha do plano que começa o teste de 14 dias"`

### Task 12: O teste na barra do topo e o bloqueio da nova conciliação

**Files:**
- Modify: `app/(app)/conta.tsx` (assinatura no contexto), `app/(app)/shell.tsx`, `app/(app)/layout.tsx`, `app/(app)/barra-superior.tsx`, `app/(app)/conciliacoes/nova/page.tsx`
- Create: `app/(app)/conciliacoes/nova/planos-bloqueados.tsx`
- Test: `app/(app)/barra-superior.test.tsx`, `app/(app)/conciliacoes/nova/page.test.tsx`

**Interfaces:**
- Consumes: `Assinatura`, `diasRestantes`, `fraseDoTeste`, `planosDoTeste`.
- Produces: `ProvedorDaConta` aceita `assinatura: Assinatura | null`; `useAssinatura(): Assinatura | null`.

- [ ] **Step 1: Testes**

`barra-superior.test.tsx` (renderizando dentro de `<ProvedorDaConta preferencias={null} assinatura={…}>`; fixar a data com `vi.setSystemTime(new Date("2026-10-20T12:00:00-03:00"))`):

```tsx
  it("no teste, mostra quantos dias faltam com link para a Assinatura", () => {
    montarBarra({ situacao: "teste", plano: "padrao", testeTerminaEm: "2026-10-29" });
    expect(screen.getByRole("link", { name: "Teste grátis · faltam 9 dias" })).toHaveAttribute("href", "/assinatura");
  });

  it("teste acabado: aviso em tom de risco que leva aos planos", () => {
    montarBarra({ situacao: "teste_encerrado", plano: "padrao", testeTerminaEm: "2026-10-15" });
    expect(screen.getByRole("link", { name: "Seu teste acabou · escolher um plano" })).toHaveClass("selo-risco");
  });

  it("sem assinatura ou ativo, não mostra nada", () => {
    montarBarra(null);
    expect(screen.queryByText(/Teste grátis|Seu teste acabou/)).not.toBeInTheDocument();
  });
```

`nova/page.test.tsx`:

```tsx
  it("teste acabado: mostra os planos no lugar do envio", () => {
    montarNova({ situacao: "teste_encerrado", plano: "essencial", testeTerminaEm: "2026-10-01" });
    expect(screen.getByRole("heading", { name: "Seu teste de 14 dias acabou." })).toBeInTheDocument();
    expect(screen.queryByLabelText("Extrato do banco")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver minhas conciliações" })).toHaveAttribute("href", "/dashboard");
  });

  it("o backend recusou com 402: mostra os planos com o texto dele", async () => {
    conciliar.mockResolvedValue({ ok: false, status: 402, erro: "O teste acabou. Escolha um plano para conciliar." });
    // … mesmo caminho do teste que já envia os dois arquivos e clica em "Conciliar extratos" …
    expect(await screen.findByRole("heading", { name: "Seu teste de 14 dias acabou." })).toBeInTheDocument();
    expect(screen.getByText("O teste acabou. Escolha um plano para conciliar.")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Assinatura no contexto**

Em `conta.tsx`: `ProvedorDaConta({ preferencias, assinatura = null, children })`, um segundo contexto `ContextoDaAssinatura = createContext<Assinatura | null>(null)` em volta dos filhos, e `export function useAssinatura() { return useContext(ContextoDaAssinatura); }`. `Shell` ganha a prop `assinatura` e repassa; o `layout.tsx` passa `assinatura={conta.assinatura}`.

- [ ] **Step 4: A barra do topo**

Em `barra-superior.tsx`, antes do botão "?":

```tsx
  const assinatura = useAssinatura();
  …
      {assinatura?.situacao === "teste" && assinatura.testeTerminaEm && (
        <Link href="/assinatura" className="selo app-teste">
          {fraseDoTeste(diasRestantes(assinatura.testeTerminaEm, new Date()))}
        </Link>
      )}
      {assinatura?.situacao === "teste_encerrado" && (
        <Link href="/plano" className="selo selo-risco app-teste">Seu teste acabou · escolher um plano</Link>
      )}
```

CSS: `.app-teste { text-decoration: none; white-space: nowrap; font-size: 13.5px; padding: 6px 12px; flex: none; }` e, abaixo de 640 px, `.app-teste { display: none; }` (no celular o aviso vai para o menu da conta numa próxima rodada, se preciso).

O link do teste acabado vai para `/plano`, mas a página `/plano` manda quem não está `sem_plano` para a Visão geral. Trocar a condição da página para `if (assinatura && !["sem_plano", "teste_encerrado"].includes(assinatura.situacao)) redirect("/visao-geral");` e, na `EscolherPlano`, o texto do botão para quem está em `teste_encerrado` fica "Assinar o {nome}" (prop `encerrado?: boolean`, com teste). A assinatura paga de verdade depende do gateway; até lá a rota do backend decide o que aceita.

- [ ] **Step 5: O bloqueio da nova conciliação**

`planos-bloqueados.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { planosDoTeste } from "@/lib/assinatura";

/** No lugar do envio, quando o teste acabou (pelo /me ou pelo 402 do backend). O resto do app segue aberto. */
export function PlanosBloqueados({ motivo }: { motivo?: string }) {
  return (
    <section className="card bloqueio" aria-labelledby="bloqueio-titulo">
      <Image src="/mascotes/mascote-cadeado.png" alt="" width={150} height={150} className="bloqueio-mascote" />
      <div className="bloqueio-corpo">
        <h2 id="bloqueio-titulo" className="bloqueio-titulo">Seu teste de 14 dias acabou.</h2>
        <p>{motivo ?? "Para fazer novas conciliações, escolha um plano. O que você já fez continua aqui: conciliações, extratos, histórico e fechamentos."}</p>
        <ul className="bloqueio-planos">
          {planosDoTeste().map((plano) => (
            <li key={plano.id} className="card">
              <strong>{plano.nome}</strong>
              <span>{plano.preco} /mês · {plano.limite}</span>
              <Link href="/plano" className="btn btn-secondary">{`Assinar o ${plano.nome}`}</Link>
            </li>
          ))}
        </ul>
        <Link href="/dashboard" className="btn btn-ghost">Ver minhas conciliações</Link>
      </div>
    </section>
  );
}
```

CSS: `.bloqueio { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 28px; padding: 30px 32px; }`, `.bloqueio-planos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }` (uma coluna abaixo de 900 px), `.bloqueio-planos li { display: flex; flex-direction: column; gap: 8px; padding: 18px; }`.

Em `nova/page.tsx`: `const assinatura = useAssinatura();` e `const [recusa, setRecusa] = useState<string | null>(null);`. Onde o resultado de `conciliar(...)` é tratado, antes do tratamento de erro genérico: `if (!resultado.ok && resultado.status === 402) { setRecusa(resultado.erro); return; }`. Na renderização, se `assinatura?.situacao === "teste_encerrado" || recusa !== null`, renderizar `<PlanosBloqueados motivo={recusa ?? undefined} />` no lugar de `.nova-corpo` e não renderizar o botão "Conciliar extratos".

- [ ] **Step 6: Rodar, verificar e abrir o PR D**

```bash
npm run test && npm run lint && npm run build
git add -A "app/(app)" "app/(auth)" lib app/globals.css
git commit -m "feat(plano): dias de teste no topo e planos no lugar da nova conciliação quando o teste acaba"
git push -u origin feat/plano-teste
gh pr create --base develop --title "Primeiro uso, parte D: plano e teste de 14 dias" --body "Parte 2 de docs/superpowers/specs/2026-10-15-primeiro-uso-design.md. Liga sozinho quando o GET /me mandar situacao; sem o campo, nada muda em produção."
```

---

## Depois das quatro entregas

- Atualizar a especificação: o item 4 do pedido ao backend (tolerância revisada) caiu, porque `atualizado_em` de `/empresa/configuracoes` já diz isso.
- Atualizar o `CLAUDE.md` (seção "Backend status"): onboarding, preferências e assinatura, com o que é real e o que espera o backend.
