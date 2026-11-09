import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const carregarPromptIa = vi.fn();
const importarViaIa = vi.fn();
vi.mock("../nova/ia/acoes", () => ({
  carregarPromptIa: () => carregarPromptIa(),
  importarViaIa: (dados: FormData) => importarViaIa(dados),
}));

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const onConcluida = vi.fn();

function situacao(status: "concluido" | "concluido_com_erros" | "erro", erros: { identificador: string; motivo: string }[] = []) {
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
    carregarPromptIa.mockReset();
    importarViaIa.mockReset();
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

  it("shows rejected lines and waits for consent before conciliating the valid lines", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", [
      { identificador: "4", motivo: "Data inválida" },
      { identificador: "8", motivo: "Valor inválido" },
    ]));
    const user = await enviar();

    expect(await screen.findByText("Linha 4: Data inválida")).toBeInTheDocument();
    expect(screen.getByText("Linha 8: Valor inválido")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("2 linhas do extrato do sistema não foram lidas.");
    expect(screen.getByText(/Se voltar ou fechar, o arquivo enviado fica em Extratos, sem conciliação\./)).toBeInTheDocument();
    // o "Enviar e conciliar" saiu da tela: o foco vai para a saída que não concilia
    expect(screen.getByRole("button", { name: "Voltar para corrigir" })).toHaveFocus();
    expect(conciliar).not.toHaveBeenCalled();
    expect(onConcluida).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continuar com linhas válidas" }));

    await waitFor(() => expect(onConcluida).toHaveBeenCalledTimes(1));
    expect(conciliar).toHaveBeenCalledWith(BANCO, "extrato-novo");
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
  });

  it("lets the user return to correct the file without conciliating the partial import", async () => {
    situacaoDoExtrato.mockResolvedValueOnce(situacao("concluido_com_erros", [
      { identificador: "4", motivo: "Data inválida" },
    ]));
    const user = await enviar();
    await user.click(await screen.findByRole("button", { name: "Voltar para corrigir" }));

    expect(conciliar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enviar e conciliar" })).toBeDisabled();
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), csv());
    await user.click(screen.getByRole("button", { name: "Enviar e conciliar" }));

    await waitFor(() => expect(onConcluida).toHaveBeenCalledTimes(1));
    expect(enviarExtrato).toHaveBeenCalledTimes(2);
    expect(conciliar).toHaveBeenCalledTimes(1);
  });

  it("cancels the partial import decision and clears it when reopening", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", [
      { identificador: "4", motivo: "Data inválida" },
    ]));
    const user = await enviar();
    const continuar = await screen.findByRole("button", { name: "Continuar com linhas válidas" });
    continuar.focus();
    await user.keyboard("{Escape}");

    expect(conciliar).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
    expect(screen.queryByRole("button", { name: "Continuar com linhas válidas" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar e conciliar" })).toBeDisabled();
  });

  it("continues once on a double click and does not cancel while conciliating", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", [
      { identificador: "4", motivo: "Data inválida" },
    ]));
    let finalizar!: (resultado: { ok: true; dados: { total: number } }) => void;
    conciliar.mockReturnValue(new Promise((resolve) => { finalizar = resolve; }));
    const user = await enviar();
    await user.dblClick(await screen.findByRole("button", { name: "Continuar com linhas válidas" }));
    await user.keyboard("{Escape}");

    expect(conciliar).toHaveBeenCalledTimes(1);
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar para corrigir" })).toBeDisabled();
    finalizar({ ok: true, dados: { total: 3 } });
    await waitFor(() => expect(onConcluida).toHaveBeenCalledTimes(1));
  });

  it("retries a failed consented conciliation without uploading the file again", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", [
      { identificador: "4", motivo: "Data inválida" },
    ]));
    conciliar.mockResolvedValueOnce({ ok: false, status: 503, erro: "Tente de novo." });
    const user = await enviar();
    await user.click(await screen.findByRole("button", { name: "Continuar com linhas válidas" }));
    expect(await screen.findByText("Tente de novo.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar com linhas válidas" }));

    await waitFor(() => expect(onConcluida).toHaveBeenCalledTimes(1));
    expect(conciliar).toHaveBeenCalledTimes(2);
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
  });

  it("shows which round it replaces and which one the chosen file opens", async () => {
    const user = userEvent.setup();
    render(
      <NovaVersao
        extratoBancoId={BANCO}
        rodadaAtual={{ numero: 2, total: 2, arquivo: "erp-setembro-v2.csv", em: "2026-10-21T14:51:00Z" }}
        onConcluida={onConcluida}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));

    expect(screen.getByText("Rodada 2 · agora")).toBeInTheDocument();
    expect(screen.getByText("erp-setembro-v2.csv")).toBeInTheDocument();
    expect(screen.getByText("Rodada 3 · nova")).toBeInTheDocument();
    expect(screen.getByText("Solte aqui o arquivo corrigido")).toBeInTheDocument();
    // sem arquivo, o enviar não tem o que mandar
    expect(screen.getByRole("button", { name: "Enviar e conciliar" })).toBeDisabled();

    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), csv());
    // o arquivo escolhido aparece na rodada nova e a área passa a oferecer a troca
    expect(screen.getAllByText(/erp-setembro-v3\.csv/).length).toBeGreaterThan(0);
    expect(screen.getByText("1 KB · pronto para enviar")).toBeInTheDocument();
    expect(screen.getByText("Trocar o arquivo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar e conciliar" })).toBeEnabled();
  });

  it("without the round (the mock), leaves the before-and-after out", async () => {
    const user = userEvent.setup();
    render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
    expect(screen.queryByText(/· agora$/)).not.toBeInTheDocument();
  });

  it("accepts CSV and JSON and explains the upload limit", async () => {
    const user = userEvent.setup();
    render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));

    expect(screen.getByLabelText("Extrato do sistema de gestão")).toHaveAttribute("accept", ".csv,.json");
    expect(screen.getByText("CSV ou JSON, até 4 MB.")).toBeVisible();
  });

  it.each(["seletor", "arrastar"])("envia JSON pelo %s para revisão com o contexto da rodada", async (modo) => {
    const user = userEvent.setup();
    const arquivo = new File(["{}"], "corrigido.json", { type: "application/json" });
    importarViaIa.mockResolvedValue({ ok: true, dados: { importacaoId: "rascunho", quantidade: 2 } });
    render(<NovaVersao extratoBancoId={BANCO} extratoSistemaId="anterior" onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
    const campo = screen.getByLabelText("Extrato do sistema de gestão");
    if (modo === "seletor") await user.upload(campo, arquivo);
    else fireEvent.drop(campo.closest("label")!, { dataTransfer: { files: [arquivo] } });

    await user.click(screen.getByRole("button", { name: "Importar e conferir" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/conciliacoes/nova/ia/rascunho?banco=${BANCO}&sistemaAnterior=anterior`));
    expect(importarViaIa.mock.calls[0][0].get("arquivo")).toBe(arquivo);
    expect(enviarExtrato).not.toHaveBeenCalled();
    expect(conciliar).not.toHaveBeenCalled();
  });

  it("carrega e copia o prompt sem sair do diálogo e deixa cancelar", async () => {
    const user = userEvent.setup();
    carregarPromptIa.mockResolvedValue({ ok: true, dados: { prompt: "O prompt original" } });
    render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
    expect(carregarPromptIa).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Gerar JSON com IA" }));
    await user.click(await screen.findByRole("button", { name: "Copiar prompt" }));
    expect(await navigator.clipboard.readText()).toBe("O prompt original");
    expect(screen.getByRole("dialog")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(importarViaIa).not.toHaveBeenCalled();
  });

  it("permite enviar o JSON com o prompt indisponível e mostra a validação do backend", async () => {
    const user = userEvent.setup();
    carregarPromptIa.mockResolvedValue({ ok: false, status: 503, erro: "Prompt indisponível." });
    importarViaIa.mockResolvedValue({
      ok: false, status: 422, erro: "JSON inválido.", totalErros: 54,
      erros: [{ caminho: "lancamentos[0].valor", mensagem: "Informe o valor.", lancamento: 1 }],
    });
    render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
    await user.click(screen.getByRole("button", { name: "Gerar JSON com IA" }));
    expect(await screen.findByText("Prompt indisponível.")).toBeVisible();
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), new File(["{}"], "corrigido.json"));
    await user.click(screen.getByRole("button", { name: "Importar e conferir" }));

    expect(await screen.findByText("JSON inválido.")).toBeVisible();
    expect(screen.getByText("54 erros")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    expect(conciliar).not.toHaveBeenCalled();
  });

  it("mostra carregamento e recusa substituição enquanto está enviando", async () => {
    const user = userEvent.setup();
    importarViaIa.mockReturnValue(new Promise(() => {}));
    render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
    const campo = screen.getByLabelText("Extrato do sistema de gestão");
    await user.upload(campo, new File(["{}"], "corrigido.json"));
    await user.click(screen.getByRole("button", { name: "Importar e conferir" }));
    expect(campo).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Importar e conferir" })).toHaveAttribute("aria-busy", "true");
    expect(importarViaIa).toHaveBeenCalledTimes(1);
  });

  it("limpa o arquivo selecionado se receber uma extensão inválida pelo arraste", async () => {
    const user = userEvent.setup();
    render(<NovaVersao extratoBancoId={BANCO} onConcluida={onConcluida} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));
    const campo = screen.getByLabelText("Extrato do sistema de gestão");
    await user.upload(campo, csv());
    fireEvent.drop(campo.closest("label")!, { dataTransfer: { files: [new File([""], "arquivo.pdf")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha um arquivo CSV ou JSON.");
    expect(screen.getByRole("button", { name: "Enviar e conciliar" })).toBeDisabled();
  });

  it("refuses a file over 4MB without sending it", async () => {
    await enviar(csv(5 * 1024 * 1024));

    expect(screen.getByRole("alert")).toHaveTextContent(
      'O arquivo "erp-setembro-v3.csv" passa de 4 MB. Exporte um período menor.',
    );
    expect(enviarExtrato).not.toHaveBeenCalled();
  });

  it("lists the first five rejected lines and counts the rest", async () => {
    const erros = Array.from({ length: 7 }, (_, indice) => ({ identificador: String(indice + 1), motivo: "Data inválida" }));
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", erros));
    await enviar();

    expect(await screen.findByText("e mais 2 linhas não lidas.")).toBeInTheDocument();
    expect(screen.getAllByText(/^Linha \d: Data inválida$/)).toHaveLength(5);
  });

  it("still asks when the backend reports rejected lines without listing them", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros"));
    await enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Algumas linhas do extrato do sistema não foram lidas.");
    expect(conciliar).not.toHaveBeenCalled();
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

  it("teste acabado (402): diz o motivo e leva aos planos", async () => {
    conciliar.mockResolvedValue({ ok: false, status: 402, erro: "O teste acabou. Escolha um plano para conciliar." });
    await enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("O teste acabou. Escolha um plano para conciliar.");
    expect(screen.getByRole("link", { name: "Ver os planos" })).toHaveAttribute("href", "/assinatura");
    expect(onConcluida).not.toHaveBeenCalled();
  });

  it("sends an expired session back to the login", async () => {
    enviarExtrato.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await enviar();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
