import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MotionRoot } from "../reveal";
import type { LinhaExtrato } from "./comparacao";
import { Precos } from "./precos";

// o agosto da demonstração, com duas linhas do mesmo veredito ("Valor diverge na mesma data")
const BANCO: LinhaExtrato[] = [
  {
    data: "03/08",
    desc: "Recebimento cliente Alfa Comércio",
    valorBanco: "R$ 3.250,00",
    valorSistema: "R$ 3.250,00",
    status: "match_exato",
    explicacao: null,
  },
  {
    data: "04/08",
    desc: "Pagamento fornecedor #1082",
    valorBanco: "R$ 12.640,00",
    valorSistema: "R$ 12.604,00",
    status: "divergente_valor",
    explicacao: "O banco descontou R$ 36,00 de juros por atraso no boleto; o sistema ainda mostra o valor original da emissão.",
  },
  {
    data: "05/08",
    desc: "Crédito cartão D+30",
    valorBanco: "R$ 7.912,45",
    valorSistema: "R$ 7.912,40",
    status: "divergente_valor",
    explicacao: "Diferença de R$ 0,05: taxa de arredondamento aplicada pela operadora do cartão.",
  },
  {
    data: "06/08",
    desc: "Tarifa de manutenção da conta",
    valorBanco: "R$ 45,00",
    valorSistema: null,
    status: "tarifa_bancaria",
    explicacao: "O banco cobrou essa tarifa em 06/08; ainda não há lançamento correspondente no sistema.",
  },
  {
    data: "11/08",
    desc: "Aluguel sede agosto",
    valorBanco: "R$ 9.800,00",
    valorSistema: "R$ 9.800,00",
    status: "divergente_data",
    explicacao: "O banco debitou em 11/08; o sistema lançou a mesma despesa em 12/08.",
  },
];

const RESUMO = { periodo: "Agosto · 2026", conciliado: "96,3%", paraRevisar: "157 de 4.218 para revisar" };

const TITULOS = ["Só o que não bate", "O motivo de cada diferença", "Sem trocar de sistema", "O relatório para o contador"];

function renderPrecos() {
  return render(
    <MotionRoot>
      <Precos banco={BANCO} destaque="Pagamento fornecedor #1082" resumo={RESUMO}>
        <h2>Preço fechado, por volume.</h2>
      </Precos>
    </MotionRoot>,
  );
}

const cards = () => screen.getAllByRole("article");
const demonstracao = (card: HTMLElement) => card.querySelector<HTMLElement>(".beneficio-visual")!;
const regua = () => document.querySelector<HTMLElement>(".preco-regua")!;

