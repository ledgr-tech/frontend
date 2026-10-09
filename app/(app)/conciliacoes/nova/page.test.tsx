import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss, { type AtRule } from "postcss";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NovaConciliacaoPage from "./page";
import { lerBytes } from "./ler-arquivo";

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

// Um CSV que o backend lê como está; OFX não passa pela checagem, então o
// conteúdo dele não importa aqui.
const CSV_PRONTO = "data;valor;descricao\n2026-09-04;-12604.00;Boleto Aço Norte\n";

// O layout do design que o backend não lê: débito e crédito separados, vírgula decimal.
const CSV_CIGAM = [
  "DT_LANC;HISTORICO;DOC;DEB;CRED",
  "04/09/2026;Boleto Aço Norte;00071;12.604,00;0,00",
  "05/09/2026;Repasse cartão;4471;0,00;7.912,40",
].join("\n");

function arquivo(nome: string, tamanho = 8, conteudo?: string) {
  const corpo = conteudo ?? (nome.endsWith(".csv") ? CSV_PRONTO : "x".repeat(tamanho));
  return new File([corpo], nome, { type: "text/csv" });
}

async function textoEnviado(chamada: number) {
  const [dados] = enviarExtrato.mock.calls[chamada] as [FormData];
  return new TextDecoder().decode(await lerBytes(dados.get("arquivo") as File));
}

function concluido(origem: "banco" | "sistema", erros: { identificador: string; motivo: string }[] = []) {
  return {
    ok: true as const,
    dados: {
      extrato_id: `extrato-${origem}`,
      status: erros.length > 0 ? ("concluido_com_erros" as const) : ("concluido" as const),
      origem,
      quantidade_lancamentos: 3,
      erros,
    },
  };
}

async function enviarOsDois(sistema = arquivo("sistema.csv")) {
  const user = userEvent.setup();
  render(<NovaConciliacaoPage />);
  await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
  await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), sistema);
  await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));
  return user;
}

