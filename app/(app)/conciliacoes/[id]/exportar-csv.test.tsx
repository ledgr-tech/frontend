import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportarCsv, nomeDoArquivo } from "./exportar-csv";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

const BOM = [0xef, 0xbb, 0xbf];
const CSV = new Uint8Array([...BOM, ...new TextEncoder().encode("Status;Valor (banco)\r\nMatch exato;10,00\r\n")]);

const fetch = vi.fn();
const criarUrl = vi.fn((arquivo: Blob) => {
  void arquivo;
  return "blob:csv";
});
const revogarUrl = vi.fn();
// o <a download> que o botão cria e clica; o jsdom não baixa nada
const cliques: HTMLAnchorElement[] = [];

/**
 * Os bytes do Blob, venha ele de onde vier: conforme a versão do Node, o
 * `Response.blob()` do teste devolve o Blob do Node (que tem arrayBuffer() e o
 * FileReader do jsdom recusa) ou o do jsdom (que não tem arrayBuffer()).
 */
async function bytes(arquivo: Blob): Promise<Uint8Array> {
  if (typeof arquivo.arrayBuffer === "function") return new Uint8Array(await arquivo.arrayBuffer());
  return new Promise((pronto) => {
    const leitor = new FileReader();
    leitor.onload = () => pronto(new Uint8Array(leitor.result as ArrayBuffer));
    leitor.readAsArrayBuffer(arquivo);
  });
}

function renderizar(filtrada = false) {
  render(<ExportarCsv extratoBancoId={BANCO} extratoSistemaId={SISTEMA} mes="Setembro/2026" filtrada={filtrada} />);
}

describe("nomeDoArquivo", () => {
  it("põe a competência no nome, sem acento nem barra", () => {
    expect(nomeDoArquivo("Setembro/2026")).toBe("ledgr-conciliacao-setembro-2026.csv");
    expect(nomeDoArquivo("Março/2026")).toBe("ledgr-conciliacao-marco-2026.csv");
  });

  it("sem competência, fica o nome genérico", () => {
    // é o que adaptarConciliacao põe quando nenhuma linha tem data
    expect(nomeDoArquivo("Conciliação")).toBe("ledgr-conciliacao.csv");
  });

  it("com uma categoria, ela entra no fim do nome", () => {
    expect(nomeDoArquivo("Setembro/2026", "tarifa_bancaria")).toBe(
      "ledgr-conciliacao-setembro-2026-tarifa-bancaria.csv",
    );
    expect(nomeDoArquivo("Conciliação", "duplicado")).toBe("ledgr-conciliacao-duplicado.csv");
  });
});

describe("ExportarCsv", () => {
  beforeEach(() => {
    fetch.mockReset();
    push.mockReset();
    criarUrl.mockClear();
    revogarUrl.mockClear();
    cliques.length = 0;
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: revogarUrl }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      cliques.push(this);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("baixa o CSV do par com o nome da competência e os bytes do backend", async () => {
    fetch.mockResolvedValue(new Response(CSV, { headers: { "Content-Type": "text/csv; charset=utf-8" } }));
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(fetch).toHaveBeenCalledWith(`/api/conciliacoes/${BANCO}/exportar?sistema=${SISTEMA}`);
    expect(cliques[0].download).toBe("ledgr-conciliacao-setembro-2026.csv");
    expect(cliques[0].getAttribute("href")).toBe("blob:csv");
    // o arquivo salvo é o que o backend mandou, com o BOM na frente
    const [arquivo] = criarUrl.mock.calls[0];
    expect(await bytes(arquivo)).toEqual(CSV);
    await waitFor(() => expect(revogarUrl).toHaveBeenCalledWith("blob:csv"));
  });

  it("com uma categoria escolhida, pede ao backend só ela", async () => {
    fetch.mockResolvedValue(new Response(CSV, { headers: { "Content-Type": "text/csv; charset=utf-8" } }));
    const user = userEvent.setup();
    render(
      <ExportarCsv
        extratoBancoId={BANCO}
        extratoSistemaId={SISTEMA}
        mes="Setembro/2026"
        filtrada={false}
        status="duplicado"
      />,
    );

    // o backend filtra, então o arquivo bate com a tela: nada de "todas as linhas"
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(fetch).toHaveBeenCalledWith(`/api/conciliacoes/${BANCO}/exportar?sistema=${SISTEMA}&status=duplicado`);
    expect(cliques[0].download).toBe("ledgr-conciliacao-setembro-2026-duplicado.csv");
  });

  it("trava o botão e diz que está exportando enquanto espera", async () => {
    fetch.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    const botao = screen.getByRole("button", { name: "Exportando…" });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
  });

  it("avisa que o arquivo traz todas as linhas quando a tela está filtrada", () => {
    renderizar(true);

    expect(screen.getByRole("button", { name: "Exportar CSV (todas as linhas)" })).toBeInTheDocument();
  });

  it("mostra na tela o erro que a rota devolveu e libera o botão", async () => {
    fetch.mockResolvedValue(Response.json({ erro: "Conciliação não encontrada." }, { status: 404 }));
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Conciliação não encontrada.");
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeEnabled();
    expect(cliques).toHaveLength(0);
  });

  it("manda a sessão vencida para o login", async () => {
    fetch.mockResolvedValue(Response.json({ erro: "Sua sessão expirou." }, { status: 401 }));
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(cliques).toHaveLength(0);
  });

  it("com a rede caída, pede para tentar de novo", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível gerar o CSV agora. Tente de novo em instantes.",
    );
  });

  it("limpa o erro anterior quando tenta de novo", async () => {
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetch.mockResolvedValueOnce(new Response(CSV));
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => expect(cliques).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