describe("Precos", () => {
  it("lists what comes in every plan as four numbered cards, in reading order", () => {
    renderPrecos();
    const etapas = [...document.querySelector(".preco-trilha")!.children];
    expect(etapas).toHaveLength(4);
    expect(etapas.map((etapa) => etapa.querySelector(".preco-num")!.textContent)).toEqual(["I", "II", "III", "IV"]);
    expect(cards().map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual(TITULOS);
  });

  it("counts the categories with the motor's own list, spelled out", () => {
    renderPrecos();
    // DIVERGENCIAS tem cinco códigos: o card não pode prometer outro número
    expect(screen.getByText("Cinco categorias de divergência, sempre nomeadas")).toBeInTheDocument();
    expect(screen.getByText("As divergências nas cinco categorias, cada uma com o motivo")).toBeInTheDocument();
  });

  it("keeps every benefit of a card on the page, the faded ones too, so screen readers get the whole list", () => {
    renderPrecos();
    // só o desenho apaga o fim da lista: os itens continuam lá, e acessíveis
    expect(within(cards()[0]).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "O relatório fica pronto em minutos depois que você sobe os arquivos",
      "Os dois extratos lado a lado, como na conferência à mão",
      "Cada linha já vem marcada",
      "Você revisa só o que não bate, já com o motivo",
    ]);
  });

  it("opens each card to the keyboard too: it takes focus and is named by its title", () => {
    renderPrecos();
    for (const titulo of TITULOS) {
      expect(screen.getByRole("article", { name: titulo })).toHaveAttribute("tabindex", "0");
    }
  });

  it("shows the product demos to the eye only, out of the screen reader", () => {
    renderPrecos();
    for (const card of cards()) expect(demonstracao(card)).toHaveAttribute("aria-hidden", "true");
  });

  it("marks the month's lines in the first demo with the app's labels, one line per verdict", () => {
    renderPrecos();
    const demo = demonstracao(cards()[0]);
    expect([...demo.querySelectorAll(".selo")].map((selo) => selo.textContent)).toEqual([
      "Match exato",
      "Valor diverge na mesma data",
      "Tarifa bancária",
      "Mesmo valor em outra data",
    ]);
    // a segunda linha com o mesmo veredito fica de fora
    expect(demo.textContent).toContain("Pagamento fornecedor #1082");
    expect(demo.textContent).not.toContain("Crédito cartão D+30");
  });

  it("explains the highlighted line in the second demo, with the AI seal the product puts on that text", () => {
    renderPrecos();
    const demo = within(demonstracao(cards()[1]));
    expect(demo.getByText("Pagamento fornecedor #1082")).toBeInTheDocument();
    expect(demo.getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(demo.getByText("R$ 12.604,00")).toBeInTheDocument();
    expect(demo.getByText("Valor diverge na mesma data")).toBeInTheDocument();
    expect(demo.getByText(/^O banco descontou R\$ 36,00 de juros por atraso no boleto/)).toBeInTheDocument();
    expect(demo.getByText("Gerada por IA · confira antes de decidir")).toBeInTheDocument();
  });

  it("shows the two files of a reconciliation in the third demo, each with the formats it takes", () => {
    renderPrecos();
    const demo = within(demonstracao(cards()[2]));
    expect(demo.getByText("Extrato do banco")).toBeInTheDocument();
    expect(demo.getByText("OFX ou CSV")).toBeInTheDocument();
    expect(demo.getByText("Extrato do sistema")).toBeInTheDocument();
    expect(demo.getByText("CSV", { exact: true })).toBeInTheDocument();
  });

  it("shows the month's report in the last demo, with the summary it is given", () => {
    renderPrecos();
    const demo = within(demonstracao(cards()[3]));
    expect(demo.getByText("Agosto · 2026")).toBeInTheDocument();
    expect(demo.getByText("96,3%")).toBeInTheDocument();
    expect(demo.getByText("157 de 4.218 para revisar")).toBeInTheDocument();
    expect(demo.getByText("CSV")).toBeInTheDocument();
  });

  it("asks only mouse users to hover a card: on touch the cards come open", () => {
    renderPrecos();
    const dica = screen.getByText("Passe o mouse sobre um card para ver tudo o que vem nele").closest(".hover-hint");
    expect(dica).toHaveClass("so-mouse");
  });

  describe("the plans at the end of the trail, as the guided choice of /plano", () => {
    const medidor = () => screen.getByRole("slider", { name: /lançamentos/ });
    const folha = () => screen.getByRole("region", { name: /O seu plano é o|Vamos combinar/ });
    const arrastarPara = (passo: number) => fireEvent.change(medidor(), { target: { value: String(passo) } });

    it("asks how many entries a month, and starts on the Padrão with its monthly price", () => {
      renderPrecos();
      expect(screen.getByText(/Quantos lançamentos você/)).toBeInTheDocument();
      expect(medidor()).toHaveAttribute("aria-valuetext", "180 lançamentos por mês");
      expect(within(folha()).getByRole("heading", { name: "O seu plano é o Padrão." })).toBeInTheDocument();
      expect(within(folha()).getByText("R$ 79,90")).toBeInTheDocument();
      expect(within(folha()).getByText("14 dias grátis, sem cartão")).toBeInTheDocument();
    });

    it("lights the mark of the plan for the volume, on the same four marks as the ruler", () => {
      const { container } = renderPrecos();
      const marcas = () => [...container.querySelectorAll(".regua-mede-marcas span")];
      expect(marcas().map((m) => m.textContent)).toEqual(["100", "200", "350", "5.000+"]);
      expect(marcas().filter((m) => m.hasAttribute("data-acesa")).map((m) => m.textContent)).toEqual(["200"]);
      arrastarPara(3);
      expect(within(folha()).getByRole("heading", { name: "O seu plano é o Essencial." })).toBeInTheDocument();
      expect(marcas().filter((m) => m.hasAttribute("data-acesa")).map((m) => m.textContent)).toEqual(["100"]);
    });

    it("over 350, the plan is agreed with the team, by e-mail", () => {
      renderPrecos();
      arrastarPara(10);
      expect(within(folha()).getByRole("heading", { name: "Vamos combinar juntos." })).toBeInTheDocument();
      expect(within(folha()).getByRole("link", { name: "Fale com a gente" }).getAttribute("href")).toMatch(/^mailto:ledgrtech@gmail\.com/);
      // sem preço de tabela: o Escala não está entre os planos do teste
      expect(folha().textContent).not.toContain("R$");
    });

    it("starting keeps the plan for /plano and goes to the signup", () => {
      sessionStorage.clear();
      renderPrecos();
      const comecar = within(folha()).getByRole("link", { name: "Começar com o Padrão" });
      expect(comecar).toHaveAttribute("href", "/cadastro");
      fireEvent.click(comecar);
      expect(sessionStorage.getItem("ledgr:plano-escolhido")).toBe("padrao");
    });
  });

  describe("the vertical trail", () => {
    it("draws one wavy line beside the cards, outside the list, hidden from screen readers", () => {
      renderPrecos();
      const fios = document.querySelectorAll(".preco-fio");
      expect(fios).toHaveLength(1);
      expect(fios[0].parentElement).toHaveClass("preco-percurso");
      expect(fios[0]).toHaveAttribute("aria-hidden", "true");
    });

    // com movimento reduzido (ou sem JavaScript), o globals.css mostra o fio inteiro por cima do recorte
    it("starts with the line undrawn, to be drawn as the page scrolls", () => {
      renderPrecos();
      expect(document.querySelector<HTMLElement>(".preco-fio")!.style.clipPath).toBe("inset(0 0 100% 0)");
    });

    it("keeps the sticky title in a box that ends with the cards, so it stops before the plan ruler", () => {
      renderPrecos();
      // o sticky anda dentro do pai: se o pai tiver a régua, o título desce por cima dela
      const topo = screen.getByRole("heading", { name: "Preço fechado, por volume." }).closest(".preco-topo")!;
      expect(topo.parentElement!.contains(regua())).toBe(false);
    });
  });
});
