# Cadastro: ajustes do teste manual de 28/09 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver os apontamentos do cadastro que o front resolve sozinho: o rótulo "Seu nome", o aviso de outros bancos no passo II e a tela "Criando sua conta…" depois de concluir. (O olho da senha, tarefa 1, chegou a ser cancelado e foi retomado no mesmo dia.)

**Architecture:** Tudo fica em `app/(auth)`. Os textos moram em `app/(auth)/cadastro/passos.ts`. A tela de transição é um componente novo, `criando-conta.tsx`, que a página do cadastro mostra no lugar do formulário enquanto `concluindo` é verdadeiro.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest + Testing Library (jsdom), CSS em `app/globals.css`.

**Spec:** [docs/superpowers/specs/2026-09-28-teste-manual-28-09-design.md](../specs/2026-09-28-teste-manual-28-09-design.md) (decisões 1 a 4)

**Branch:** `feature/cadastro-teste-manual`, a partir do `develop`, num worktree em `.worktrees/cadastro-teste-manual`. PR para o `develop`.

## Global Constraints

- Textos em pt-BR, sem travessão (—) no meio de frase (decisão 6 da spec).
- Nenhuma promessa do que o produto não faz: nada de "nas configurações", nada de PDF (decisões 3 e 7).
- Antes de cada commit: `npm run test && npm run lint && npm run build` (CLAUDE.md).
- Estilo novo vai para `app/globals.css`, com os tokens de lá (`--color-accent`, `--color-divider`, `--color-accent-700`); nada de utilitário Tailwind novo.
- Toda animação nova tem versão parada em `@media (prefers-reduced-motion: reduce)`.
- Os testes seguem o estilo do arquivo: `describe`/`it` em inglês, textos da tela em português.

## Review Focus

1. **O servidor recusa depois do "Criando sua conta…"**: o formulário volta, o erro aparece no campo certo e o foco vai para ele (e-mail no passo de acesso, CNPJ no da empresa); no erro geral, o foco vai para o botão "Concluir", não para o `<body>`. Teste na tarefa 3.
2. **Enter duas vezes no último passo**: uma conta só, uma chamada a `cadastrar`. Teste na tarefa 3.
3. **Leitor de tela na troca para o painel**: o foco vai para o título do painel, e a troca de "Criando sua conta…" para "Conta criada." é anunciada (`role="status"`). Teste na tarefa 3.
4. **Voltar ao passo depois do erro**: o "Voltar" e o que foi digitado nos passos anteriores continuam lá quando o formulário volta do painel (o estado `valores` não é do `<form>`, é da página). Coberto pelos testes de e-mail e CNPJ já cadastrados, que conferem os valores do passo.
5. **Movimento reduzido**: a barra de progresso do painel fica parada. O jsdom não calcula CSS, então é conferido à mão no passo de verificação da tarefa 3.

---

### Task 1: O olho mostra o estado da senha

Retomada em 28/09, depois das tarefas 2 e 3 (decisão 1 da spec).

**Files:**
- Modify: `app/(auth)/_compartilhado/campo-texto.tsx` (`<OlhoMascote fechado={!verSenha} />`)
- Modify: `app/(auth)/_compartilhado/olho-mascote.tsx` (comentário)
- Test: `app/(auth)/login/page.test.tsx` e `app/(auth)/cadastro/page.test.tsx` (o `data-estado` do SVG do olho)

- [x] Testes primeiro: no login e no cadastro, o olho começa `fechado`, vira `aberto` em "Mostrar senha" e volta a `fechado` em "Ocultar senha" (falharam com "aberto" recebido)
- [x] `fechado={!verSenha}` no `CampoTexto`; o rótulo continua dizendo a ação
- [x] `npx vitest run "app/(auth)"` verde; na tela, o cadastro abre com o olho fechado e "Mostrar senha"

---

### Task 2: "Seu nome" e o aviso de outros bancos

**Files:**
- Modify: `app/(auth)/cadastro/passos.ts:92` e `:153`
- Test: `app/(auth)/cadastro/page.test.tsx` (linhas 31, 53, 97, 265 e o teste `"walks through the company, bank and management-system steps from the Claude Design"`)

**Interfaces:**
- Consumes: nada.
- Produces: o rótulo `"Seu nome"` do campo `nome`, que a tarefa 3 usa nos testes através da constante `ACESSO`.

- [ ] **Step 1: Atualizar os testes para o rótulo novo**

Em `app/(auth)/cadastro/page.test.tsx`, troque `"Nome completo"` por `"Seu nome"` nas quatro ocorrências (linhas 31, 53, 97 e 265). A linha 31 fica:

