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

  it("recusa arquivo entre 4 e 5 MB já na escolha, com o motivo ao lado do botão", async () => {
    const arquivo = new File(["{}"], "resposta.json", { type: "application/json" });
    Object.defineProperty(arquivo, "size", { value: Math.round(4.8 * 1024 * 1024) });
    const user = userEvent.setup();
    render(<ImportarViaIa prompt={PROMPT} />);

    await user.upload(screen.getByLabelText("Arquivo da IA"), arquivo);

    // sem clique nenhum: o botão não liga e o motivo está no painel, onde fica o botão
    const botao = within(painel()).getByRole("button", { name: /Importar e conferir/ });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription("O arquivo passa de 4 MB. Envie um arquivo menor.");
    expect(within(painel()).getByRole("alert")).toHaveTextContent("O arquivo passa de 4 MB.");
    expect(importarViaIa).not.toHaveBeenCalled();

    // trocar por um arquivo menor libera o botão e tira o aviso
    await user.upload(screen.getByLabelText("Arquivo da IA"), new File(["{}"], "menor.json", { type: "application/json" }));
    expect(botao).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("envia arquivo de exatamente 4 MB", async () => {
    importarViaIa.mockResolvedValue({ ok: true, dados: { importacaoId: "rascunho" } });
    const arquivo = new File(["{}"], "resposta.json", { type: "application/json" });
    Object.defineProperty(arquivo, "size", { value: 4 * 1024 * 1024 });
    const user = userEvent.setup();
    render(<ImportarViaIa prompt={PROMPT} />);

    await user.upload(screen.getByLabelText("Arquivo da IA"), arquivo);
    await user.click(within(painel()).getByRole("button", { name: /Importar e conferir/ }));

    expect(importarViaIa).toHaveBeenCalledOnce();
    expect((importarViaIa.mock.calls[0][0] as FormData).get("arquivo")).toBe(arquivo);
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
