import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NovaConciliacaoPage from "./page";

// O reenvio do extrato do sistema é a Nova conciliação com ?banco=&sistemaAnterior= (era uma janela da comparação).
const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const ANTERIOR = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const push = vi.fn();
let consulta = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(consulta),
}));

const enviarExtrato = vi.fn();
const situacaoDoExtrato = vi.fn();
const conciliar = vi.fn();
const carregarRegras = vi.fn();
const carregarContextoDoReenvio = vi.fn();
vi.mock("../acoes", () => ({
  enviarExtrato: (dados: FormData) => enviarExtrato(dados),
  situacaoDoExtrato: (id: string) => situacaoDoExtrato(id),
  conciliar: (banco: string, sistema: string) => conciliar(banco, sistema),
  carregarRegras: () => carregarRegras(),
  carregarContextoDoReenvio: (banco: string, anterior: string) => carregarContextoDoReenvio(banco, anterior),
}));

const carregarPromptIa = vi.fn();
const importarViaIa = vi.fn();
vi.mock("./ia/acoes", () => ({
  carregarPromptIa: () => carregarPromptIa(),
  importarViaIa: (dados: FormData) => importarViaIa(dados),
}));

vi.mock("../../../../../(auth)/acoes", () => ({ salvarPreferencias: async () => true }));
vi.mock("../../assinatura/acoes", () => ({ carregarPrecos: async () => null }));

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

const CAMPO = "Extrato do sistema de gestão";

async function abrir() {
  const user = userEvent.setup();
  render(<NovaConciliacaoPage />);
  await screen.findByText("Mantido");
  return user;
}

async function enviar(arquivo = csv()) {
  const user = await abrir();
  await user.upload(screen.getByLabelText(CAMPO), arquivo);
  await user.click(screen.getByRole("button", { name: "Conciliar de novo" }));
  return user;
}