```tsx
const ACESSO = { "Seu nome": "Ana Souza", "E-mail": "financeiro@telhacerta.com.br", Senha: "conciliar2026" };
```

- [ ] **Step 2: Pedir o aviso de outros bancos no passo II**

No mesmo arquivo, no teste `"walks through the company, bank and management-system steps from the Claude Design"`, logo depois de `expect(screen.getByText("Passo II de III")).toBeInTheDocument();`, acrescente:

```tsx
    expect(
      screen.getByText(/Tem mais de um banco\? Comece por um\. Os outros entram depois, cada um na sua conciliação\./),
    ).toBeInTheDocument();
    // não existe tela de bancos nas configurações: o texto não pode mandar a pessoa para lá
    expect(screen.queryByText(/configurações/i)).not.toBeInTheDocument();
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run "app/(auth)/cadastro/page.test.tsx"`
Expected: FAIL com `Unable to find a label with the text of: Seu nome` e, no teste dos passos, `Unable to find an element with the text: /Tem mais de um banco.../`.

- [ ] **Step 4: Mudar os textos em `passos.ts`**

Em `app/(auth)/cadastro/passos.ts`, a linha 92 fica:

```ts
      { id: "nome", rotulo: "Seu nome", tipo: "text", autoComplete: "name", autoCapitalize: "words", mensagemVazio: "Informe seu nome." },
```

E o `texto` do passo `banco` (linha 153) fica:

```ts
    texto:
      "Informe o banco e a conta de onde sai o extrato: é ele que define a verdade da conciliação. Tem mais de um banco? Comece por um. Os outros entram depois, cada um na sua conciliação.",
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run "app/(auth)/cadastro/page.test.tsx"`
Expected: PASS.

- [ ] **Step 6: Conferir na tela**

Run: `npm run dev` e abra `http://localhost:3000/cadastro`.
Expected: o primeiro campo diz "Seu nome". No passo II, o parágrafo tem três frases e cabe acima dos campos sem empurrar o botão para fora da tela num notebook de 768 px de altura.

- [ ] **Step 7: Commit**

```bash
npm run test && npm run lint && npm run build
git add "app/(auth)/cadastro/passos.ts" "app/(auth)/cadastro/page.test.tsx"
git commit -m "fix: cadastro pede \"Seu nome\" e avisa que os outros bancos entram depois"
```

---

### Task 3: A tela "Criando sua conta…"

**Files:**
- Create: `app/(auth)/cadastro/criando-conta.tsx`
- Modify: `app/(auth)/cadastro/page.tsx` (imports, estado, `concluir`, `avancar`, o JSX do formulário e dos botões)
- Modify: `app/globals.css` (bloco novo logo depois das regras `.cadastro-*`, perto da linha 520)
- Test: `app/(auth)/cadastro/page.test.tsx`

**Interfaces:**
- Consumes: a constante `ACESSO` com `"Seu nome"` (tarefa 2). Se a tarefa 2 ainda não entrou, os testes abaixo funcionam igual com `"Nome completo"`.
- Produces:
  - `export type FaseCriacao = "criando" | "abrindo" | "login";`
  - `export function CriandoConta({ fase, empresa }: { fase: FaseCriacao; empresa: string }): JSX.Element`, que renderiza um `<div role="status">` com um `<h1 tabIndex={-1}>` e recebe o foco ao montar.

- [ ] **Step 1: Escrever os testes do painel**

Em `app/(auth)/cadastro/page.test.tsx`, dentro do `describe("CadastroPage")`, logo depois da função `concluirCadastro`, acrescente:

```tsx
  it("swaps the form for a status panel while the account is being created", async () => {
    cadastrar.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Criando sua conta…");
    expect(status).toHaveTextContent("Cadastrando a empresa Telha Certa Ltda e o seu acesso.");
    expect(titulo()).toHaveTextContent("Criando sua conta…");
    await waitFor(() => expect(titulo()).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Concluir e subir extratos" })).not.toBeInTheDocument();
  });

  it("says the account was created while it opens the first conciliation", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/conciliacoes/nova"));
    expect(screen.getByRole("status")).toHaveTextContent("Conta criada.");
    expect(screen.getByRole("status")).toHaveTextContent("Abrindo sua primeira conciliação…");
  });

  it("says the account was created when it sends to the login", async () => {
    cadastrar.mockResolvedValue({ ok: true, entrou: false });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await concluirCadastro(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(screen.getByRole("status")).toHaveTextContent("Conta criada.");
    expect(screen.getByRole("status")).toHaveTextContent("Agora é só entrar com o seu e-mail e a senha.");
  });

  it("creates the account only once when the last step is sent twice", async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await preencher(user, ACESSO);
    await continuar(user);
    await preencher(user, EMPRESA);
    await continuar(user);
    await preencher(user, BANCO);
    await continuar(user);
    await user.type(screen.getByLabelText("Sistema de gestão"), "Cigam");

    await user.keyboard("{Enter}{Enter}");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/conciliacoes/nova"));
    expect(cadastrar).toHaveBeenCalledTimes(1);
  });
```

