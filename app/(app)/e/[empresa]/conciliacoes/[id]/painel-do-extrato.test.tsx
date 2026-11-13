import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SaldoDoExtrato } from "@/lib/adaptadores";
import type { Decisao, LinhaComparacao } from "@/lib/mock-data";
import type { DetalhesDaDivergencia, Explicacao, Resultado } from "../acoes";
import { PainelDoExtrato } from "./painel-do-extrato";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const explicarDivergencia = vi.fn<(id: string) => Promise<Resultado<Explicacao>>>();
const carregarDetalhes = vi.fn<(id: string) => Promise<Resultado<DetalhesDaDivergencia>>>();
vi.mock("../acoes", () => ({
  explicarDivergencia: (id: string) => explicarDivergencia(id),
  carregarDetalhesDaDivergencia: (id: string) => carregarDetalhes(id),
}));

const SALDO: SaldoDoExtrato = { inicial: 441555.86, final: 46147.12, data: "2026-10-29" };

const DIVERGENTE: LinhaComparacao = {
  id: "6f55ff77-7794-4079-8186-ba17414abbe6",
  descricao: "DEB. FOLHA PAGTO-2C2E---04",
  data: "05/10",
  valorBanco: -178631.96,
  valorSistema: -11671.63,
  status: "divergente_valor",
  explicacao: null,
  historico: [],
};

function justificada(situacao: "pendente" | "aprovada"): Decisao {
  return { tipo: "justificada", texto: "Folha lançada em duas partes.", autor: "Marina", em: "2026-11-05T14:32:00Z", rodada: 1, situacao };
}

type Props = Partial<React.ComponentProps<typeof PainelDoExtrato>>;

function montar(props: Props = {}) {
  const acoes = {
    onJustificar: vi.fn(async () => null as string | null),
    onAprovar: vi.fn(async () => null as string | null),
    onRejeitar: vi.fn(async () => null as string | null),
    onDesfazer: vi.fn(async () => null as string | null),
    onDesfazerAprovacao: vi.fn(async () => null as string | null),
    onExplicada: vi.fn(),
    onAbrirDetalhe: vi.fn(),
    onOcupar: vi.fn(),
  };
  render(
    <PainelDoExtrato
      linha={DIVERGENTE}
      fixada={false}
      rodada={1}
      linhas={[DIVERGENTE]}
      saldo={SALDO}
      real
      podeDecidir
      podeAprovar
      {...acoes}
      {...props}
    />,
  );
  return { user: userEvent.setup(), ...acoes };
}

