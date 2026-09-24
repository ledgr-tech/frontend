import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NovaConciliacaoPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const enviarExtrato = vi.fn();
const situacaoDoExtrato = vi.fn();
const conciliar = vi.fn();
vi.mock("../acoes", () => ({
  enviarExtrato: (dados: FormData) => enviarExtrato(dados),
  situacaoDoExtrato: (id: string) => situacaoDoExtrato(id),
  conciliar: (banco: string, sistema: string) => conciliar(banco, sistema),
}));

function arquivo(nome: string, tamanho = 8) {
  const conteudo = "x".repeat(tamanho);
  return new File([conteudo], nome, { type: "text/csv" });
}

function concluido(origem: "banco" | "sistema", erros: { identificador: string; motivo: string }[] = []) {
  return {
    ok: true as const,
    dados: {
      extrato_id: `extrato-${origem}`,
      status: erros.length > 0 ? ("concluido_com_erros" as const) : ("concluido" as const),
      origem,
      quantidade_lancamentos: 3,
      erros,
    },
  };
}

async function enviarOsDois() {
  const user = userEvent.setup();
  render(<NovaConciliacaoPage />);
  await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
  await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
  await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));
  return user;
}

describe("NovaConciliacaoPage", () => {
  beforeEach(() => {
    push.mockClear();
    enviarExtrato.mockReset();
    situacaoDoExtrato.mockReset();
    conciliar.mockReset();

    enviarExtrato
      .mockResolvedValueOnce({ ok: true, dados: { extratoId: "extrato-banco" } })
      .mockResolvedValueOnce({ ok: true, dados: { extratoId: "extrato-sistema" } });
    situacaoDoExtrato.mockImplementation((id: string) =>
      Promise.resolve(concluido(id === "extrato-banco" ? "banco" : "sistema")),
    );
    conciliar.mockResolvedValue({
      ok: true,
      dados: { extrato_banco_id: "extrato-banco", extrato_sistema_id: "extrato-sistema", total: 3 },
    });
  });

  it("deixa o botão desligado até os dois arquivos estarem escolhidos", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);

    const botao = screen.getByRole("button", { name: "Conciliar extratos" });
    expect(botao).toBeDisabled();
    // o motivo do botão desabilitado fica escrito e ligado a ele
    expect(botao).toHaveAccessibleDescription("Envie os dois extratos para conciliar.");

    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
    expect(botao).toBeDisabled();

    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    expect(botao).toBeEnabled();
    expect(botao).not.toHaveAccessibleDescription();
  });

  it("sobe os dois extratos marcando a origem de cada um", async () => {
    await enviarOsDois();

    await waitFor(() => expect(enviarExtrato).toHaveBeenCalledTimes(2));
    // o campo que trava a integração (issue #20): tem que ir, e com o valor certo
    const [primeiro] = enviarExtrato.mock.calls[0] as [FormData];
    const [segundo] = enviarExtrato.mock.calls[1] as [FormData];
    expect(primeiro.get("origem")).toBe("banco");
    expect((primeiro.get("arquivo") as File).name).toBe("banco.ofx");
    expect(segundo.get("origem")).toBe("sistema");
    expect((segundo.get("arquivo") as File).name).toBe("sistema.csv");
  });

  it("concilia e abre o resultado pelo extrato do banco", async () => {
    await enviarOsDois();

    await waitFor(() =>
      expect(conciliar).toHaveBeenCalledWith("extrato-banco", "extrato-sistema"),
    );
    // a listagem parte do extrato do banco; pelo do sistema seria ambígua
    await waitFor(() => expect(push).toHaveBeenCalledWith("/conciliacoes/extrato-banco"));
  });

  it("não concilia quando o upload falha, e mostra o motivo", async () => {
    enviarExtrato.mockReset();
    enviarExtrato.mockResolvedValue({
      ok: false,
      status: 429,
      erro: "Muitos envios seguidos. Espere um minuto e tente de novo.",
    });

    await enviarOsDois();

    expect(await screen.findByRole("alert")).toHaveTextContent("Espere um minuto");
    expect(conciliar).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("manda para o login quando a sessão expirou", async () => {
    enviarExtrato.mockReset();
    enviarExtrato.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });

    await enviarOsDois();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("avisa das linhas que o parser não leu, mas segue conciliando", async () => {
    situacaoDoExtrato.mockImplementation((id: string) =>
      Promise.resolve(
        id === "extrato-banco"
          ? concluido("banco", [{ identificador: "L12", motivo: "valor inválido" }])
          : concluido("sistema"),
      ),
    );

    await enviarOsDois();

    expect(
      await screen.findByText("1 linha(s) do extrato do banco não foram lidas."),
    ).toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/conciliacoes/extrato-banco"));
  });

  // 4MB e não os 5MB do backend: o arquivo passa por uma Server Action, e a
  // Vercel corta o corpo da requisição em 4,5MB antes de o backend ver qualquer coisa
  it("barra arquivo acima de 4MB antes de gastar uma requisição", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);
    await user.upload(
      screen.getByLabelText("Extrato do banco"),
      arquivo("gigante.ofx", 4 * 1024 * 1024 + 1),
    );
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("passa de 4MB");
    expect(enviarExtrato).not.toHaveBeenCalled();
  });

  it("aceita arquivo de exatamente 4MB", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);
    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("limite.ofx", 4 * 1024 * 1024));
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));

    await waitFor(() => expect(enviarExtrato).toHaveBeenCalledTimes(2));
  });

  it("volta ao início com um recado quando o envio nem chega ao servidor", async () => {
    // a Server Action lança em vez de devolver Resultado: corpo grande demais,
    // rede caída ou deploy novo no meio ("Failed to find Server Action")
    enviarExtrato.mockReset();
    enviarExtrato.mockRejectedValue(new Error("Body exceeded 1 MB limit"));

    await enviarOsDois();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar agora. Recarregue a página e tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Conciliar extratos" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("também se recupera quando a conciliação lança no meio do caminho", async () => {
    conciliar.mockRejectedValue(new Error("Failed to fetch"));

    await enviarOsDois();

    expect(await screen.findByRole("alert")).toHaveTextContent("Recarregue a página");
    expect(screen.getByRole("button", { name: "Conciliar extratos" })).toBeEnabled();
  });
});