E no teste que já existe, `"recovers the form when the server can't be reached"`, acrescente no fim:

```tsx
    // o formulário foi recriado: o foco volta ao botão, e não ao <body> (num efeito: waitFor, como os vizinhos)
    await waitFor(() => expect(screen.getByRole("button", { name: "Concluir e subir extratos" })).toHaveFocus());
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "app/(auth)/cadastro/page.test.tsx"`
Expected: FAIL nos quatro testes novos (`Unable to find role="status"`) e no `"recovers the form..."` (o botão não tem o foco). Os outros continuam passando.

- [ ] **Step 3: Criar o componente do painel**

Crie `app/(auth)/cadastro/criando-conta.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

export type FaseCriacao = "criando" | "abrindo" | "login";

// cada fase é um fato: o servidor está criando, ou já criou e a pessoa está indo para
// algum lugar. Nada de etapa inventada para encher a espera.
const TEXTOS: Record<FaseCriacao, { titulo: string; texto: (empresa: string) => string }> = {
  criando: {
    titulo: "Criando sua conta…",
    texto: (empresa) => `Cadastrando a empresa ${empresa} e o seu acesso.`,
  },
  abrindo: {
    titulo: "Conta criada.",
    texto: () => "Abrindo sua primeira conciliação…",
  },
  login: {
    titulo: "Conta criada.",
    texto: () => "Agora é só entrar com o seu e-mail e a senha.",
  },
};

/**
 * O que fica no lugar do formulário entre o "Concluir" e a próxima tela. O
 * formulário some com o foco dentro, então o título do painel recebe o foco; a
 * troca de fase é anunciada pelo role="status".
 */
export function CriandoConta({ fase, empresa }: { fase: FaseCriacao; empresa: string }) {
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  const { titulo: textoTitulo, texto } = TEXTOS[fase];

  return (
    <div className="cadastro-criando" role="status">
      <span className="eyebrow cadastro-criando-eyebrow">Quase lá</span>
      <h1 ref={titulo} tabIndex={-1} className="cadastro-criando-titulo">
        {textoTitulo}
      </h1>
      <p className="cadastro-criando-texto">{texto(empresa)}</p>
      <div className="cadastro-criando-barra" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ligar o painel na página do cadastro**

Em `app/(auth)/cadastro/page.tsx`:

1. Nos imports, logo depois de `import { PASSOS, SENHA_MINIMA, type CampoCadastro } from "./passos";`:

```tsx
import { CriandoConta, type FaseCriacao } from "./criando-conta";
```

2. O comentário da linha 15 fica:

```tsx
// mesma pausa do login: dá tempo de ler "Criando sua conta…" antes de trocar de tela
```

3. Logo depois de `const [concluindo, setConcluindo] = useState(false);`:

```tsx
  const [fase, setFase] = useState<FaseCriacao>("criando");
  const botaoEnviar = useRef<HTMLButtonElement>(null);
```

4. Logo depois do `useEffect` que foca o título a cada troca de passo (o que termina em `}, [indicePasso]);`):

```tsx
  // o erro geral não aponta campo: com o formulário recriado, o foco volta ao botão
  useEffect(() => {
    if (erroGeral) botaoEnviar.current?.focus();
  }, [erroGeral]);
```

5. Em `concluir`, o bloco `if (resultado.ok)` fica:

```tsx
    if (resultado.ok) {
      setFase(resultado.entrou ? "abrindo" : "login");
      // conta criada sem sessão (o login deu 429 logo depois do cadastro): falta só entrar
      router.push(resultado.entrou ? "/conciliacoes/nova" : "/login");
      return;
    }
```

6. Em `avancar`, o bloco `if (ultimoPasso)` fica:

```tsx
    if (ultimoPasso) {
      setFase("criando");
      setConcluindo(true);
      timer.current = setTimeout(concluir, ATRASO_CONCLUSAO_MS);
      return;
    }