describe("PainelDoExtrato", () => {
  beforeEach(() => {
    carregarDetalhes.mockReset();
    carregarDetalhes.mockResolvedValue({ ok: false, status: 404, erro: "Não encontrada." });
    push.mockReset();
    explicarDivergencia.mockReset();
  });

  describe("sem linha em foco", () => {
    it("é um molde na tela: os campos vazios, a dica e o Abrir detalhe desligado", () => {
      montar({ linha: null });
      expect(screen.getByText("Passe o mouse sobre uma linha")).toBeInTheDocument();
      expect(screen.getByText(/Clique numa linha para fixar/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Abrir detalhe" })).toBeDisabled();
      // o saldo e o caminho de volta ao topo ficam à vista do mesmo jeito
      expect(screen.getByText("Saldo final")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Voltar ao topo do extrato" })).toBeEnabled();
    });
  });

  describe("os saldos", () => {
    it("mostra o inicial, o final e a data do extrato do banco", () => {
      montar({ linha: null });
      expect(screen.getByText("Saldo inicial").nextElementSibling).toHaveTextContent(/441\.555,86/);
      expect(screen.getByText("Saldo final").nextElementSibling).toHaveTextContent(/46\.147,12/);
      expect(screen.getByText(/29\/10\/2026/)).toBeInTheDocument();
    });

    it("o arquivo sem saldo diz isso, em vez de mostrar R$ 0,00", () => {
      montar({ linha: null, saldo: null });
      expect(screen.getByText("Saldo não informado no arquivo")).toBeInTheDocument();
      expect(screen.queryByText("Saldo final")).not.toBeInTheDocument();
    });

    it("com linhas não lidas o inicial depende delas, e o painel não o calcula", () => {
      montar({ linha: null, saldo: { ...SALDO, inicial: null } });
      expect(screen.getByText("depende das linhas não lidas")).toBeInTheDocument();
    });

    it("o backend sem saldo (antes da #118) não ganha bloco de saldo, só o botão de topo", () => {
      montar({ linha: null, saldo: undefined });
      expect(screen.queryByText("Saldo final")).not.toBeInTheDocument();
      expect(screen.queryByText("Saldo não informado no arquivo")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Voltar ao topo do extrato" })).toBeInTheDocument();
    });

    it("Voltar ao topo leva a página ao começo", async () => {
      const rolar = vi.fn();
      window.scrollTo = rolar as unknown as typeof window.scrollTo;
      const { user } = montar({ linha: null });
      await user.click(screen.getByRole("button", { name: "Voltar ao topo do extrato" }));
      expect(rolar).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });
  });

  describe("a linha em foco", () => {
    it("mostra o veredito, o título, os dois valores, a diferença e a descrição no sistema", () => {
      montar({ linha: { ...DIVERGENTE, descricaoSistema: "FOLHA PAGTO OUT 2C2E", dataSistema: "05/10" } });
      expect(screen.getByText("Em foco")).toBeInTheDocument();
      expect(screen.getByText("Valor diverge")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "DEB. FOLHA PAGTO-2C2E---04" })).toBeInTheDocument();
      expect(screen.getByText("Extrato do banco").parentElement).toHaveTextContent(/178\.631,96/);
      expect(screen.getByText("Extrato do sistema").parentElement).toHaveTextContent(/11\.671,63/);
      expect(screen.getByText("Diferença").nextElementSibling).toHaveTextContent(/166\.960,33/);
      expect(screen.getByText(/Descrição no sistema: FOLHA PAGTO OUT 2C2E/)).toBeInTheDocument();
    });

    it("a linha fixada diz Fixado", () => {
      montar({ fixada: true });
      expect(screen.getByText("Fixado")).toBeInTheDocument();
      expect(screen.queryByText("Em foco")).not.toBeInTheDocument();
    });

    it("a explicação da IA leva o selo neutro; a frase do motor, não", () => {
      montar({ linha: { ...DIVERGENTE, explicacao: "O banco registrou a folha inteira.", explicacaoPorIa: true } });
      expect(screen.getByText("Gerada por IA · confira antes de decidir")).toBeInTheDocument();
      expect(screen.getByText("O banco registrou a folha inteira.")).toBeInTheDocument();
    });

    it("sem o lançamento no sistema o valor diz isso, sem inventar R$ 0,00", () => {
      montar({ linha: { ...DIVERGENTE, status: "sem_correspondencia", valorSistema: null } });
      expect(screen.getByText("sem lançamento no sistema")).toBeInTheDocument();
    });

    it("Abrir detalhe chama o caminho do detalhe", async () => {
      const { user, onAbrirDetalhe } = montar();
      await user.click(screen.getByRole("button", { name: "Abrir detalhe" }));
      expect(onAbrirDetalhe).toHaveBeenCalledTimes(1);
    });
  });

  describe("a rolagem do detalhe", () => {
    it("mostra o \"Mais abaixo\" enquanto há conteúdo fora da vista, e some no fim", () => {
      montar();
      const detalhe = document.querySelector<HTMLElement>(".comp-detalhe")!;
      const mais = document.querySelector(".comp-mais")!;
      Object.defineProperty(detalhe, "scrollHeight", { configurable: true, value: 600 });
      Object.defineProperty(detalhe, "clientHeight", { configurable: true, value: 200 });

      fireEvent.scroll(detalhe);
      expect(mais).toHaveAttribute("data-visivel");
      expect(detalhe).toHaveAttribute("data-abaixo");
      expect(detalhe).not.toHaveAttribute("data-acima");

      detalhe.scrollTop = 400;
      fireEvent.scroll(detalhe);
      expect(mais).not.toHaveAttribute("data-visivel");
      expect(detalhe).toHaveAttribute("data-acima");
    });
  });

  describe("Explicar esta divergência", () => {
    it("sem explicação, com dado do backend, oferece o botão e o aviso de envio, e não pede sozinho", () => {
      montar();
      expect(screen.getByRole("button", { name: "Explicar esta divergência" })).toBeInTheDocument();
      expect(screen.getByText(/dados resumidos desta linha são enviados à OpenAI/)).toBeInTheDocument();
      expect(explicarDivergencia).not.toHaveBeenCalled();
    });

    it("o mock não tem o que pedir: sem o botão", () => {
      montar({ real: false });
      expect(screen.queryByRole("button", { name: "Explicar esta divergência" })).not.toBeInTheDocument();
    });

    it("pede no clique, mostra Explicando… e devolve a explicação para a linha", async () => {
      let resolver: (r: Resultado<Explicacao>) => void = () => {};
      explicarDivergencia.mockReturnValue(new Promise((ok) => (resolver = ok)));
      const { user, onExplicada, onOcupar } = montar();

      await user.click(screen.getByRole("button", { name: "Explicar esta divergência" }));
      expect(explicarDivergencia).toHaveBeenCalledWith(DIVERGENTE.id);
      expect(screen.getByRole("button", { name: "Explicando…" })).toBeDisabled();
      expect(screen.getByText("Lendo os dois extratos. Pode levar alguns segundos.")).toBeInTheDocument();
      // a linha fica fixada enquanto a explicação nasce
      expect(onOcupar).toHaveBeenLastCalledWith(true);

      const dados = { texto: "A folha está incompleta.", geradaPorIa: true, indisponibilidade: null };
      resolver({ ok: true, dados });
      await waitFor(() => expect(onExplicada).toHaveBeenCalledWith(DIVERGENTE, dados));
      expect(onOcupar).toHaveBeenLastCalledWith(false);
    });

    it("com os fatos do backend, mostra o texto e os detalhes no lugar do convite, sem pedir a IA", async () => {
      carregarDetalhes.mockResolvedValue({
        ok: true,
        dados: {
          texto: "No banco: -R$ 178.631,96. No sistema: -R$ 11.671,63.",
          detalhes: [{ rotulo: "Diferença de valor", valor: "R$ 166.960,33" }],
        },
      });
      montar();

      expect(await screen.findByText("No banco: -R$ 178.631,96. No sistema: -R$ 11.671,63.")).toBeInTheDocument();
      expect(screen.getByText("Diferença de valor")).toBeInTheDocument();
      expect(carregarDetalhes).toHaveBeenCalledWith(DIVERGENTE.id);
      expect(explicarDivergencia).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Explicar esta divergência" })).toBeInTheDocument();
    });

    it("a falha vira uma frase no lugar, com o botão de tentar de novo", async () => {
      explicarDivergencia.mockResolvedValue({ ok: false, status: 503, erro: "Explicações indisponíveis agora." });
      const { user } = montar();
      await user.click(screen.getByRole("button", { name: "Explicar esta divergência" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Explicações indisponíveis agora.");
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeEnabled();
    });

    it("o limite diário não é erro: mostra o texto do motor e avisa que é o padrão do Ledgr", async () => {
      explicarDivergencia.mockResolvedValueOnce({
        ok: true,
        dados: { texto: "Texto do motor.", geradaPorIa: false, indisponibilidade: "limite_diario" },
      });
      const { user } = montar();
      await user.click(screen.getByRole("button", { name: "Explicar esta divergência" }));
      expect(await screen.findByText(/O limite diário de explicações automáticas acabou/)).toBeInTheDocument();
    });
  });

  describe("Justificar", () => {
    it("troca a parte de baixo pelo campo, trava a linha e só grava com o motivo", async () => {
      const { user, onJustificar, onOcupar } = montar();
      await user.click(screen.getByRole("button", { name: "Justificar" }));
      expect(screen.getByLabelText("Justificativa")).toBeInTheDocument();
      expect(screen.getByText(/Fica no registro com o seu nome e o horário/)).toBeInTheDocument();
      expect(onOcupar).toHaveBeenLastCalledWith(true);
      // aberto o campo, o Justificar vira o envio e o Voltar solta
      await user.click(screen.getByRole("button", { name: "Justificar" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Escreva o motivo da justificativa.");
      expect(onJustificar).not.toHaveBeenCalled();

      await user.type(screen.getByLabelText("Justificativa"), "  Folha lançada em duas partes.  ");
      await user.click(screen.getByRole("button", { name: "Justificar" }));
      expect(onJustificar).toHaveBeenCalledWith("Folha lançada em duas partes.");
      await waitFor(() => expect(screen.queryByLabelText("Justificativa")).not.toBeInTheDocument());
      expect(onOcupar).toHaveBeenLastCalledWith(false);
    });

    it("o motivo de não ter gravado fica no lugar e o texto continua no campo", async () => {
      const onJustificar = vi.fn(async () => "O mês está fechado." as string | null);
      const { user } = montar({ onJustificar });
      await user.click(screen.getByRole("button", { name: "Justificar" }));
      await user.type(screen.getByLabelText("Justificativa"), "Juros.");
      await user.click(screen.getByRole("button", { name: "Justificar" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("O mês está fechado.");
      expect(screen.getByLabelText("Justificativa")).toHaveValue("Juros.");
    });

    it("Voltar fecha o campo e solta a linha", async () => {
      const { user, onOcupar } = montar();
      await user.click(screen.getByRole("button", { name: "Justificar" }));
      await user.click(screen.getByRole("button", { name: "Voltar" }));
      expect(screen.queryByLabelText("Justificativa")).not.toBeInTheDocument();
      expect(onOcupar).toHaveBeenLastCalledWith(false);
    });

    it("não oferece justificar sem onde gravar, nem na linha que bateu", () => {
      montar({ podeDecidir: false });
      expect(screen.queryByRole("button", { name: "Justificar" })).not.toBeInTheDocument();
    });

    it("a linha que bateu só tem Abrir detalhe", () => {
      montar({ linha: { ...DIVERGENTE, status: "match_exato", explicacao: "Bateu: mesmo valor e mesma data nos dois extratos." } });
      expect(screen.queryByRole("button", { name: "Justificar" })).not.toBeInTheDocument();
      expect(screen.getByText("Bateu: mesmo valor e mesma data nos dois extratos.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Abrir detalhe" })).toBeEnabled();
    });
  });

  describe("a justificativa que espera aprovação", () => {
    const AGUARDANDO = { ...DIVERGENTE, decisao: justificada("pendente") };

    it("mostra a nota da decisão e, ao admin e ao gestor, Aprovar e Rejeitar", async () => {
      const { user, onAprovar } = montar({ linha: AGUARDANDO });
      expect(screen.getByText("Aguardando")).toBeInTheDocument();
      expect(screen.getByText(/Justificada por Marina em .* · aguardando aprovação/)).toBeInTheDocument();
      expect(screen.getByText("Folha lançada em duas partes.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Aprovar" }));
      expect(onAprovar).toHaveBeenCalledTimes(1);
    });

    it("Rejeitar abre o motivo, opcional, e grava com ele", async () => {
      const { user, onRejeitar } = montar({ linha: AGUARDANDO });
      await user.click(screen.getByRole("button", { name: "Rejeitar" }));
      expect(screen.getByLabelText("Motivo da rejeição (opcional)")).toBeInTheDocument();
      await user.type(screen.getByLabelText("Motivo da rejeição (opcional)"), "Falta o comprovante.");
      await user.click(screen.getByRole("button", { name: "Rejeitar justificativa" }));
      expect(onRejeitar).toHaveBeenCalledWith("Falta o comprovante.");
    });

    it("o motivo da rejeição pode ir vazio", async () => {
      const { user, onRejeitar } = montar({ linha: AGUARDANDO });
      await user.click(screen.getByRole("button", { name: "Rejeitar" }));
      await user.click(screen.getByRole("button", { name: "Rejeitar justificativa" }));
      expect(onRejeitar).toHaveBeenCalledWith("");
    });

    it("o analista só vê que aguarda, sem botão de decidir", () => {
      montar({ linha: AGUARDANDO, podeAprovar: false });
      expect(screen.getByText("Aguarda a aprovação do admin ou do gestor da conta.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Rejeitar" })).not.toBeInTheDocument();
    });

    it("a aprovada por outra pessoa diz quem aprovou e quem precisa desfazer, sem botão", () => {
      const aprovada = { ...DIVERGENTE, decisao: { ...justificada("aprovada"), aprovadaPor: "Gabriela", aprovadaEm: "2026-11-05T16:05:00Z" } };
      montar({ linha: aprovada });
      expect(screen.getByText("Justificada")).toBeInTheDocument();
      expect(screen.getByText(/Aprovada por Gabriela em /)).toBeInTheDocument();
      expect(screen.getByText("Para alterar ou retirar, Gabriela precisa desfazer a aprovação.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Justificar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Desfazer/ })).not.toBeInTheDocument();
    });
  });

  // as mesmas ações de desfazer da janela da linha, que não abre a partir de 1100px (#368)
  describe("desfazer", () => {
    const APROVADA: LinhaComparacao = {
      ...DIVERGENTE,
      decisao: { ...justificada("aprovada"), aprovadaPor: "Gabriela", aprovadaEm: "2026-11-05T16:05:00Z", podeDesfazerAprovacao: true },
    };

    it("quem justificou desfaz a justificativa que espera aprovação, mesmo sem poder aprovar", async () => {
      const { user, onDesfazer } = montar({ linha: { ...DIVERGENTE, decisao: justificada("pendente") }, podeAprovar: false });
      await user.click(screen.getByRole("button", { name: "Desfazer justificativa" }));
      expect(onDesfazer).toHaveBeenCalledTimes(1);
    });

    it("a justificada que não passou por aprovação também se desfaz", async () => {
      const { user, onDesfazer } = montar({ linha: { ...DIVERGENTE, decisao: justificada("aprovada") }, podeAprovar: false });
      await user.click(screen.getByRole("button", { name: "Desfazer justificativa" }));
      expect(onDesfazer).toHaveBeenCalledTimes(1);
    });

    it("o motivo de não ter desfeito fica no painel", async () => {
      const { user } = montar({
        linha: { ...DIVERGENTE, decisao: justificada("pendente") },
        onDesfazer: vi.fn(async () => "O mês foi fechado."),
      });
      await user.click(screen.getByRole("button", { name: "Desfazer justificativa" }));
      expect(await screen.findByText("O mês foi fechado.")).toBeInTheDocument();
    });

    it("quem aprovou desfaz a aprovação, depois de confirmar", async () => {
      const { user, onDesfazerAprovacao, onDesfazer } = montar({ linha: APROVADA });
      // a aprovada não se retira direto: o backend responderia 409
      expect(screen.queryByRole("button", { name: "Desfazer justificativa" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Desfazer aprovação…" }));
      expect(screen.getByText(/volta a aguardar aprovação/)).toBeInTheDocument();
      expect(onDesfazerAprovacao).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Desfazer aprovação" }));
      expect(onDesfazerAprovacao).toHaveBeenCalledTimes(1);
      expect(onDesfazer).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole("button", { name: "Desfazer aprovação…" })).toBeInTheDocument());
    });

    it("a confirmação sai se a linha deixou de ser aprovada por baixo, e o motivo fica", async () => {
      const { user } = montar({ linha: APROVADA, onDesfazerAprovacao: vi.fn(async () => "Esta aprovação já foi desfeita.") });
      await user.click(screen.getByRole("button", { name: "Desfazer aprovação…" }));
      await user.click(screen.getByRole("button", { name: "Desfazer aprovação" }));
      expect(await screen.findByText("Esta aprovação já foi desfeita.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Desfazer aprovação" })).toBeInTheDocument();
    });

    it("Voltar desiste de desfazer a aprovação", async () => {
      const { user, onDesfazerAprovacao } = montar({ linha: APROVADA });
      await user.click(screen.getByRole("button", { name: "Desfazer aprovação…" }));
      await user.click(screen.getByRole("button", { name: "Voltar" }));
      expect(onDesfazerAprovacao).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Desfazer aprovação…" })).toBeInTheDocument();
    });

    it("o analista não desfaz a aprovação, nem com o backend dizendo que quem aprovou pode", () => {
      montar({ linha: APROVADA, podeAprovar: false });
      expect(screen.queryByRole("button", { name: /Desfazer/ })).not.toBeInTheDocument();
    });

    it("com o mês fechado ou numa rodada passada, nada de desfazer", () => {
      montar({ linha: { ...DIVERGENTE, decisao: justificada("pendente") }, podeDecidir: false });
      expect(screen.queryByRole("button", { name: /Desfazer/ })).not.toBeInTheDocument();
    });
  });
});
