import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { Execucao } from "@/lib/adaptadores";
import type { Conciliacao, LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import type { Painel, Resultado } from "../conciliacoes/acoes";
import DashboardPage from "./page";

vi.mock("@/lib/mock-data", () => ({
  EMPRESA_MOCK: "Telha Certa",
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarPainel = vi.fn<() => Promise<Resultado<Painel>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarPainel: () => carregarPainel(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function linha(
  id: string,
  status: StatusLinha,
  valorBanco: number | null,
  valorSistema: number | null,
  descricao = "Lançamento",
  dataISO = "2026-09-04",
): LinhaComparacao {
  return {
    id,
    descricao,
    data: dataISO.split("-").reverse().slice(0, 2).join("/"),
    dataISO,
    valorBanco,
    valorSistema,
    status,
    explicacao: null,
    historico: [],
  };
}

function conciliacao(id: string, linhas: LinhaComparacao[]): Conciliacao {
  return { id, mes: "Setembro/2026", status: "em_andamento", linhas };
}

function execucao(parcial: Partial<Execucao> & Pick<Execucao, "id">): Execucao {
  return {
    extratoBancoId: `banco-${parcial.id}`,
    extratoSistemaId: `sistema-${parcial.id}`,
    arquivoBanco: `sicredi-${parcial.id}.ofx`,
    arquivoSistema: `erp-${parcial.id}.csv`,
    executadaEm: "2026-09-02T19:20:00Z",
    lancamentos: 3980,
    acerto: 97.3,
    divergencias: {},
    atual: true,
    ...parcial,
  };
}

function painel(recente: Conciliacao | null, anteriores: Execucao[] = []) {
  carregarPainel.mockResolvedValue({ ok: true, dados: { recente, anteriores } });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    carregarPainel.mockReset();
    push.mockClear();
  });

  it("shows the empty state when there are no conciliações", async () => {
    painel(null);
    render(<DashboardPage />);
    expect(await screen.findByText("Nenhum extrato por aqui ainda.")).toBeInTheDocument();
    expect(screen.queryByText(/Competência/)).not.toBeInTheDocument();
  });

  it("derives the summary row from the most recent conciliação", async () => {
    painel(
      conciliacao("banco-1", [
        linha("l-1", "match_exato", 7300, 7300),
        linha("l-2", "divergente_valor", 12640, 12604),
        linha("l-3", "sem_correspondencia", 4180, null),
        linha("l-4", "sem_correspondencia", null, 2150),
      ]),
    );
    render(<DashboardPage />);

    expect(await screen.findByText("Lançamentos processados")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("25,0%")).toBeInTheDocument();
    // 36 da divergência de valor + 4.180 + 2.150 das órfãs
    expect(screen.getByText("R$ 6.366")).toBeInTheDocument();
    expect(screen.getByText("Distribuído em 3 lançamentos")).toBeInTheDocument();
  });

  it("takes the competência and the period from the conciliação itself", async () => {
    painel(
      conciliacao("banco-1", [
        linha("l-1", "match_exato", 100, 100, "Primeiro", "2026-09-01"),
        linha("l-2", "match_exato", 100, 100, "Último", "2026-09-30"),
      ]),
    );
    render(<DashboardPage />);

    expect(await screen.findByText("Competência setembro/2026")).toBeInTheDocument();
    expect(screen.getByText("Período 01–30 de setembro")).toBeInTheDocument();
  });

  it("writes the full date of each lançamento", async () => {
    painel(conciliacao("banco-1", [linha("l-1", "match_exato", 100, 100, "Pix", "2025-12-31")]));
    render(<DashboardPage />);
    // o ano vem do lançamento, não é mais fixo em 2026
    expect(await screen.findByText("31/12/2025")).toBeInTheDocument();
  });

  it("labels each lançamento with the status wording from the design", async () => {
    painel(
      conciliacao("banco-1", [
        linha("l-1", "match_exato", 7300, 7300, "Pagamento Vale Verde"),
        linha("l-2", "divergente_valor", 12640, 12604, "Boleto Aço Norte"),
        linha("l-3", "sem_correspondencia", 4180, null, "Transferência recebida"),
      ]),
    );
    render(<DashboardPage />);

    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.getByText("Match exato")).toBeInTheDocument();
    expect(screen.getByText("Valor diverge na mesma data")).toBeInTheDocument();
    expect(screen.getByText("Sem correspondência no sistema")).toBeInTheDocument();
    // a origem é o banco sempre que o banco tem a linha
    expect(screen.getAllByText("Banco")).toHaveLength(3);
  });

  it("tags each lançamento row with the tone of its status", async () => {
    painel(
      conciliacao("banco-1", [
        linha("l-1", "match_exato", 7300, 7300, "Pagamento Vale Verde"),
        linha("l-2", "divergente_valor", 12640, 12604, "Boleto Aço Norte"),
      ]),
    );
    render(<DashboardPage />);

    expect((await screen.findByText("Pagamento Vale Verde")).closest("tr")).toHaveAttribute("data-tom", "ok");
    expect(screen.getByText("Boleto Aço Norte").closest("tr")).toHaveAttribute("data-tom", "risco");
  });

  it("shows where each lançamento came from with the icon of its origin", async () => {
    painel(
      conciliacao("banco-1", [
        linha("l-1", "sem_correspondencia", 4180, null, "Transferência recebida"),
        linha("l-2", "sem_correspondencia", null, 980, "Estorno maquininha"),
      ]),
    );
    render(<DashboardPage />);

    const doBanco = (await screen.findByText("Banco")).closest("td");
    expect(doBanco?.querySelector('[data-origem="banco"]')).not.toBeNull();
    const doSistema = screen.getByText("Sistema").closest("td");
    expect(doSistema?.querySelector('[data-origem="sistema"]')).not.toBeNull();
  });

  it("points the highlight card at the linhas without a counterpart", async () => {
    painel({
      ...conciliacao("banco-9", [
        linha("l-1", "sem_correspondencia", 4180, null),
        linha("l-2", "sem_correspondencia", null, 2150),
      ]),
      extratoSistemaId: "sistema-9",
    });
    render(<DashboardPage />);

    expect(await screen.findByText("Comece pelas 2 sem correspondente")).toBeInTheDocument();
    // vai direto para a primeira divergência em aberto, não para a lista, e
    // leva o par junto
    expect(screen.getByRole("link", { name: "Revisar agora" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-9/l-1?sistema=sistema-9",
    );
    expect(screen.getByRole("link", { name: "Ver a conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-9?sistema=sistema-9",
    );
  });

  it("does not show the suggestions, which have no data behind them yet", async () => {
    painel(conciliacao("banco-1", [linha("l-1", "divergente_valor", 12640, 12604)]));
    render(<DashboardPage />);

    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.queryByText("O que o Ledgr sugere")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Criar regra" })).not.toBeInTheDocument();
  });

  it("hides the highlight card when every linha has a counterpart", async () => {
    painel(conciliacao("banco-1", [linha("l-1", "match_exato", 100, 100)]));
    render(<DashboardPage />);

    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.queryByText(/sem correspondente$/)).not.toBeInTheDocument();
  });

  it("lists the other current executions, each opening its own result", async () => {
    painel(conciliacao("banco-2", [linha("l-1", "match_exato", 100, 100)]), [execucao({ id: "e1" })]);
    render(<DashboardPage />);

    expect(await screen.findByText("Conciliações anteriores")).toBeInTheDocument();
    const linhaAnterior = within(screen.getByText("sicredi-e1.ofx × erp-e1.csv").closest("tr")!);
    expect(linhaAnterior.getByText("02/09/2026 16:20")).toBeInTheDocument();
    expect(linhaAnterior.getByText("3.980")).toBeInTheDocument();
    expect(linhaAnterior.getByText("97,3%")).toBeInTheDocument();
    expect(linhaAnterior.getByRole("link", { name: "Ver" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-e1?sistema=sistema-e1",
    );
  });

  it("only lists earlier conciliações when there are some", async () => {
    painel(conciliacao("banco-2", [linha("l-1", "match_exato", 100, 100)]));
    render(<DashboardPage />);
    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.queryByText("Conciliações anteriores")).not.toBeInTheDocument();
  });

  it("asks for a reload when the backend fails", async () => {
    carregarPainel.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    render(<DashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar suas conciliações. Recarregue a página e tente de novo.",
    );
  });

  it("asks for a reload instead of an endless skeleton when the action throws", async () => {
    carregarPainel.mockRejectedValue(new Error("Failed to fetch"));
    render(<DashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Recarregue a página");
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("sends an expired session back to the login", async () => {
    carregarPainel.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    render(<DashboardPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