```

7. No JSX, o `<form className="login-form" ...>` passa a ser alternativa do painel. Troque a abertura

```tsx
      <form className="login-form" onSubmit={enviar} noValidate style={{ width: "100%", maxWidth: 424 }}>
```

por

```tsx
      {concluindo ? (
        <CriandoConta fase={fase} empresa={(valores.razaoSocial ?? "").trim()} />
      ) : (
      <form className="login-form" onSubmit={enviar} noValidate style={{ width: "100%", maxWidth: 424 }}>
```

e o fechamento `</form>` (logo antes do comentário `{/* o mascote acompanha o cadastro pela lateral direita...`) por

```tsx
      </form>
      )}
```

O conteúdo do `<form>` fica como está, exceto os botões do item 8.

8. Com o formulário fora da tela durante a conclusão, o "Concluindo…" e os `disabled={concluindo}` dos botões deixam de ter efeito. O bloco `cadastro-acoes` fica:

```tsx
        <div className="cadastro-acoes" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "clamp(16px, 2.6vh, 24px)" }}>
          {indicePasso > 0 && (
            <button type="button" className="btn btn-ghost" onClick={voltar}>
              Voltar
            </button>
          )}
          <button
            ref={botaoEnviar}
            type="submit"
            className="btn btn-primary"
            style={{ flex: 1, fontSize: 15.5, padding: "clamp(10px, 1.6vh, 13px) 22px" }}
          >
            {passo.botao}
          </button>
        </div>
```

O `if (concluindo) return;` no começo de `avancar` fica: é ele que segura um segundo envio no mesmo instante.

- [ ] **Step 5: Estilo do painel**

Em `app/globals.css`, logo depois do `@media (max-height: 700px) and (max-width: 480px)` que fecha as regras `.cadastro-*` (perto da linha 520), acrescente:

```css
/* "Criando sua conta…": ocupa o lugar do formulário, com a mesma largura e o mesmo título dos passos;
   a barra repete o traço de 3px da trilha de etapas, correndo enquanto o servidor trabalha */
.cadastro-criando { width: 100%; max-width: 424px; }
.cadastro-criando-eyebrow {
  display: block; margin-bottom: clamp(10px, 2vh, 20px);
  font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700);
}
.cadastro-criando-titulo {
  margin: 0 0 clamp(8px, 1.5vh, 14px);
  font-size: clamp(28px, 3.4vw, 38px); font-weight: 400; line-height: 1.12; letter-spacing: -0.016em;
  outline: none;
}
.cadastro-criando-texto {
  margin: 0; font-size: 15px; line-height: 1.65;
  color: color-mix(in srgb, var(--color-text) 72%, transparent);
}
.cadastro-criando-barra {
  position: relative; overflow: hidden; height: 3px; margin-top: clamp(16px, 2.6vh, 24px);
  border-radius: 999px; background: var(--color-divider);
}
.cadastro-criando-barra span {
  position: absolute; top: 0; bottom: 0; left: 0; width: 40%;
  border-radius: inherit; background: var(--color-accent);
  animation: cadastro-criando-corre 1.2s ease-in-out infinite;
}
@keyframes cadastro-criando-corre {
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
}
@media (prefers-reduced-motion: reduce) {
  .cadastro-criando-barra span { width: 100%; opacity: 0.5; animation: none; }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run "app/(auth)/cadastro/page.test.tsx"`
Expected: PASS em todos, inclusive `"goes back to the access step when the e-mail already has an account"` e `"goes back to the company step when the CNPJ already has an account"`, que conferem o foco no campo depois de o formulário voltar.

- [ ] **Step 7: Conferir na tela, sem criar conta**

Run: `npm run dev` e abra `http://localhost:3000/cadastro`. Preencha com o e-mail da conta de teste do backend (que já existe) e siga até "Concluir e subir extratos".
Expected: o formulário dá lugar ao painel "Quase lá / Criando sua conta… / Cadastrando a empresa …", com a barra dourada correndo e o mascote comemorando ao lado; depois volta ao passo de acesso com "Já existe conta com este e-mail. Entre pela tela de login." no campo, com o foco nele.
Depois, no DevTools, em Rendering, ligue "Emulate CSS media feature prefers-reduced-motion: reduce" e repita: a barra aparece cheia e parada.

- [ ] **Step 8: Commit**

```bash
npm run test && npm run lint && npm run build
git add "app/(auth)/cadastro/criando-conta.tsx" "app/(auth)/cadastro/page.tsx" "app/(auth)/cadastro/page.test.tsx" app/globals.css
git commit -m "feat: tela \"Criando sua conta…\" entre o fim do cadastro e a primeira conciliação"
```
