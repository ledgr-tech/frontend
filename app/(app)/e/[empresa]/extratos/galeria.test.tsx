import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ArquivoExtrato } from "../conciliacoes/acoes";
import { Galeria } from "./galeria";
import { ProvedorDaConta } from "../conta";
import type { Papel } from "@/lib/papel";

// conciliar um arquivo já enviado chama a action; aqui ela só responde como o backend
const conciliar = vi.fn();
vi.mock("../conciliacoes/acoes", () => ({
  conciliar: (banco: string, sistema: string) => conciliar(banco, sistema),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function arquivo(parcial: Partial<ArquivoExtrato> & Pick<ArquivoExtrato, "id" | "nome">): ArquivoExtrato {
  return {
    origem: "banco",
    conciliadoEm: "2026-09-24T17:02:11Z",
    resultado: "/conciliacoes/b-set",
    situacao: "concluido",
    lancamentos: 4218,
    naoLidas: 0,
    erros: [],
    competencia: "2026-09",
    enviadoEm: "2026-09-24T16:58:00Z",
    conciliado: true,
    ...parcial,
  };
}

// do envio mais recente para o mais antigo, como a action devolve
const ARQUIVOS: ArquivoExtrato[] = [
  arquivo({ id: "b-set", nome: "sicredi-setembro.ofx" }),
  arquivo({
    id: "s-set",
    nome: "erp-setembro.csv",
    origem: "sistema",
    situacao: "concluido_com_erros",
    lancamentos: 4203,
    naoLidas: 2,
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
    competencia: "2026-08",
  }),
  // enviado e ainda fora de qualquer conciliação: não tem onde abrir
  arquivo({
    id: "s-ago",
    nome: "erp-agosto.csv",
    origem: "sistema",
    conciliadoEm: undefined,
    resultado: undefined,
    conciliado: false,
    competencia: "2026-08",
  }),
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

  it("tags each card with the tone of its situation (the selection itself stays neutral)", () => {
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
    expect(within(cartao("erp-agosto.csv")).getByText("Não conciliado")).toBeInTheDocument();
    expect(cartao("erp-agosto.csv")).toHaveAttribute("data-tom", "neutro");
  });

  it("shows a file still being read without inventing its content", () => {
    render(
      <Galeria
        arquivos={[arquivo({ id: "b-out", nome: "sicredi-outubro.ofx", situacao: "processando", lancamentos: null, competencia: null })]}
      />,
    );
    const lendo = within(cartao("sicredi-outubro.ofx"));
    expect(lendo.getByText("Processando")).toBeInTheDocument();
    expect(lendo.getByText("Conteúdo indisponível")).toBeInTheDocument();
  });

  it("says when a file was sent, and offers no conciliation for one that never entered one", async () => {
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS} />);

    await user.click(cartao("erp-agosto.csv"));

    expect(painel().getByText("Enviado em")).toBeInTheDocument();
    expect(painel().getByText("24/09/2026 13:58")).toBeInTheDocument();
    expect(painel().queryByText("Última conciliação")).not.toBeInTheDocument();
    expect(painel().queryByRole("link")).not.toBeInTheDocument();
  });

  it("counts the unread lines even when their detail did not load", async () => {
    const user = userEvent.setup();
    render(
      <Galeria
        arquivos={[arquivo({ id: "s-set", nome: "erp-setembro.csv", situacao: "concluido_com_erros", naoLidas: 3, erros: [] })]}
      />,
    );

    expect(screen.getByRole("button", { name: "Com problema (1)" })).toBeInTheDocument();
    await user.click(cartao("erp-setembro.csv"));
    expect(painel().getByText("3 linhas não lidas")).toBeInTheDocument();
    expect(painel().queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("calls an older version of the system extrato what it is, and opens its own round", async () => {
    const user = userEvent.setup();
    render(
      <Galeria
        arquivos={[
          arquivo({ id: "b-set", nome: "sicredi-setembro.ofx" }),
          arquivo({
            id: "s-v2",
            nome: "erp-setembro-v2.csv",
            origem: "sistema",
            resultado: "/conciliacoes/b-set?sistema=s-v2",
            rodada: { numero: 2, total: 2 },
          }),
          arquivo({
            id: "s-v1",
            nome: "erp-setembro.csv",
            origem: "sistema",
            resultado: "/conciliacoes/b-set?sistema=s-v1",
            rodada: { numero: 1, total: 2 },
          }),
        ]}
      />,
    );

    expect(within(cartao("erp-setembro-v2.csv")).getByText("Conciliado")).toBeInTheDocument();
    const antiga = cartao("erp-setembro.csv");
    expect(within(antiga).getByText("Versão anterior · rodada 1")).toBeInTheDocument();
    expect(antiga).toHaveAttribute("data-tom", "neutro");

    await user.click(antiga);
    expect(painel().getByText("1 de 2")).toBeInTheDocument();
    expect(painel().getByRole("link", { name: "Ver a rodada 1" })).toHaveAttribute(
      "href",
      "/conciliacoes/b-set?sistema=s-v1",
    );
  });

  it("opens the most recent file in the side panel", () => {
    render(<Galeria arquivos={ARQUIVOS} />);
    expect(cartao("sicredi-setembro.ofx")).toHaveAttribute("aria-pressed", "true");
    expect(painel().getByRole("heading", { name: "sicredi-setembro.ofx" })).toBeInTheDocument();
    expect(painel().getByText("Extrato do banco")).toBeInTheDocument();
    expect(painel().getByText("24/09/2026 14:02")).toBeInTheDocument();
    expect(painel().getByRole("link", { name: "Ver conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/b-set",
    );
  });

  it("mostra o saldo final e a data do extrato do banco, e o aviso quando o arquivo não traz (#118)", async () => {
    const user = userEvent.setup();
    render(
      <Galeria
        arquivos={[
          arquivo({ id: "b-set", nome: "sicredi-setembro.ofx", saldo: { inicial: 750.25, final: -1000, data: "2026-09-10" } }),
          arquivo({ id: "b-ago", nome: "sicredi-agosto.ofx", competencia: "2026-08", saldo: null }),
          arquivo({ id: "b-jul", nome: "sicredi-julho.ofx", competencia: "2026-07" }),
          arquivo({ id: "s-set", nome: "erp-setembro.csv", origem: "sistema", saldo: null }),
        ]}
      />,
    );
    const campo = (rotulo: string) => painel().queryByText(rotulo)?.nextElementSibling?.textContent?.replace(/ /g, " ");

    expect(campo("Saldo final")).toBe("-R$ 1.000,00");
    expect(campo("Data do saldo")).toBe("10/09/2026");

    await user.click(cartao("sicredi-agosto.ofx"));
    expect(campo("Saldo final")).toBe("Não informado no arquivo");
    expect(painel().queryByText("Data do saldo")).not.toBeInTheDocument();

    // sem os campos no backend, e no extrato do sistema, o painel não fala de saldo
    await user.click(cartao("sicredi-julho.ofx"));
    expect(painel().queryByText("Saldo final")).not.toBeInTheDocument();
    await user.click(cartao("erp-setembro.csv"));
    expect(painel().queryByText("Saldo final")).not.toBeInTheDocument();
  });

  it("resume no painel a conciliação do arquivo: quanto bateu, o que pede decisão, o par e o período", () => {
    render(
      <Galeria
        arquivos={[
          arquivo({
            id: "b-set",
            nome: "sicredi-setembro.ofx",
            periodo: { inicio: "2026-09-01", fim: "2026-09-30" },
            ultimaRodada: { com: "erp-setembro.csv", acerto: 85.4, divergencias: 3, justificadas: 1, toleranciaDias: 2 },
          }),
        ]}
      />,
    );
    expect(painel().getByText("85,4%")).toBeInTheDocument();
    expect(painel().getByText(/2 divergências pedem sua decisão · 1 justificada/)).toBeInTheDocument();
    expect(painel().getByText("Período").nextSibling).toHaveTextContent("01/09/2026 a 30/09/2026");
    expect(painel().getByText("Conciliado com").nextSibling).toHaveTextContent("erp-setembro.csv");
    expect(painel().getByText("Tolerância usada").nextSibling).toHaveTextContent("± 2 dias");
  });

  it("diz que nada está pendente quando todas as divergências foram justificadas", () => {
    render(
      <Galeria
        arquivos={[
          arquivo({
            id: "b-set",
            nome: "sicredi-setembro.ofx",
            ultimaRodada: { com: "erp-setembro.csv", acerto: 90, divergencias: 2, justificadas: 2, toleranciaDias: 0 },
          }),
        ]}
      />,
    );
    expect(painel().getByText(/Nada pendente · 2 justificadas/)).toBeInTheDocument();
    expect(painel().getByText("Tolerância usada").nextSibling).toHaveTextContent("Mesmo dia");
  });

  it("sem o resumo da rodada, não inventa resultado nem par", () => {
    render(<Galeria arquivos={ARQUIVOS} />);
    expect(painel().queryByText(/bateu/)).not.toBeInTheDocument();
    expect(painel().queryByText("Conciliado com")).not.toBeInTheDocument();
  });

  it("abre a conciliação com um duplo clique no arquivo", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS} />);
    await user.dblClick(cartao("sicredi-agosto.ofx"));
    expect(push).toHaveBeenCalledWith("/conciliacoes/b-ago");
  });

  it("o duplo clique num arquivo que nunca foi conciliado só o seleciona", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(<Galeria arquivos={ARQUIVOS} />);
    await user.dblClick(cartao("erp-agosto.csv"));
    expect(push).not.toHaveBeenCalled();
    expect(cartao("erp-agosto.csv")).toHaveAttribute("aria-pressed", "true");
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
    render(<Galeria arquivos={ARQUIVOS.filter((item) => item.naoLidas === 0)} />);

    await user.click(screen.getByRole("button", { name: "Com problema (0)" }));

    expect(screen.getByText("Nenhum arquivo com problema.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Arquivo selecionado" })).not.toBeInTheDocument();
  });

  describe("grouping", () => {
    const titulos = () => screen.queryAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent);
    const grupo = (nome: string) => within(screen.getByRole("region", { name: nome }));

    // a escolha fica no navegador entre as visitas; cada teste começa sem nenhuma
    beforeEach(() => window.localStorage.clear());

    it("remembers the chosen grouping on the next visit, like the table density", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<Galeria arquivos={ARQUIVOS} />);

      await user.click(screen.getByRole("button", { name: "Ano" }));
      expect(window.localStorage.getItem("ledgr_extratos_agrupamento")).toBe("ano");
      unmount();

      render(<Galeria arquivos={ARQUIVOS} />);

      expect(await screen.findByRole("button", { name: "Ano" })).toHaveAttribute("aria-pressed", "true");
      expect(titulos()).toEqual(["2026"]);
    });

    it("groups by month when what was saved is not a grouping it knows", () => {
      window.localStorage.setItem("ledgr_extratos_agrupamento", "semana");
      render(<Galeria arquivos={ARQUIVOS} />);

      expect(screen.getByRole("button", { name: "Mês" })).toHaveAttribute("aria-pressed", "true");
    });

    it("groups the files by month by default, the most recent month first", () => {
      render(<Galeria arquivos={ARQUIVOS} />);

      const agrupar = within(screen.getByRole("group", { name: "Agrupar por" }));
      expect(agrupar.getByRole("button", { name: "Mês" })).toHaveAttribute("aria-pressed", "true");
      expect(titulos()).toEqual(["Setembro de 2026", "Agosto de 2026"]);
      expect(grupo("Setembro de 2026").getByText("2 arquivos · 1 com problema")).toBeInTheDocument();
      expect(grupo("Setembro de 2026").getByRole("button", { name: /sicredi-setembro/ })).toBeInTheDocument();
      expect(grupo("Agosto de 2026").getByText("2 arquivos")).toBeInTheDocument();
      expect(grupo("Agosto de 2026").getByRole("button", { name: /sicredi-agosto/ })).toBeInTheDocument();
    });

    it("puts the files without a period yet in a group of their own, after the months", () => {
      render(
        <Galeria
          arquivos={[
            arquivo({ id: "b-out", nome: "sicredi-outubro.ofx", situacao: "processando", lancamentos: null, competencia: null }),
            ...ARQUIVOS,
          ]}
        />,
      );

      expect(titulos()).toEqual(["Setembro de 2026", "Agosto de 2026", "Sem período"]);
      expect(grupo("Sem período").getByRole("button", { name: /sicredi-outubro/ })).toBeInTheDocument();
    });

    it("groups by year when asked", async () => {
      const user = userEvent.setup();
      render(<Galeria arquivos={ARQUIVOS} />);

      await user.click(screen.getByRole("button", { name: "Ano" }));

      expect(titulos()).toEqual(["2026"]);
      expect(grupo("2026").getByText("4 arquivos · 1 com problema")).toBeInTheDocument();
      expect(grupo("2026").getAllByRole("button", { name: /\.(ofx|csv)/ })).toHaveLength(4);
    });

    it("shows the plain gallery when grouping is off", async () => {
      const user = userEvent.setup();
      render(<Galeria arquivos={ARQUIVOS} />);

      await user.click(screen.getByRole("button", { name: "Nenhum" }));

      expect(titulos()).toEqual([]);
      expect(screen.getAllByRole("button", { name: /\.(ofx|csv)/ })).toHaveLength(4);
    });

    it("folds a month from its title", async () => {
      const user = userEvent.setup();
      render(<Galeria arquivos={ARQUIVOS} />);

      const agosto = screen.getByRole("button", { name: "Agosto de 2026" });
      await user.click(agosto);

      expect(agosto).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("button", { name: /sicredi-agosto/ })).not.toBeInTheDocument();
      expect(cartao("sicredi-setembro")).toBeInTheDocument();
    });
  });

  it("does not show the internal id of the file", () => {
    render(<Galeria arquivos={ARQUIVOS} />);
    expect(painel().queryByText("Identificador")).not.toBeInTheDocument();
  });

  describe("a file that never entered a conciliação", () => {
    beforeEach(() => {
      conciliar.mockReset();
      push.mockReset();
    });

    it("offers to conciliate it with a file from the other side, the same month first", async () => {
      const user = userEvent.setup();
      conciliar.mockResolvedValue({ ok: true, dados: {} });
      render(<Galeria arquivos={ARQUIVOS} />);
      await user.click(cartao("erp-agosto.csv"));

      const escolha = painel().getByRole("combobox", { name: "Com o extrato do banco" });
      // o do mesmo mês já vem escolhido
      expect(escolha).toHaveValue("b-ago");
      await user.click(painel().getByRole("button", { name: "Conciliar" }));

      // o banco é sempre o primeiro, seja qual for o arquivo aberto
      expect(conciliar).toHaveBeenCalledWith("b-ago", "s-ago");
      expect(push).toHaveBeenCalledWith("/conciliacoes/b-ago?sistema=s-ago");
    });

    it("teste acabado (402): diz o motivo e leva aos planos", async () => {
      const user = userEvent.setup();
      conciliar.mockResolvedValue({ ok: false, status: 402, erro: "O teste acabou. Escolha um plano para conciliar." });
      render(<Galeria arquivos={ARQUIVOS} />);
      await user.click(cartao("erp-agosto.csv"));
      await user.click(painel().getByRole("button", { name: "Conciliar" }));

      expect(painel().getByRole("alert")).toHaveTextContent("O teste acabou. Escolha um plano para conciliar.");
      expect(painel().getByRole("link", { name: "Ver os planos" })).toHaveAttribute("href", "/plano");
    });

    it("says why when the backend refuses", async () => {
      const user = userEvent.setup();
      conciliar.mockResolvedValue({ ok: false, status: 409, erro: "O mês de agosto está fechado." });
      render(<Galeria arquivos={ARQUIVOS} />);
      await user.click(cartao("erp-agosto.csv"));
      await user.click(painel().getByRole("button", { name: "Conciliar" }));

      expect(painel().getByRole("alert")).toHaveTextContent("O mês de agosto está fechado.");
      expect(push).not.toHaveBeenCalled();
    });

    it("has nothing to offer on a file already conciliated", () => {
      render(<Galeria arquivos={ARQUIVOS} />);
      expect(painel().queryByRole("button", { name: "Conciliar" })).not.toBeInTheDocument();
    });
  });

  describe("o arquivo original (#174, backend #139)", () => {
    const fetchOriginal = vi.fn();
    beforeEach(() => {
      fetchOriginal.mockReset();
      vi.stubGlobal("fetch", fetchOriginal);
      URL.createObjectURL = vi.fn(() => "blob:original");
      URL.revokeObjectURL = vi.fn();
    });

    function comConta(arquivos: ArquivoExtrato[], { papel = "admin", guarda = true }: { papel?: Papel; guarda?: boolean } = {}) {
      return render(
        <ProvedorDaConta preferencias={null} papel={papel} guardaArquivoOriginal={guarda}>
          <Galeria arquivos={arquivos} />
        </ProvedorDaConta>,
      );
    }

    it("com a flag desligada (os dois campos false), não mostra nada", () => {
      comConta([arquivo({ id: "b-set", nome: "sicredi-setembro.ofx", arquivoOriginal: false })], { guarda: false });
      expect(painel().queryByText("Arquivo original")).not.toBeInTheDocument();
      expect(painel().queryByRole("button", { name: "Baixar original" })).not.toBeInTheDocument();
    });

    it("avisa quando a conta guarda o original e este envio não ficou guardado", () => {
      comConta([arquivo({ id: "b-set", nome: "sicredi-setembro.ofx", arquivoOriginal: false })]);
      expect(painel().getByText("Não guardado neste envio")).toBeInTheDocument();
      expect(painel().queryByRole("button", { name: "Baixar original" })).not.toBeInTheDocument();
    });

    it("o analista vê que está guardado, mas não baixa", () => {
      comConta([arquivo({ id: "b-set", nome: "sicredi-setembro.ofx", arquivoOriginal: true })], { papel: "analista" });
      expect(painel().getByText("Guardado")).toBeInTheDocument();
      expect(painel().queryByRole("button", { name: "Baixar original" })).not.toBeInTheDocument();
    });

    it("o gestor baixa com o nome do envio, e o erro do servidor aparece no painel", async () => {
      const user = userEvent.setup();
      comConta([arquivo({ id: "b-set", nome: "sicredi-setembro.ofx", arquivoOriginal: true })], { papel: "gestor" });

      fetchOriginal.mockResolvedValueOnce(new Response(new Blob(["OFX"])));
      await user.click(painel().getByRole("button", { name: "Baixar original" }));
      expect(fetchOriginal).toHaveBeenCalledWith("/api/extratos/b-set/arquivo-original");
      expect(URL.createObjectURL).toHaveBeenCalled();

      fetchOriginal.mockResolvedValueOnce(Response.json({ erro: "Muitos downloads seguidos." }, { status: 429 }));
      await user.click(painel().getByRole("button", { name: "Baixar original" }));
      expect(await painel().findByRole("alert")).toHaveTextContent("Muitos downloads seguidos.");
    });
  });
});