describe("NovaConciliacaoPage", () => {
  beforeEach(() => {
    push.mockClear();
    enviarExtrato.mockReset();
    situacaoDoExtrato.mockReset();
    conciliar.mockReset();

    enviarExtrato
      .mockResolvedValueOnce({ ok: true, dados: { extratoId: "extrato-banco" } })
      .mockResolvedValueOnce({ ok: true, dados: { extratoId: "extrato-sistema" } });
    situacaoDoExtrato.mockImplementation((id: string) =>
      Promise.resolve(concluido(id === "extrato-banco" ? "banco" : "sistema")),
    );
    conciliar.mockResolvedValue({
      ok: true,
      dados: { extrato_banco_id: "extrato-banco", extrato_sistema_id: "extrato-sistema", total: 3 },
    });
  });

  it("aceita só CSV do sistema de gestão, porque o backend ainda não lê o PDF do ERP", () => {
    render(<NovaConciliacaoPage />);

    expect(screen.getByLabelText("Extrato do sistema de gestão")).toHaveAttribute("accept", ".csv");
    expect(screen.getByText("Arquivo CSV exportado do seu sistema de gestão")).toBeInTheDocument();
    expect(screen.getByLabelText("Extrato do banco")).toHaveAttribute("accept", ".ofx,.csv");
  });

  it("diz a regra de ouro em frases, sem travessão", () => {
    render(<NovaConciliacaoPage />);
    const regra = screen.getByText(/O extrato do banco é sempre a fonte da verdade\./);

    expect(regra).toHaveTextContent(
      "O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como “o sistema diverge do banco”. Se o valor no seu sistema estiver diferente, é ele que precisa de ajuste.",
    );
    expect(regra.textContent).not.toContain("—");
  });

  it("explica o ciclo em três passos antes do envio", () => {
    render(<NovaConciliacaoPage />);
    // um título de seção de verdade, não o rótulo pequeno em caixa alta
    const como = screen.getByRole("heading", { level: 2, name: "Como funciona" }).closest("section") as HTMLElement;

    const passos = within(within(como).getByRole("list")).getAllByRole("listitem");
    expect(passos.map((passo) => passo.querySelector("strong")?.textContent)).toEqual([
      "Envie os dois extratos",
      "Confira e aponte",
      "Corrija no seu sistema e envie de novo",
    ]);
  });

  it("diz que o Ledgr não altera nada, só confere", () => {
    render(<NovaConciliacaoPage />);

    const garantia = screen.getByText(
      "O Ledgr não altera nada no seu banco nem no seu sistema: ele só lê os extratos e confere.",
    );
    // é a frase que mais tranquiliza: vai na faixa em destaque, não junto das notas discretas
    expect(garantia.closest(".nova-nota")).toHaveClass("nova-nota-destaque");
  });

  it("deixa o botão desligado até os dois arquivos estarem escolhidos", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);

    const botao = screen.getByRole("button", { name: "Conciliar extratos" });
    expect(botao).toBeDisabled();
    // o motivo do botão desabilitado fica escrito e ligado a ele
    expect(botao).toHaveAccessibleDescription("Envie os dois extratos para conciliar.");

    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
    expect(botao).toBeDisabled();

    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    expect(botao).toBeEnabled();
    expect(botao).not.toHaveAccessibleDescription();
  });

  it("sobe os dois extratos marcando a origem de cada um", async () => {
    await enviarOsDois();

    await waitFor(() => expect(enviarExtrato).toHaveBeenCalledTimes(2));
    // o campo que trava a integração (issue #20): tem que ir, e com o valor certo
    const [primeiro] = enviarExtrato.mock.calls[0] as [FormData];
    const [segundo] = enviarExtrato.mock.calls[1] as [FormData];
    expect(primeiro.get("origem")).toBe("banco");
    expect((primeiro.get("arquivo") as File).name).toBe("banco.ofx");
    expect(segundo.get("origem")).toBe("sistema");
    expect((segundo.get("arquivo") as File).name).toBe("sistema.csv");
  });

  it("concilia e abre o resultado do par que acabou de conciliar", async () => {
    await enviarOsDois();

    await waitFor(() =>
      expect(conciliar).toHaveBeenCalledWith("extrato-banco", "extrato-sistema"),
    );
    // a listagem parte do extrato do banco, filtrada pelo do sistema: sem o
    // filtro, viriam também as linhas de outros pares daquele extrato do banco
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/conciliacoes/extrato-banco?sistema=extrato-sistema"),
    );
  });

  it("não concilia quando o upload falha, e mostra o motivo", async () => {
    enviarExtrato.mockReset();
    enviarExtrato.mockResolvedValue({
      ok: false,
      status: 429,
      erro: "Muitos envios seguidos. Espere um minuto e tente de novo.",
    });

    await enviarOsDois();

    expect(await screen.findByRole("alert")).toHaveTextContent("Espere um minuto");
    expect(conciliar).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("manda para o login quando a sessão expirou", async () => {
    enviarExtrato.mockReset();
    enviarExtrato.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });

    await enviarOsDois();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("avisa das linhas que o parser não leu, mas segue conciliando", async () => {
    situacaoDoExtrato.mockImplementation((id: string) =>
      Promise.resolve(
        id === "extrato-banco"
          ? concluido("banco", [{ identificador: "L12", motivo: "valor inválido" }])
          : concluido("sistema"),
      ),
    );

    await enviarOsDois();

    expect(
      await screen.findByText("1 linha(s) do extrato do banco não foram lidas."),
    ).toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/conciliacoes/extrato-banco?sistema=extrato-sistema"));
  });

  // 4MB e não os 5MB do backend: o arquivo passa por uma Server Action, e a
  // Vercel corta o corpo da requisição em 4,5MB antes de o backend ver qualquer coisa
  it("barra arquivo acima de 4MB antes de gastar uma requisição", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);
    await user.upload(
      screen.getByLabelText("Extrato do banco"),
      arquivo("gigante.ofx", 4 * 1024 * 1024 + 1),
    );
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("passa de 4MB");
    expect(enviarExtrato).not.toHaveBeenCalled();
  });

  it("aceita arquivo de exatamente 4MB", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);
    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("limite.ofx", 4 * 1024 * 1024));
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));

    await waitFor(() => expect(enviarExtrato).toHaveBeenCalledTimes(2));
  });

  it("volta ao início com um recado quando o envio nem chega ao servidor", async () => {
    // a Server Action lança em vez de devolver Resultado: corpo grande demais,
    // rede caída ou deploy novo no meio ("Failed to find Server Action")
    enviarExtrato.mockReset();
    enviarExtrato.mockRejectedValue(new Error("Body exceeded 1 MB limit"));

    await enviarOsDois();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar agora. Recarregue a página e tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Conciliar extratos" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("também se recupera quando a conciliação lança no meio do caminho", async () => {
    conciliar.mockRejectedValue(new Error("Failed to fetch"));

    await enviarOsDois();

    expect(await screen.findByRole("alert")).toHaveTextContent("Recarregue a página");
    expect(screen.getByRole("button", { name: "Conciliar extratos" })).toBeEnabled();
  });

  describe("CSV fora do formato que o backend lê", () => {
    it("para antes de enviar qualquer arquivo e mostra o que não foi reconhecido", async () => {
      await enviarOsDois(arquivo("razao.csv", 0, CSV_CIGAM));

      expect(await screen.findByRole("heading", { name: "Não deu para conciliar" })).toBeInTheDocument();
      expect(screen.getByText(/não tem uma coluna de valor reconhecível/)).toBeInTheDocument();
      expect(enviarExtrato).not.toHaveBeenCalled();
    });

    it("continua de onde parou depois do mapeamento, enviando o arquivo reescrito", async () => {
      const user = await enviarOsDois(arquivo("razao.csv", 0, CSV_CIGAM));

      await user.click(await screen.findByRole("button", { name: "Apontar as colunas" }));
      await user.click(
        within(screen.getByRole("group", { name: "Papel da coluna DEB" })).getByRole("button", { name: "Valor" }),
      );
      await user.click(
        within(screen.getByRole("group", { name: "Papel da coluna CRED" })).getByRole("button", { name: "Valor" }),
      );
      await user.click(screen.getByRole("button", { name: "Confirmar mapeamento" }));

      await waitFor(() => expect(enviarExtrato).toHaveBeenCalledTimes(2));
      const [segundo] = enviarExtrato.mock.calls[1] as [FormData];
      expect(segundo.get("origem")).toBe("sistema");
      expect(await textoEnviado(1)).toBe(
        "data;valor;descricao\n2026-09-04;-12604.00;Boleto Aço Norte\n2026-09-05;7912.40;Repasse cartão\n",
      );
      await waitFor(() => expect(push).toHaveBeenCalledWith("/conciliacoes/extrato-banco?sistema=extrato-sistema"));
    });

    it("volta ao formulário sem o arquivo quando a pessoa prefere subir outro", async () => {
      const user = await enviarOsDois(arquivo("razao.csv", 0, CSV_CIGAM));

      await user.click(await screen.findByRole("button", { name: "Subir outro arquivo" }));

      const botao = screen.getByRole("button", { name: "Conciliar extratos" });
      expect(botao).toBeDisabled();
      expect(screen.getByText("Arquivo CSV exportado do seu sistema de gestão")).toBeInTheDocument();
      expect(enviarExtrato).not.toHaveBeenCalled();
    });

    it("sobe como está o CSV que o backend já lê", async () => {
      await enviarOsDois();

      await waitFor(() => expect(enviarExtrato).toHaveBeenCalledTimes(2));
      expect(await textoEnviado(1)).toBe(CSV_PRONTO);
    });

    it("explica o CSV que nem dá para ler como tabela", async () => {
      await enviarOsDois(arquivo("vazio.csv", 0, ""));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        'Não foi possível ler "vazio.csv": O arquivo está vazio.',
      );
      expect(enviarExtrato).not.toHaveBeenCalled();
    });
  });

  describe("o encaixe dos dois extratos", () => {
    const encaixe = () => document.querySelector(".nova-encaixe");

    it("acende o lado de cada extrato quando ele entra, em qualquer ordem", async () => {
      const user = userEvent.setup();
      render(<NovaConciliacaoPage />);
      expect(encaixe()).toHaveAttribute("data-banco", "vazio");
      expect(encaixe()).toHaveAttribute("data-sistema", "vazio");

      await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
      expect(encaixe()).toHaveAttribute("data-sistema", "pronto");
      expect(encaixe()).toHaveAttribute("data-banco", "vazio");

      await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
      expect(encaixe()).toHaveAttribute("data-banco", "pronto");
    });

    it("diz qual extrato falta enquanto só o do banco entrou", async () => {
      const user = userEvent.setup();
      render(<NovaConciliacaoPage />);
      await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));

      expect(screen.getByRole("button", { name: "Conciliar extratos" })).toHaveAccessibleDescription(
        "Falta o extrato do sistema de gestão.",
      );
    });

    it("diz qual extrato falta enquanto só o do sistema entrou", async () => {
      const user = userEvent.setup();
      render(<NovaConciliacaoPage />);
      await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));

      expect(screen.getByRole("button", { name: "Conciliar extratos" })).toHaveAccessibleDescription(
        "Falta o extrato do banco.",
      );
    });

    it("mostra no cartão o arquivo escolhido, com o tamanho e a opção de trocar", async () => {
      const user = userEvent.setup();
      render(<NovaConciliacaoPage />);
      await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx", 2048));

      const banco = screen.getByLabelText("Extrato do banco").closest("label") as HTMLElement;
      expect(within(banco).getByText("banco.ofx")).toBeInTheDocument();
      expect(within(banco).getByText("2 KB")).toBeInTheDocument();
      expect(within(banco).getByText("Trocar arquivo")).toBeInTheDocument();
      // o outro cartão continua pedindo o arquivo
      const sistema = screen.getByLabelText("Extrato do sistema de gestão").closest("label") as HTMLElement;
      expect(within(sistema).queryByText("Trocar arquivo")).not.toBeInTheDocument();
    });

    it("aceita o extrato solto em cima do cartão", () => {
      render(<NovaConciliacaoPage />);
      const banco = screen.getByLabelText("Extrato do banco").closest("label") as HTMLElement;

      fireEvent.drop(banco, { dataTransfer: { files: [arquivo("banco.ofx")] } });

      expect(encaixe()).toHaveAttribute("data-banco", "pronto");
      expect(within(banco).getByText("banco.ofx")).toBeInTheDocument();
    });

    it("recusa o arquivo solto que não é do formato daquele lado", () => {
      render(<NovaConciliacaoPage />);
      const sistema = screen.getByLabelText("Extrato do sistema de gestão").closest("label") as HTMLElement;

      // o accept do input só vale para a janela de escolher; o que é solto chega sem filtro
      fireEvent.drop(sistema, { dataTransfer: { files: [arquivo("lancamentos.pdf")] } });

      expect(screen.getByRole("alert")).toHaveTextContent("O extrato do sistema de gestão precisa ser um arquivo CSV.");
      expect(encaixe()).toHaveAttribute("data-sistema", "vazio");
    });

    it("troca os cartões pelo casamento das linhas enquanto concilia, com a etapa em curso", async () => {
      // a comparação nunca responde: a tela fica parada na última etapa
      conciliar.mockReturnValue(new Promise(() => {}));

      await enviarOsDois();

      expect(await screen.findByText("Etapa 4 de 4")).toBeInTheDocument();
      const casamento = document.querySelector(".nova-casamento") as HTMLElement;
      expect(within(casamento).getByText("banco.ofx")).toBeInTheDocument();
      expect(within(casamento).getByText("sistema.csv")).toBeInTheDocument();
      expect(screen.queryByLabelText("Extrato do banco")).not.toBeInTheDocument();
    });

    it("volta aos cartões cheios num erro, com os dois arquivos mantidos", async () => {
      enviarExtrato.mockReset();
      enviarExtrato.mockResolvedValue({ ok: false, status: 429, erro: "Muitos envios seguidos." });

      await enviarOsDois();

      await screen.findByRole("alert");
      expect(document.querySelector(".nova-casamento")).not.toBeInTheDocument();
      expect(encaixe()).toHaveAttribute("data-banco", "pronto");
      expect(encaixe()).toHaveAttribute("data-sistema", "pronto");
    });
  });

  // o jsdom não pinta nem mede: estas regras do globals.css seguram o que só o navegador mostra
  describe("o estilo do encaixe", () => {
    const css = postcss.parse(readFileSync(join(process.cwd(), "app", "globals.css"), "utf8"));

    /** As declarações do seletor exato dentro da at-rule com estes parâmetros. */
    function dentroDe(nome: string, params: string, seletor: string): Record<string, string> {
      const decl: Record<string, string> = {};
      css.walkRules((regra) => {
        const pai = regra.parent?.type === "atrule" ? (regra.parent as AtRule) : null;
        if (pai?.name !== nome || pai.params !== params) return;
        if (!regra.selector.split(",").some((s) => s.trim().replace(/\s+/g, " ") === seletor)) return;
        regra.walkDecls((d) => {
          decl[d.prop] = d.value;
        });
      });
      return decl;
    }

    it("com movimento reduzido, o cartão enche na hora e as linhas não se mexem", () => {
      const reduzido = "(prefers-reduced-motion: reduce)";
      expect(dentroDe("media", reduzido, ".cartao-arquivo::before")).toMatchObject({ transition: "none" });
      expect(dentroDe("media", reduzido, ".nova-par > *")).toMatchObject({ animation: "none" });
    });

    /** As declarações do seletor exato fora de qualquer at-rule. */
    function solto(seletor: string): Record<string, string> {
      const decl: Record<string, string> = {};
      css.walkRules((regra) => {
        if (regra.parent?.type === "atrule") return;
        if (!regra.selector.split(",").some((s) => s.trim().replace(/\s+/g, " ") === seletor)) return;
        regra.walkDecls((d) => {
          decl[d.prop] = d.value;
        });
      });
      return decl;
    }

    // a ação principal da tela é a única preenchida, e só acende com os dois extratos; o tom escuro
    // do dourado é o que passa no contraste AA com o texto claro, nos dois temas
    it("preenche o botão de conciliar quando ele liga", () => {
      expect(solto(".nova-conciliar:not(:disabled)")).toMatchObject({
        background: "var(--color-accent-700)",
        color: "var(--color-bg)",
      });
    });

    it("põe a garantia de que nada é alterado numa faixa dourada", () => {
      expect(solto(".nova-nota-destaque")["background"]).toContain("var(--color-accent)");
    });

    // estreito, um cartão embaixo do outro, com o elo entre os dois, de pé
    it("empilha os cartões quando não cabem lado a lado", () => {
      const estreito = "nova (max-width: 559px)";
      expect(dentroDe("container", estreito, ".nova-encaixe")).toMatchObject({ "grid-template-columns": "minmax(0, 1fr)" });
      expect(dentroDe("container", estreito, ".nova-elo")).toMatchObject({ "flex-direction": "column" });
    });
  });

  describe("arquivo que o servidor recusa inteiro", () => {
    it("diz que o servidor não leu o arquivo, em vez de só 'não foi possível'", async () => {
      situacaoDoExtrato.mockImplementation((id: string) =>
        Promise.resolve(
          id === "extrato-sistema"
            ? { ok: true, dados: { ...concluido("sistema").dados, status: "erro", erros: [] } }
            : concluido("banco"),
        ),
      );

      await enviarOsDois();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "O servidor não conseguiu ler o extrato do sistema. Confira se é o arquivo certo, exportado em CSV.",
      );
      expect(conciliar).not.toHaveBeenCalled();
    });

    it("cita os formatos do banco quando é o extrato do banco que o servidor não leu", async () => {
      situacaoDoExtrato.mockImplementation((id: string) =>
        Promise.resolve(
          id === "extrato-banco"
            ? { ok: true, dados: { ...concluido("banco").dados, status: "erro", erros: [] } }
            : concluido("sistema"),
        ),
      );

      await enviarOsDois();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "O servidor não conseguiu ler o extrato do banco. Confira se é o arquivo certo, exportado em OFX ou CSV.",
      );
    });

    it("mostra a primeira linha recusada quando nenhuma foi lida", async () => {
      situacaoDoExtrato.mockImplementation((id: string) =>
        Promise.resolve(
          id === "extrato-sistema"
            ? {
                ok: true,
                dados: {
                  ...concluido("sistema").dados,
                  status: "erro",
                  erros: [{ identificador: "2", motivo: "Valor inválido no CSV: 'doze'" }],
                },
              }
            : concluido("banco"),
        ),
      );

      await enviarOsDois();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Nenhuma linha do extrato do sistema pôde ser lida (linha 2: Valor inválido no CSV: 'doze').",
      );
    });
  });
});