describe("Nova conciliação em modo reenvio", () => {
  beforeEach(() => {
    consulta = `banco=${BANCO}&sistemaAnterior=${ANTERIOR}`;
    push.mockClear();
    for (const mock of [enviarExtrato, situacaoDoExtrato, conciliar, carregarRegras, carregarContextoDoReenvio, carregarPromptIa, importarViaIa]) {
      mock.mockReset();
    }
    carregarRegras.mockResolvedValue({
      ok: true,
      dados: { toleranciaDias: 2, toleranciaDiasMaximo: 7, atualizadoPor: null, atualizadoEm: null },
    });
    carregarContextoDoReenvio.mockResolvedValue({
      ok: true,
      dados: { arquivoBanco: "banco-setembro.ofx", competencia: "2026-09", rodada: 3, arquivoAnterior: "erp-setembro-v2.csv" },
    });
    enviarExtrato.mockResolvedValue({ ok: true, dados: { extratoId: "extrato-novo" } });
    situacaoDoExtrato.mockResolvedValue(situacao("concluido"));
    conciliar.mockResolvedValue({ ok: true, dados: { total: 3 } });
  });

  it("lê o contexto pelos ids e mostra o banco travado, a rodada e o caminho de volta", async () => {
    await abrir();

    expect(carregarContextoDoReenvio).toHaveBeenCalledWith(BANCO, ANTERIOR);
    expect(screen.getByRole("heading", { name: "Nova versão do extrato do sistema" })).toBeInTheDocument();
    expect(screen.getByText(/competência setembro de 2026/)).toBeInTheDocument();
    expect(screen.getByText(/rodada 3, com o mesmo extrato do banco/)).toBeInTheDocument();
    // a folha do banco só mostra qual é: não há onde soltar nem escolher arquivo do banco
    expect(screen.getByText("banco-setembro.ofx")).toBeInTheDocument();
    expect(screen.queryByLabelText("Extrato do banco")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Falta o extrato do sistema" })).toBeInTheDocument();
    expect(screen.getByText("Banco: mantido")).toBeInTheDocument();
    expect(screen.getByText("Sistema de gestão: falta")).toBeInTheDocument();
    expect(screen.getByText("3, no lugar de erp-setembro-v2.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conciliar de novo" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Voltar à comparação" })).toHaveAttribute(
      "href",
      `/conciliacoes/${BANCO}?sistema=${ANTERIOR}`,
    );
    // sem tutorial para marcar: os alvos dele não existem aqui
    expect(document.querySelector("[data-tutorial]")).toBeNull();
  });

  it.each([
    ["banco inválido", `banco=nao-e-uuid&sistemaAnterior=${ANTERIOR}`],
    ["sistema anterior inválido", `banco=${BANCO}&sistemaAnterior=x`],
    ["só um dos dois", `banco=${BANCO}`],
  ])("%s: cai na Nova conciliação normal", (_, busca) => {
    consulta = busca;
    render(<NovaConciliacaoPage />);

    expect(screen.getByRole("heading", { name: "Nova conciliação" })).toBeInTheDocument();
    expect(screen.getByLabelText("Extrato do banco")).toBeInTheDocument();
    expect(carregarContextoDoReenvio).not.toHaveBeenCalled();
  });

  it("sem o contexto, mostra a falha da tela e tenta de novo", async () => {
    carregarContextoDoReenvio.mockResolvedValueOnce({ ok: false, status: 503, erro: "fora" });
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);

    expect(await screen.findByText(/Não foi possível carregar a comparação de origem/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar à comparação" })).toHaveAttribute(
      "href",
      `/conciliacoes/${BANCO}?sistema=${ANTERIOR}`,
    );
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Mantido")).toBeInTheDocument();
    expect(carregarContextoDoReenvio).toHaveBeenCalledTimes(2);
  });

  it("sessão expirada ao ler o contexto volta ao login", async () => {
    carregarContextoDoReenvio.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    render(<NovaConciliacaoPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("sobe só o extrato do sistema e concilia com o banco da comparação", async () => {
    await enviar();

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/conciliacoes/${BANCO}?sistema=extrato-novo`));
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
    const [dados] = enviarExtrato.mock.calls[0] as [FormData];
    expect(dados.get("origem")).toBe("sistema");
    expect(conciliar).toHaveBeenCalledWith(BANCO, "extrato-novo");
    expect(situacaoDoExtrato).toHaveBeenCalledTimes(1);
  });

  it("mostra o palco com o banco mantido e o arquivo novo enquanto concilia", async () => {
    conciliar.mockReturnValue(new Promise(() => {}));
    await enviar();

    expect(await screen.findByText("Etapa 4 de 4")).toBeInTheDocument();
    expect(screen.getByText("banco-setembro.ofx")).toBeInTheDocument();
    expect(screen.getByText("erp-setembro-v3.csv")).toBeInTheDocument();
  });

  it("mostra as linhas rejeitadas e espera o consentimento antes de conciliar", async () => {
    situacaoDoExtrato.mockResolvedValue(
      situacao("concluido_com_erros", [
        { identificador: "4", motivo: "Data inválida" },
        { identificador: "8", motivo: "Valor inválido" },
      ]),
    );
    const user = await enviar();

    expect(await screen.findByText("Linha 4: Data inválida")).toBeInTheDocument();
    expect(screen.getByText("Linha 8: Valor inválido")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("2 linhas do extrato do sistema não foram lidas.");
    expect(
      screen.getByText(/A nova rodada usará somente as linhas válidas\..*o arquivo enviado fica em Extratos, sem conciliação\./),
    ).toBeInTheDocument();
    // o foco vai para a saída que não concilia
    expect(screen.getByRole("button", { name: "Voltar para corrigir" })).toHaveFocus();
    expect(conciliar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continuar com linhas válidas" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/conciliacoes/${BANCO}?sistema=extrato-novo`));
    expect(conciliar).toHaveBeenCalledWith(BANCO, "extrato-novo");
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
  });

  it("deixa voltar para corrigir sem conciliar o que veio em parte", async () => {
    situacaoDoExtrato.mockResolvedValueOnce(situacao("concluido_com_erros", [{ identificador: "4", motivo: "Data inválida" }]));
    const user = await enviar();
    await user.click(await screen.findByRole("button", { name: "Voltar para corrigir" }));

    expect(conciliar).not.toHaveBeenCalled();
    expect(screen.getByText("Banco: mantido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conciliar de novo" })).toBeDisabled();
    await user.upload(screen.getByLabelText(CAMPO), csv());
    await user.click(screen.getByRole("button", { name: "Conciliar de novo" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/conciliacoes/${BANCO}?sistema=extrato-novo`));
    expect(enviarExtrato).toHaveBeenCalledTimes(2);
    expect(conciliar).toHaveBeenCalledTimes(1);
  });

  it("continua uma vez num clique duplo", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", [{ identificador: "4", motivo: "Data inválida" }]));
    let finalizar!: (resultado: { ok: true; dados: { total: number } }) => void;
    conciliar.mockReturnValue(new Promise((resolve) => (finalizar = resolve)));
    const user = await enviar();
    await user.dblClick(await screen.findByRole("button", { name: "Continuar com linhas válidas" }));

    expect(conciliar).toHaveBeenCalledTimes(1);
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
    finalizar({ ok: true, dados: { total: 3 } });
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it("um clique duplo em Conciliar de novo sobe o arquivo uma vez", async () => {
    const user = await abrir();
    await user.upload(screen.getByLabelText(CAMPO), csv());
    await user.dblClick(screen.getByRole("button", { name: "Conciliar de novo" }));

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
    expect(conciliar).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo uma conciliação consentida que falhou, sem subir o arquivo outra vez", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", [{ identificador: "4", motivo: "Data inválida" }]));
    conciliar.mockResolvedValueOnce({ ok: false, status: 503, erro: "Tente de novo." });
    const user = await enviar();
    await user.click(await screen.findByRole("button", { name: "Continuar com linhas válidas" }));
    expect(await screen.findByText("Tente de novo.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar com linhas válidas" }));

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(conciliar).toHaveBeenCalledTimes(2);
    expect(enviarExtrato).toHaveBeenCalledTimes(1);
  });

  it("aceita CSV e JSON na folha do sistema e explica o limite", async () => {
    await abrir();

    expect(screen.getByLabelText(CAMPO)).toHaveAttribute("accept", ".csv,.json");
    expect(screen.getByText("CSV ou JSON, até 4 MB")).toBeVisible();
  });

  it.each(["seletor", "arrastar"])("manda o JSON do %s para a conferência com o contexto da rodada", async (modo) => {
    const arquivo = new File(["{}"], "corrigido.json", { type: "application/json" });
    importarViaIa.mockResolvedValue({ ok: true, dados: { importacaoId: "rascunho", quantidade: 2 } });
    const user = await abrir();
    const campo = screen.getByLabelText(CAMPO);
    if (modo === "seletor") await user.upload(campo, arquivo);
    else fireEvent.drop(campo.closest("label")!, { dataTransfer: { files: [arquivo] } });

    await user.click(screen.getByRole("button", { name: "Conciliar de novo" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/conciliacoes/nova/ia/rascunho?banco=${BANCO}&sistemaAnterior=${ANTERIOR}`),
    );
    expect(importarViaIa.mock.calls[0][0].get("arquivo")).toBe(arquivo);
    expect(enviarExtrato).not.toHaveBeenCalled();
    expect(conciliar).not.toHaveBeenCalled();
  });

  it("carrega e copia o prompt no cartão da IA, sem sair da tela", async () => {
    carregarPromptIa.mockResolvedValue({ ok: true, dados: { prompt: "O prompt original" } });
    const user = await abrir();
    expect(carregarPromptIa).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /Importar via IA/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar JSON com IA" }));
    await user.click(await screen.findByRole("button", { name: "Copiar prompt" }));

    expect(await navigator.clipboard.readText()).toBe("O prompt original");
    expect(push).not.toHaveBeenCalled();
    expect(importarViaIa).not.toHaveBeenCalled();
  });

  it("deixa enviar o JSON com o prompt indisponível e mostra a validação do backend", async () => {
    carregarPromptIa.mockResolvedValue({ ok: false, status: 503, erro: "Prompt indisponível." });
    importarViaIa.mockResolvedValue({
      ok: false,
      status: 422,
      erro: "JSON inválido.",
      totalErros: 54,
      erros: [{ caminho: "lancamentos[0].valor", mensagem: "Informe o valor.", lancamento: 1 }],
    });
    const user = await abrir();
    await user.click(screen.getByRole("button", { name: "Gerar JSON com IA" }));
    expect(await screen.findByText("Prompt indisponível.")).toBeVisible();
    await user.upload(screen.getByLabelText(CAMPO), new File(["{}"], "corrigido.json"));
    await user.click(screen.getByRole("button", { name: "Conciliar de novo" }));

    expect(await screen.findByText("JSON inválido.")).toBeVisible();
    expect(screen.getByText("54 erros")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    expect(conciliar).not.toHaveBeenCalled();
    // a folha volta, para corrigir e mandar de novo
    expect(screen.getByLabelText(CAMPO)).toBeEnabled();
  });

  it("enquanto importa o JSON, o palco toma a tela e só uma importação sai", async () => {
    importarViaIa.mockReturnValue(new Promise(() => {}));
    const user = await abrir();
    await user.upload(screen.getByLabelText(CAMPO), new File(["{}"], "corrigido.json"));
    await user.dblClick(screen.getByRole("button", { name: "Conciliar de novo" }));

    expect(await screen.findByText("Etapa 2 de 4")).toBeInTheDocument();
    expect(screen.queryByLabelText(CAMPO)).not.toBeInTheDocument();
    expect(importarViaIa).toHaveBeenCalledTimes(1);
  });

  it("recusa na folha uma extensão que não é CSV nem JSON", async () => {
    const user = await abrir();
    await user.upload(screen.getByLabelText(CAMPO), csv());
    fireEvent.drop(screen.getByLabelText(CAMPO).closest("label")!, {
      dataTransfer: { files: [new File([""], "arquivo.pdf")] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("O extrato do sistema de gestão precisa ser um arquivo CSV ou JSON.");
    // o que já estava escolhido continua
    expect(screen.getByRole("button", { name: "Conciliar de novo" })).toBeEnabled();
  });

  it("recusa um arquivo acima de 4 MB sem enviar", async () => {
    await enviar(csv(5 * 1024 * 1024));

    expect(screen.getByRole("alert")).toHaveTextContent(
      'O arquivo "erp-setembro-v3.csv" passa de 4 MB. Exporte um período menor.',
    );
    expect(enviarExtrato).not.toHaveBeenCalled();
  });

  it("lista as cinco primeiras linhas rejeitadas e conta o resto", async () => {
    const erros = Array.from({ length: 7 }, (_, indice) => ({ identificador: String(indice + 1), motivo: "Data inválida" }));
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros", erros));
    await enviar();

    expect(await screen.findByText("e mais 2 linhas não lidas.")).toBeInTheDocument();
    expect(screen.getAllByText(/^Linha \d: Data inválida$/)).toHaveLength(5);
  });

  it("pergunta mesmo quando o backend não lista as linhas rejeitadas", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("concluido_com_erros"));
    await enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Algumas linhas do extrato do sistema não foram lidas.");
    expect(conciliar).not.toHaveBeenCalled();
  });

  it("diz por que o backend não leu o arquivo", async () => {
    situacaoDoExtrato.mockResolvedValue(situacao("erro"));
    await enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O servidor não conseguiu ler o extrato do sistema. Confira se é o arquivo certo, exportado em CSV.",
    );
    expect(conciliar).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("402: mostra o texto do backend com o caminho para os planos", async () => {
    conciliar.mockResolvedValue({ ok: false, status: 402, erro: "O teste acabou. Escolha um plano para conciliar." });
    await enviar();

    expect(await screen.findByText("O teste acabou. Escolha um plano para conciliar.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seu teste de 14 dias acabou." })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("mês fechado ou rodada antiga: mostra o texto do backend, sem regra do front", async () => {
    conciliar.mockResolvedValue({ ok: false, status: 409, erro: "O mês está fechado. Reabra o fechamento para conciliar." });
    await enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("O mês está fechado. Reabra o fechamento para conciliar.");
    expect(push).not.toHaveBeenCalled();
    // a pessoa pode voltar e tentar com outro arquivo
    expect(screen.getByLabelText(CAMPO)).toBeEnabled();
  });

  it("sessão expirada no envio volta ao login", async () => {
    enviarExtrato.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await enviar();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
