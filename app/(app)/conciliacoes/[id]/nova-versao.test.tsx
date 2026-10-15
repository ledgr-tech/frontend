import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NovaVersao } from "./nova-versao";

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

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const onConcluida = vi.fn();

function situacao(status: "concluido" | "erro", erros: { identificador: string; motivo: string }[] = []) {
  return {
    ok: true as const,
    dados: { extrato_id: "extrato-novo", status, origem: "sistema" as const, quantidade_lancamentos: 3, erros },
  };
}

// um CSV que o backend lê como está, então passa pela checagem de colunas
const CSV_PRONTO = "data;valor;descricao\n2026-09-04;-12604.00;Boleto Aço Norte\n";

function csv(tamanho?: number) {
  const arquivo = new File([CSV_PRONTO], "erp-setembro-v3.csv", { type: "text/csv" });
  if (tamanho) Object.defineProperty(arquivo, "size", { value: tamanho });
  return arquivo;
}

async function enviar(arquivo = csv()) {
  const user = userEvent.setup();
  render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
  await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
  await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo);
  await user.click(screen.getByRole("button", { name: "Enviar e conciliar" }));
  return user;
}

describe("NovaVersao", () => {
  beforeEach(() => {
    push.mockClear();
    onConcluida.mockReset();
    enviarExtrato.mockReset();
    situacaoDoExtrato.mockReset();
    conciliar.mockReset();
    enviarExtrato.mockResolvedValue({ ok: true, dados: { extratoId: "extrato-novo" } });
    situacaoDoExtrato.mockResolvedValue(situacao("concluido"));
    conciliar.mockResolvedValue({ ok: true, dados: { total: 3 } });
  });

  it("sends only the system extrato and conciliates it with this screen's bank extrato", async () => {
    await enviar();

    await waitFor(() => expect(onConcluida).toHaveBeenCalled());
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
    const [dados] = enviarExtrato.mock.calls[0] as [FormData];
    expect(dados.get("origem")).toBe("sistema");
    expect(conciliar).toHaveBeenCalledWith(BANCO, "extrato-novo");
  });

  it("accepts only CSV, because the backend does not read the ERP's PDF yet", async () => {
    const user = userEvent.setup();
    render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));

    expect(screen.getByLabelText("Extrato do sistema de gestão")).toHaveAttribute("accept", ".csv");
  });

  it("refuses a file over 4MB without sending it", async () => {
    await enviar(csv(5 * 1024 * 1024));

    expect(screen.getByRole("alert")).toHaveTextContent(
      'O arquivo "erp-setembro-v3.csv" passa de 4MB. Exporte um período menor.',
    );
    expect(enviarExtrato).not.toHaveBeenCalled();
  });

  it("says why the backend could not read the file", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("erro"));
    await enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O servidor não conseguiu ler o extrato do sistema. Confira se é o arquivo certo, exportado em CSV.",
    );
    expect(conciliar).not.toHaveBeenCalled();
    expect(onConcluida).not.toHaveBeenCalled();
  });

  it("sends an expired session back to the login", async () => {
    enviarExtrato.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await enviar();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
