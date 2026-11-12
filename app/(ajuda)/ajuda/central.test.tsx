import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CentralDeAjuda } from "./central";
import { PAGINAS, ajudaDaTela, paginaDeAjuda } from "./paginas";
import { TELAS_DO_TUTORIAL } from "@/lib/preferencias";
import PaginaDaAjuda from "./[pagina]/page";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  redirect: vi.fn(),
}));

describe("CentralDeAjuda", () => {
  it("mostra a tela: título, para que serve, cada funcionalidade com o como fazer", () => {
    render(<CentralDeAjuda id="fechamentos" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Fechamentos" }),
    ).toBeInTheDocument();

    const funcoes = screen
      .getAllByRole("heading", { level: 2 })
      .map((titulo) => titulo.textContent);
    expect(funcoes).toEqual(
      PAGINAS.find((p) => p.id === "fechamentos")!.funcoes.map((f) => f.titulo),
    );

    const fechar = screen.getByRole("region", { name: "Fechar o mês" });
    expect(within(fechar).getByText("Como fazer")).toBeInTheDocument();
    // o **negrito** vira <b>, o nome do botão como aparece na tela
    expect(within(fechar).getByText("Fechar mesmo assim").tagName).toBe("B");
  });

  it('"Nesta página" lista as funcionalidades com a âncora de cada uma', () => {
    render(<CentralDeAjuda id="comparacao" />);
    const indice = screen.getByRole("complementary", { name: "Nesta página" });
    const links = within(indice).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "#resumo");
    // uma seção por vez é a atual
    expect(links.filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
    for (const link of links) {
      expect(document.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    }
  });

  it("anterior e próxima seguem a ordem das telas", () => {
    // as páginas em destaque ficam fora da sequência das telas
    const TELAS = PAGINAS.filter((pagina) => !pagina.destaque);
    const { rerender } = render(<CentralDeAjuda id={TELAS[0].id} />);
    expect(screen.queryByRole("link", { name: /Anterior/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Próxima/ })).toHaveAttribute(
      "href",
      `/ajuda/${TELAS[1].id}`,
    );
    rerender(<CentralDeAjuda id={TELAS.at(-1)!.id} />);
    expect(screen.getByRole("link", { name: /Anterior/ })).toHaveAttribute(
      "href",
      `/ajuda/${TELAS.at(-2)!.id}`,
    );
    expect(screen.queryByRole("link", { name: /Próxima/ })).not.toBeInTheDocument();
  });

  it("a tela aberta fica marcada na lista das telas", () => {
    render(<CentralDeAjuda id="extratos" />);
    const telas = screen.getByRole("navigation", { name: "Telas do Ledgr" });
    expect(within(telas).getAllByRole("link")).toHaveLength(PAGINAS.length);
    expect(within(telas).getByRole("link", { name: "Extratos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("sem vídeo, a capa diz que ele vem e lista os capítulos", () => {
    render(<CentralDeAjuda id="assinatura" />);
    expect(screen.getByText("Vídeo desta tela em breve")).toBeInTheDocument();
    expect(document.querySelector("video")).toBeNull();
    const capitulos = screen.getByRole("list", { name: "Capítulos do vídeo" });
    expect(within(capitulos).getAllByRole("listitem")).toHaveLength(
      PAGINAS.find((p) => p.id === "assinatura")!.funcoes.length,
    );
  });

  it("clicar numa imagem a abre grande, e Fechar fecha", async () => {
    const user = userEvent.setup();
    render(<CentralDeAjuda id="extratos" />);
    await user.click(screen.getByRole("button", { name: /Ampliar a imagem de O painel do arquivo/ }));
    const janela = screen.getByRole("dialog", { hidden: true });
    expect(janela).toHaveAttribute("aria-label", "O painel do arquivo");
    await user.click(within(janela).getByRole("button", { name: "Fechar", hidden: true }));
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
  });
});

describe("a rota /ajuda/[pagina]", () => {
  it("dá 404 para uma página que não existe", async () => {
    await expect(
      PaginaDaAjuda({
        params: Promise.resolve({ pagina: "nao-existe" }),
      } as PageProps<"/ajuda/[pagina]">),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("o conteúdo da ajuda", () => {
  it("ids únicos, e toda funcionalidade tem o que faz", () => {
    const ids = PAGINAS.map((pagina) => pagina.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pagina of PAGINAS) {
      expect(pagina.funcoes.length).toBeGreaterThan(0);
      const funcoes = pagina.funcoes.map((f) => f.id);
      expect(new Set(funcoes).size).toBe(funcoes.length);
      for (const funcao of pagina.funcoes) expect(funcao.faz).not.toBe("");
    }
  });

  it("a Central tem a página Empresas logo depois do Histórico, e as Configurações não falam mais de empresas", () => {
    const ids = PAGINAS.map((pagina) => pagina.id);
    expect(ids.indexOf("empresas")).toBe(ids.indexOf("historico") + 1);
    expect(ids.indexOf("configuracoes")).toBe(ids.indexOf("empresas") + 1);

    const empresas = PAGINAS.find((pagina) => pagina.id === "empresas")!;
    expect(empresas.titulo).toBe("Empresas");
    expect(empresas.onde).toBe("Menu lateral › Empresas");
    expect(existsSync(join("public", empresas.capa.src)), empresas.capa.src).toBe(true);
    expect(empresas.funcoes.map((funcao) => funcao.id)).toEqual(["lista", "abrir", "cadastrar", "limite", "equipe"]);
    const cadastrar = empresas.funcoes.find((funcao) => funcao.id === "cadastrar")!;
    for (const botao of ["**Adicionar empresa**", "**Cadastrar empresa**"]) {
      expect(cadastrar.passos?.join(" "), botao).toContain(botao);
    }
    expect(empresas.funcoes.find((funcao) => funcao.id === "limite")!.passos?.join(" ")).toContain("**Assinatura**");

    // a equipe mudou das Configurações para a aba Equipe desta página
    const equipe = empresas.funcoes.find((funcao) => funcao.id === "equipe")!;
    const passosDaEquipe = equipe.passos?.join(" ") ?? "";
    for (const botao of ["**Equipe**", "**Convidar pessoa**", "**Remover**"]) {
      expect(passosDaEquipe, botao).toContain(botao);
    }
    // o papel editável e a transferência da administração (parte C do #169)
    expect(passosDaEquipe).toContain("**Gestor**");
    expect(passosDaEquipe).toContain("**Analista**");
    expect(passosDaEquipe).toContain("**Tornar administrador**");
    expect(passosDaEquipe).toMatch(/senha atual/);
    expect(passosDaEquipe).toMatch(/você vira \*\*Gestor\*\*/);
    expect(equipe.nota).toMatch(/Só o administrador troca papéis e passa a administração/);
    expect(equipe.figura).toBeDefined();

    const configuracoes = PAGINAS.find((pagina) => pagina.id === "configuracoes")!;
    expect(configuracoes.funcoes.some((funcao) => funcao.id === "empresas" || funcao.id === "equipe")).toBe(false);
    expect(configuracoes.funcoes.find((funcao) => funcao.id === "abrir")!.faz).toContain("Conta, Aparência");
    expect(configuracoes.funcoes.find((funcao) => funcao.id === "abrir")!.faz).not.toContain("Equipe");
    expect(configuracoes.serve).not.toMatch(/empresas|equipe/);
    expect(existsSync(join("public", "ajuda", "configuracoes--equipe.webp"))).toBe(false);
  });

  it("toda capa existe em public/", () => {
    for (const pagina of PAGINAS) expect(existsSync(join("public", pagina.capa.src)), pagina.capa.src).toBe(true);
  });

  it("toda tela com tutorial tem a sua página", () => {
    for (const tela of TELAS_DO_TUTORIAL) expect(ajudaDaTela(tela), tela).toBeDefined();
    expect(ajudaDaTela("divergencia")?.id).toBe("detalhe-da-linha");
    expect(ajudaDaTela(null)).toBeUndefined();
  });
});

describe("a página Nova conciliação ensina a exportar e a importar via IA", () => {
  const funcoes = PAGINAS.find((pagina) => pagina.id === "nova-conciliacao")!.funcoes;

  it("traz a exportação do banco e do sistema e a importação via IA, depois do envio", () => {
    const ids = funcoes.map((funcao) => funcao.id);
    expect(ids.slice(ids.indexOf("enviar"), ids.indexOf("enviar") + 4)).toEqual([
      "enviar",
      "exportar-banco",
      "exportar-sistema",
      "importar-via-ia",
    ]);
  });

  it("a importação termina em enviar o banco, e o PDF aponta para ela", () => {
    const via = funcoes.find((funcao) => funcao.id === "importar-via-ia")!;
    expect(via.passos!.join(" ")).toMatch(/Confirmar.*extrato do banco/);
    expect(funcoes.find((funcao) => funcao.id === "enviar")!.nota).toContain("Importar via IA");
  });
});

describe("a página Conectar o ChatGPT ou o Claude", () => {
  it("a conexão com IA tem a sua página em destaque, com uma aba por IA", () => {
    const pagina = paginaDeAjuda("conectar-ia")!;
    expect(pagina.destaque).toBe(true);
    expect(pagina.video).toBe("conexao-ia");
    expect(pagina.funcoes.map((f) => f.id)).toEqual(["antes", "passo-a-passo", "perguntar", "problemas"]);
    const abas = pagina.funcoes[1].abas!;
    expect(abas.map((a) => [a.id, a.passos.length])).toEqual([["chatgpt", 5], ["claude", 5], ["claude-code", 4]]);
    expect(abas.flatMap((a) => a.passos).every((p) => p.certo.length > 0)).toBe(true);
    expect(abas[2].passos[0].comando).toBe(true);
    expect(pagina.funcoes[0].itens).toHaveLength(3);
    expect(pagina.funcoes[3].sanfona).toBe(true);
    // cada problema é "Pergunta: resposta", dividido no primeiro ": "
    expect(pagina.funcoes[3].passos!.length).toBeGreaterThanOrEqual(6);
    for (const passo of pagina.funcoes[3].passos!) expect(passo).toMatch(/^[^:]+: \S/);
  });

  it("Configurações resume a conexão e aponta para a página nova", () => {
    const config = paginaDeAjuda("configuracoes")!;
    const ids = config.funcoes.map((f) => f.id);
    expect(ids).not.toContain("conexoes-problemas");
    expect(ids).not.toContain("conexoes-perguntas");
    expect(config.funcoes.find((f) => f.id === "conexoes")!.link!.href).toBe("/ajuda/conectar-ia");
  });

  it("a página em destaque fica num grupo próprio e sem anterior e próxima", () => {
    render(<CentralDeAjuda id="conectar-ia" endereco="https://api.x/mcp" />);
    const telas = screen.getByRole("navigation", { name: "Telas do Ledgr" });
    expect(within(telas).getByText("Destaque")).toBeInTheDocument();
    expect(within(telas).getByRole("link", { name: "Conectar o ChatGPT ou o Claude" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: /Anterior/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Próxima/ })).not.toBeInTheDocument();
  });

  it("as abas trocam com as setas e mostram o comando com o endereço no Claude Code", async () => {
    const user = userEvent.setup();
    render(<CentralDeAjuda id="conectar-ia" endereco="https://api.x/mcp" />);
    const chatgpt = screen.getByRole("tab", { name: "ChatGPT" });
    expect(chatgpt).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", chatgpt.id);
    chatgpt.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    const code = screen.getByRole("tab", { name: "Claude Code" });
    expect(code).toHaveAttribute("aria-selected", "true");
    expect(code).toHaveFocus();
    expect(screen.getByText("claude mcp add --transport http ledgr https://api.x/mcp")).toBeInTheDocument();
    await user.keyboard("{Home}");
    expect(chatgpt).toHaveAttribute("aria-selected", "true");
  });

  it("sem endereço, o comando mostra onde achar o endereço", async () => {
    const user = userEvent.setup();
    render(<CentralDeAjuda id="conectar-ia" endereco={null} />);
    await user.click(screen.getByRole("tab", { name: "Claude Code" }));
    expect(screen.getByText(/ledgr <endereço do conector>$/)).toBeInTheDocument();
    expect(screen.queryByText(/undefined|null/)).not.toBeInTheDocument();
  });

  it("cada passo diz quando deu certo e os links levam à ajuda de cada IA", () => {
    render(<CentralDeAjuda id="conectar-ia" endereco={null} />);
    expect(screen.getAllByText(/^Deu certo quando /)).toHaveLength(5);
    expect(screen.getByRole("link", { name: "ajuda do ChatGPT" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "ajuda do Claude" })).toHaveAttribute("target", "_blank");
  });

  it("Quando não funciona abre cada problema numa sanfona, e as colunas mostram título e texto", () => {
    render(<CentralDeAjuda id="conectar-ia" endereco={null} />);
    const problemas = document.getElementById("problemas")!;
    expect(problemas.querySelectorAll("details").length).toBeGreaterThanOrEqual(6);
    expect(within(problemas).getByText("Aparece “Pedido indisponível”")).toBeInTheDocument();
    const antes = document.getElementById("antes")!;
    expect(within(antes).getByText("Ser administrador ou gestor")).toBeInTheDocument();
  });

  it("Configurações leva ao passo a passo completo", () => {
    render(<CentralDeAjuda id="configuracoes" />);
    expect(screen.getByRole("link", { name: /Ver o passo a passo completo/ })).toHaveAttribute("href", "/ajuda/conectar-ia");
  });
});
