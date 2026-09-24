import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ArquivoExtrato } from "../conciliacoes/acoes";
import { Galeria } from "./galeria";

function arquivo(parcial: Partial<ArquivoExtrato> & Pick<ArquivoExtrato, "id" | "nome">): ArquivoExtrato {
  return {
    origem: "banco",
    conciliadoEm: "2026-09-24T17:02:11Z",
    resultado: "/conciliacoes/b-set",
    situacao: "concluido",
    lancamentos: 4218,
    erros: [],
    ...parcial,
  };
}

// do uso mais recente para o mais antigo, como a action devolve
const ARQUIVOS: ArquivoExtrato[] = [
  arquivo({ id: "b-set", nome: "sicredi-setembro.ofx" }),
  arquivo({
    id: "s-set",
    nome: "erp-setembro.csv",
    origem: "sistema",
    situacao: "concluido_com_erros",
    lancamentos: 4203,
    erros: [
      { identificador: "linha 14", motivo: "valor ilegível" },
      { identificador: "linha 98", motivo: "data fora do formato" },
    ],
  }),
  arquivo({
    id: "b-ago",
    nome: "sicredi-agosto.ofx",
    conciliadoEm: "2026-09-02T19:20:00Z",
    resultado: "/conciliacoes/b-ago",
    lancamentos: 3980,
  }),
  arquivo({ id: "s-ago", nome: "erp-agosto.csv", origem: "sistema", situacao: null, lancamentos: null }),
];

function cartao(nome: string) {
  return screen.getByRole("button", { name: new RegExp(nome) });
}

function painel() {
  return within(screen.getByRole("region", { name: "Arquivo selecionado" }));
}

describe("Galeria de extratos", () => {
  it("counts the files behind each filter", () => {
    render(<Galeria arquivos={ARQUIVOS} />);
    expect(screen.getByRole("button", { name: "Todos (4)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Do banco (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do sistema (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Com problema (1)" })).toBeInTheDocument();
  });

  it("tags each card with the tone of its situation, which colors hover and selection", () => {
    render(<Galeria arquivos={ARQUIVOS} />);

    expect(cartao("sicredi-setembro.ofx")).toHaveAttribute("data-tom", "ok");
    expect(cartao("erp-setembro.csv")).toHaveAttribute("data-tom", "atencao");
  });

  it("marks each file with the icon of where it came from", () => {
    render(<Galeria arquivos={ARQUIVOS} />);

    expect(cartao("sicredi-setembro.ofx").querySelector('[data-origem="banco"]')).not.toBeNull();
    expect(cartao("erp-setembro.csv").querySelector('[data-origem="sistema"]')).not.toBeNull();
    // o painel abre com o primeiro arquivo, que é do banco
    const regiao = screen.getByRole("region", { name: "Arquivo selecionado" });
    expect(regiao.querySelector('[data-origem="banco"]')).not.toBeNull();
  });

  it("shows each file with its type, content and situation", () => {
    render(<Galeria arquivos={ARQUIVOS} />);
    const setembro = within(cartao("sicredi-setembro.ofx"));
    expect(setembro.getByText("OFX")).toBeInTheDocument();
    expect(setembro.getByText("4.218 lançamentos")).toBeInTheDocument();
    expect(setembro.getByText("Conciliado")).toBeInTheDocument();

    expect(within(cartao("erp-setembro.csv")).getByText("Com linhas não lidas")).toBeInTheDocument();
    // o detalhe desse não carregou: o arquivo fica, sem inventar situação
    const semDetalhe = within(cartao("erp-agosto.csv"));
    expect(semDetalhe.getByText("Sem detalhes")).toBeInTheDocument();
    expect(semDetalhe.getByText("Conteúdo indisponível")).toBeInTheDocument();
  });

  it("opens the most recent file in the side panel", () => {
    render(<Galeria arquivos={ARQUIVOS} />);
    expect(cartao("sicredi-setembro.ofx")).toHaveAttribute("aria-pressed", "true");
    expect(painel().getByRole("heading", { name: "sicredi-setembro.ofx" })).toBeInTheDocument();
    expect(painel().getByText("Extrato do banco")).toBeInTheDocument();
    expect(painel().getByText("24/09/2026 14:02")).toBeInTheDocument();
    expect(painel().getByText("b-set")).toBeInTheDocument();
    expect(painel().getByRole("link", { name: "Ver conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/b-set",
    );
  });

  it("switches the panel to the clicked file", async () => {
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS} />);

    await user.click(cartao("sicredi-agosto.ofx"));

    expect(cartao("sicredi-agosto.ofx")).toHaveAttribute("aria-pressed", "true");
    expect(cartao("sicredi-setembro.ofx")).toHaveAttribute("aria-pressed", "false");
    expect(painel().getByRole("heading", { name: "sicredi-agosto.ofx" })).toBeInTheDocument();
    expect(painel().getByRole("link", { name: "Ver conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/b-ago",
    );
  });

  it("lists the lines the parser could not read", async () => {
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS} />);

    await user.click(cartao("erp-setembro.csv"));

    expect(painel().getByText("2 linhas não lidas")).toBeInTheDocument();
    expect(painel().getByText("linha 14")).toBeInTheDocument();
    expect(painel().getByText("valor ilegível")).toBeInTheDocument();
    expect(painel().getByText("data fora do formato")).toBeInTheDocument();
  });

  it("filters by origin and keeps the panel on a visible file", async () => {
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS} />);

    await user.click(screen.getByRole("button", { name: "Do sistema (2)" }));

    expect(screen.queryByRole("button", { name: /sicredi-setembro/ })).not.toBeInTheDocument();
    expect(cartao("erp-setembro.csv")).toBeInTheDocument();
    // o selecionado (sicredi-setembro) sumiu do filtro: o painel passa ao primeiro visível
    expect(painel().getByRole("heading", { name: "erp-setembro.csv" })).toBeInTheDocument();
  });

  it("filters the files with unread lines", async () => {
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS} />);

    await user.click(screen.getByRole("button", { name: "Com problema (1)" }));

    expect(screen.getAllByRole("button", { name: /\.(ofx|csv)/ })).toHaveLength(1);
    expect(cartao("erp-setembro.csv")).toBeInTheDocument();
  });

  it("explains an empty filter instead of an empty grid", async () => {
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS.filter((item) => item.erros.length === 0)} />);

    await user.click(screen.getByRole("button", { name: "Com problema (0)" }));

    expect(screen.getByText("Nenhum arquivo com problema.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Arquivo selecionado" })).not.toBeInTheDocument();
  });
});
