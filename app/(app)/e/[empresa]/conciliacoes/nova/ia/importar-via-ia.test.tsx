import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportarViaIa } from "./importar-via-ia";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const importarViaIa = vi.fn();
vi.mock("./acoes", () => ({ importarViaIa: (dados: FormData) => importarViaIa(dados) }));

const PROMPT = { prompt: "Leia o PDF e devolva só o JSON.", versaoSchema: "1" } as never;

function painel() {
  return screen.getByRole("complementary", { name: "Importação via IA" });
}

describe("ImportarViaIa", () => {
  beforeEach(() => {
    importarViaIa.mockReset();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
  });

  it("marca os passos no painel conforme a pessoa avança", async () => {
    const user = userEvent.setup();
    render(<ImportarViaIa prompt={PROMPT} />);
    const titulo = () => within(painel()).getByRole("heading", { level: 2 });
    const feitos = () => within(painel()).getAllByRole("listitem").map((li) => li.hasAttribute("data-feito"));

    expect(titulo()).toHaveTextContent("Comece pelo prompt");
    expect(feitos()).toEqual([false, false, false]);
    expect(within(painel()).getByRole("button", { name: /Importar e conferir/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Copiar prompt" }));
    expect(titulo()).toHaveTextContent("Agora, a IA");
    expect(feitos()).toEqual([true, false, false]);

    await user.upload(screen.getByLabelText("Arquivo da IA"), new File(["{}"], "resposta.json", { type: "application/json" }));
    expect(titulo()).toHaveTextContent("Pronto para conferir");
    expect(feitos()).toEqual([true, true, true]);
    expect(within(painel()).getByRole("button", { name: /Importar e conferir/ })).toBeEnabled();
  });

  it("mostra a tabela de erros e diz no painel que o arquivo tem problemas", async () => {
    importarViaIa.mockResolvedValue({
      ok: false,
      status: 422,
      erro: "O arquivo não passou na conferência",
      erros: [{ lancamento: 4, caminho: "lancamentos[3].valor", mensagem: "O valor precisa ser um número." }],
      totalErros: 1,
    });
    const user = userEvent.setup();
    render(<ImportarViaIa prompt={PROMPT} />);

    await user.upload(screen.getByLabelText("Arquivo da IA"), new File(["{}"], "resposta.json", { type: "application/json" }));
    await user.click(within(painel()).getByRole("button", { name: /Importar e conferir/ }));

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByRole("table", { name: "Erros do arquivo" })).toHaveTextContent("lancamentos[3].valor");
    expect(within(painel()).getByRole("heading", { level: 2 })).toHaveTextContent("O arquivo tem problemas");
    // o último passo só fica feito quando o arquivo passa
    expect(within(painel()).getAllByRole("listitem").at(-1)).not.toHaveAttribute("data-feito");
  });
});
