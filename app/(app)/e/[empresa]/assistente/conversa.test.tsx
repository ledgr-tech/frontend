import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import type { Explicacao, Resultado } from "../conciliacoes/acoes";
import { Conversa as ConversaDoLedgr } from "./conversa";
import type { Contexto } from "./respostas";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";

// No teste da demonstração a action também roda, com a rede como fronteira.
const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));

// a explicação é a IA do backend; aqui a action devolve o que ele responderia
const explicarDivergencia = vi.fn<(id: string) => Promise<Resultado<Explicacao>>>();
vi.mock("../conciliacoes/acoes", () => ({
  explicarDivergencia: (id: string) => explicarDivergencia(id),
}));

// o backend responde dúvidas de uso e consultas sobre os números (#137/#223)
const perguntarAoAssistente = vi.fn();
const atualizarContexto = vi.fn<(contexto: Contexto | null) => Promise<Resultado<Contexto | null>>>();
vi.mock("./acoes", () => ({
  perguntarAoAssistente: (...args: unknown[]) => perguntarAoAssistente(...args),
}));

const push = vi.fn();
const caminho = vi.hoisted(() => ({ atual: "/e/3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20/fechamentos" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => caminho.atual }));

const CONTEXTO: Contexto = {
  mes: "setembro",
  Mes: "Setembro",
  processados: 140,
  batidos: 98,
  taxa: 70,
  divergentes: 42,
  valorAberto: 14398,
  grupos: [
    { rotulo: "Sem correspondência no banco", tom: "atencao", quantidade: 28, valor: 9478, href: "/conciliacoes/b/l1?sistema=s" },
    { rotulo: "Tarifa bancária", tom: "neutro", quantidade: 14, valor: 4920, href: "/conciliacoes/b/l2?sistema=s" },
  ],
  naoLidas: [],
  caminho: "/conciliacoes/b?sistema=s",
  maior: {
    id: "l1",
    descricao: "PIX RECEBIDO CLIENTE",
    rotulo: "Sem correspondência no banco",
    valor: 923.2,
    href: "/conciliacoes/b/l1?sistema=s",
  },
};

function conversa() {
  return screen.getByRole("log", { name: "Conversa com o Ledgr" });
}

function Conversa(props: Omit<ComponentProps<typeof ConversaDoLedgr>, "atualizarContexto">) {
  return <ConversaDoLedgr {...props} atualizarContexto={() => atualizarContexto(props.contexto)} />;
}

describe("Conversa", () => {
  beforeEach(() => {
    explicarDivergencia.mockReset();
    perguntarAoAssistente.mockReset().mockResolvedValue({ ok: false, status: 503, erro: "Indisponível" });
    atualizarContexto.mockReset().mockImplementation(async (dados) => ({ ok: true, dados }));
    chamarBackend.mockReset();
    emailDaSessao.mockReset().mockResolvedValue("ana@x.com");
    push.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("responde outro mês pelo backend, mostra o selo e abre o link na empresa ativa", async () => {
    const resposta = "Agosto/2026 tem 7 pendências, somando R$ 123,45.";
    perguntarAoAssistente.mockResolvedValue({ ok: true, dados: {
      resposta, respondida: true, links: [{ titulo: "Ver agosto", caminho: "/historico", tipo: "tela" }],
    } });
    const empresa = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Empresa", cnpj: "" };
    const onFechar = vi.fn();
    const user = userEvent.setup();
    render(<ProvedorDaEmpresa ativa={empresa} empresas={[empresa]}><Conversa contexto={CONTEXTO} onFechar={onFechar} /></ProvedorDaEmpresa>);

    await user.type(screen.getByLabelText("Sua pergunta"), "e agosto?{Enter}");
    const bolha = (await within(conversa()).findByText(resposta)).closest(".asst-bolha")!;
    expect(bolha).toHaveTextContent("Gerada por IA · confira antes de decidir");
    expect(conversa()).not.toHaveTextContent("Por enquanto eu leio só");
    expect(atualizarContexto).not.toHaveBeenCalled();
    const link = within(conversa()).getByRole("link", { name: "Ver agosto" });
    expect(link).toHaveAttribute("href", `/e/${empresa.id}/historico`);

    await user.click(link);
    expect(onFechar).toHaveBeenCalledOnce();
    await user.type(screen.getByLabelText("Sua pergunta"), "e julho?{Enter}");
    expect(perguntarAoAssistente).toHaveBeenLastCalledWith("e julho?", "fechamentos", [
      { papel: "usuario", texto: "e agosto?" }, { papel: "assistente", texto: resposta },
    ]);
  });

  it.each([
    { ok: false, status: 503, erro: "Indisponível" },
    { ok: false, status: 404, erro: "Rota ausente" },
    { ok: true, dados: { resposta: "Não sei responder.", respondida: false, links: [] } },
  ])("volta ao roteiro do mês quando o backend não responde: %j", async (resposta) => {
    perguntarAoAssistente.mockResolvedValue(resposta);
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Resumo de setembro" }));

    expect(await within(conversa()).findByText(/^Setembro: 140 lançamentos/)).toBeInTheDocument();
    expect(atualizarContexto).toHaveBeenCalledOnce();
    expect(conversa()).not.toHaveTextContent("Não sei responder.");
    expect(within(conversa()).queryByText("Gerada por IA · confira antes de decidir")).not.toBeInTheDocument();
  });

  it("a demonstração usa o roteiro sem fazer uma requisição ao backend", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@x.com");
    const action = await vi.importActual<typeof import("./acoes")>("./acoes");
    perguntarAoAssistente.mockImplementationOnce(action.perguntarAoAssistente);
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Resumo de setembro" }));

    expect(await within(conversa()).findByText(/^Setembro: 140 lançamentos/)).toBeInTheDocument();
    expect(chamarBackend).not.toHaveBeenCalled();
    expect(atualizarContexto).toHaveBeenCalledOnce();
  });

  it.each([401, 429])("uma consulta dos números com %s mantém o tratamento do erro", async (status) => {
    perguntarAoAssistente.mockResolvedValue({ ok: false, status, erro: "Limite de perguntas de hoje." });
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Resumo de setembro" }));

    if (status === 401) await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    else expect(await within(conversa()).findByText("Limite de perguntas de hoje.")).toBeInTheDocument();
    expect(atualizarContexto).not.toHaveBeenCalled();
  });

  it("opens with the month in one sentence, from the real numbers", () => {
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    expect(conversa()).toHaveTextContent(
      "Setembro está 70,0% conciliado. Sobraram 42 pendências, a maior parte em “Sem correspondência no banco”.",
    );
    expect(screen.getByRole("heading", { level: 6 })).toHaveTextContent("Assistente · olhando setembro");
    // em 28px, ao lado de cada mensagem, vai só o rosto; o mascote acenando com o balão fica no topo
    const avatares = [...conversa().querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(avatares.length).toBeGreaterThan(0);
    expect(avatares.every((src) => src?.includes("mascote-avatar"))).toBe(true);
    expect(document.querySelector(".asst-topo img")?.getAttribute("src")).toContain("mascote-chatbot");
    // o painel abriu para uma pergunta
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveFocus();
    expect(conversa()).toHaveAttribute("tabindex", "0");
  });

  it("closes from its own header", async () => {
    const onFechar = vi.fn();
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={onFechar} />);

    await user.click(screen.getByRole("button", { name: "Fechar conversa" }));
    expect(onFechar).toHaveBeenCalledOnce();
  });

  it("fecha o painel ao seguir um link da conversa, e digita a resposta antes de mostrar o link", async () => {
    vi.useFakeTimers();
    try {
      const onFechar = vi.fn();
      render(<Conversa contexto={CONTEXTO} onFechar={onFechar} />);
      fireEvent.click(screen.getByRole("button", { name: "O que falta para fechar?" }));
      await act(async () => {});
      act(() => vi.advanceTimersByTime(430));

      // no meio da digitação o texto inteiro já está lá (para o leitor de tela), o resto transparente
      expect(conversa()).toHaveTextContent("Faltam 42 decisões suas.");
      expect(conversa().querySelector("p[data-digitando] .asst-digitado[aria-hidden='true']")).not.toBeNull();
      for (let i = 0; i < 200; i++) act(() => vi.advanceTimersByTime(20));
      expect(conversa().querySelector("[data-digitando]")).toBeNull();

      fireEvent.click(within(conversa()).getByRole("link", { name: "Revisar" }));
      expect(onFechar).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("diz que só lê o mês mais recente quando a pergunta cita outro", async () => {
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Sua pergunta" }), "e agosto?{Enter}");

    expect(await within(conversa()).findByRole("link", { name: "Abrir o Histórico" })).toHaveAttribute("href", "/historico");
    expect(conversa()).toHaveTextContent("Por enquanto eu leio só a conciliação mais recente, a de setembro.");
    expect(perguntarAoAssistente).toHaveBeenCalledWith("e agosto?", "fechamentos", []);
  });

  it("compara o mês citado com o mês recém-lido, não com o da abertura", async () => {
    atualizarContexto.mockResolvedValue({ ok: true, dados: { ...CONTEXTO, mes: "outubro", Mes: "Outubro" } });
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Sua pergunta" }), "e outubro?{Enter}");

    expect(await within(conversa()).findByRole("link", { name: "Abrir a conciliação" })).toBeInTheDocument();
    expect(conversa()).toHaveTextContent("Outubro: 140 lançamentos.");
  });

  it("manda à Central a pergunta de uso que só cita um mês", async () => {
    perguntarAoAssistente.mockResolvedValue({ ok: true, dados: { resposta: "Em Extratos.", respondida: true, links: [] } });
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Sua pergunta" }), "Como envio o extrato de agosto?{Enter}");

    expect(await within(conversa()).findByText("Em Extratos.")).toBeInTheDocument();
    expect(perguntarAoAssistente).toHaveBeenCalledOnce();
  });

  it("mostra a pergunta e a espera antes de publicar a resposta local", async () => {
    vi.useFakeTimers();
    try {
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
      const sugestao = screen.getByRole("button", { name: "O que falta para fechar?" });
      fireEvent.click(sugestao);
      fireEvent.click(sugestao);

      expect(within(conversa()).getAllByText("O que falta para fechar?")).toHaveLength(1);
      expect(within(conversa()).getByRole("status", { name: "O Ledgr está olhando os números" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 6 })).toHaveTextContent("Assistente · olhando os números…");
      await act(async () => {});
      expect(within(conversa()).getByRole("status", { name: "O Ledgr está preparando a resposta" })).toBeInTheDocument();
      expect(conversa()).not.toHaveTextContent("Faltam 42 decisões suas.");

      await act(async () => {});
      act(() => vi.runOnlyPendingTimers());

      expect(conversa()).toHaveTextContent("Faltam 42 decisões suas.");
      expect(within(conversa()).queryByRole("status")).not.toBeInTheDocument();
      expect(within(conversa()).getByRole("link", { name: "Revisar" })).toHaveAttribute("href", "/conciliacoes/b/l1?sistema=s");
      expect(explicarDivergencia).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("mostra a resposta local sem pausa com movimento reduzido", async () => {
    vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: consulta === "(prefers-reduced-motion: reduce)" }));
    try {
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "O que falta para fechar?" })));
      expect(conversa()).toHaveTextContent("Faltam 42 decisões suas.");
      expect(within(conversa()).queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("responde com as pendências atuais, mesmo que a saudação tenha um número anterior", async () => {
    atualizarContexto.mockResolvedValue({ ok: true, dados: { ...CONTEXTO, divergentes: 41 } });
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "O que falta para fechar?" }));
    expect(await within(conversa()).findByText(/^Faltam 41 decisões suas/)).toBeInTheDocument();
    expect(atualizarContexto).toHaveBeenCalledOnce();
    expect(perguntarAoAssistente).toHaveBeenCalledOnce();
  });

  it("avisa quando não consegue atualizar o mês", async () => {
    atualizarContexto.mockResolvedValue({ ok: false, status: 503, erro: "indisponível" });
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "O que falta para fechar?" }));
    expect(await within(conversa()).findByText(/^Não consegui ler a última conciliação agora/)).toBeInTheDocument();
    expect(conversa()).not.toHaveTextContent("Faltam 42 decisões suas.");
  });

  it.each([CONTEXTO, null])("explica como fechar o mês usando os passos da Central", async (contexto) => {
    const user = userEvent.setup();
    render(<Conversa contexto={contexto} onFechar={vi.fn()} />);
    await user.type(screen.getByLabelText("Sua pergunta"), "Como fecho o mês?{Enter}");
    expect(await within(conversa()).findByText(/Clique em Fechar o mês\./)).toHaveTextContent("escreva a ressalva");
    expect(within(conversa()).getByRole("link", { name: "Fechar o mês" })).toHaveAttribute("href", "/ajuda/fechamentos#fechar");
    expect(atualizarContexto).not.toHaveBeenCalled();
    expect(perguntarAoAssistente).not.toHaveBeenCalled();
  });

  it("answers what is typed, and empties the field", async () => {
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

    const campo = screen.getByRole("textbox", { name: "Sua pergunta" });
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(campo, "e as tarifas?{Enter}");

    expect(await within(conversa()).findByText(/14 tarifas bancárias em setembro/)).toBeInTheDocument();
    expect(campo).toHaveValue("");
  });

  it("asks the backend AI to explain the largest divergence, and labels the text as AI", async () => {
    explicarDivergencia.mockResolvedValue({
      ok: true,
      dados: { texto: "O crédito não tem par no sistema na mesma data.", geradaPorIa: true, indisponibilidade: null },
    });
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));

    expect(explicarDivergencia).toHaveBeenCalledWith("l1");
    expect(perguntarAoAssistente).not.toHaveBeenCalled();
    expect(
      await within(conversa()).findByText(/O crédito não tem par no sistema na mesma data\./),
    ).toHaveTextContent("Sobre “PIX RECEBIDO CLIENTE” (Sem correspondência no banco,");
    expect(within(conversa()).getByText("Gerada por IA · confira antes de decidir")).toBeInTheDocument();
    expect(within(conversa()).getByRole("link", { name: "Abrir a linha" })).toHaveAttribute(
      "href",
      "/conciliacoes/b/l1?sistema=s",
    );
  });

  it("does not label the engine's fixed text as AI", async () => {
    explicarDivergencia.mockResolvedValue({
      ok: true,
      dados: { texto: "Não existe lançamento do outro lado.", geradaPorIa: false, indisponibilidade: "desabilitado" },
    });
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));

    await within(conversa()).findByText(/Não existe lançamento do outro lado\./);
    expect(within(conversa()).queryByText("Gerada por IA · confira antes de decidir")).not.toBeInTheDocument();
  });

  it("says what went wrong when the explanation fails, and sends an expired session to the login", async () => {
    explicarDivergencia.mockResolvedValueOnce({
      ok: false,
      status: 504,
      erro: "A explicação demorou mais que o normal. Tente de novo em instantes.",
    });
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));
    expect(await within(conversa()).findByText(/demorou mais que o normal/)).toBeInTheDocument();

    explicarDivergencia.mockResolvedValueOnce({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("renders what comes back as text, never as HTML", async () => {
    explicarDivergencia.mockResolvedValue({
      ok: true,
      dados: { texto: "<img src=x onerror=alert(1)>", geradaPorIa: true, indisponibilidade: null },
    });
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));

    await within(conversa()).findByText(/<img src=x onerror=alert\(1\)>/);
    expect(conversa().querySelector("img[src='x']")).toBeNull();
  });

  describe("perguntas de uso, ao assistente da Central (#172)", () => {
    const RESPOSTA = {
      ok: true,
      dados: {
        resposta: "1. Abra Empresas.\n2. Na aba Equipe, clique em Convidar pessoa.",
        respondida: true,
        links: [{ titulo: "Convidar alguém", caminho: "/ajuda/empresas#convidar" }],
      },
    };

    it("manda a pergunta que o roteiro não responde, com a tela aberta e as mensagens de antes", async () => {
      perguntarAoAssistente.mockResolvedValue(RESPOSTA);
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.type(screen.getByLabelText("Sua pergunta"), "como convido alguém da equipe?{Enter}");

      // a saudação traz os números do mês: não vai ao provedor
      expect(perguntarAoAssistente).toHaveBeenCalledWith("como convido alguém da equipe?", "fechamentos", []);
      const resposta = await within(conversa()).findByText(/Na aba Equipe, clique em Convidar pessoa/);
      const bolha = resposta.closest(".asst-bolha")!;
      expect(bolha).toHaveTextContent("Gerada por IA");
      expect(within(bolha as HTMLElement).getByRole("link", { name: "Convidar alguém" })).toHaveAttribute("href", "/ajuda/empresas#convidar");
    });

    it("o histórico leva as perguntas ao backend, mas deixa fora as respostas locais e as explicações", async () => {
      perguntarAoAssistente.mockResolvedValue(RESPOSTA).mockResolvedValueOnce({ ok: false, status: 503, erro: "Indisponível" });
      explicarDivergencia.mockResolvedValue({
        ok: true,
        dados: { texto: "Juros de atraso.", geradaPorIa: true, indisponibilidade: null },
      });
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Resumo de setembro" }));
      await within(conversa()).findByText(/^Setembro: 140 lançamentos/);
      await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));
      await within(conversa()).findByText(/Juros de atraso/);
      await user.type(screen.getByLabelText("Sua pergunta"), "como convido alguém?{Enter}");
      await within(conversa()).findByText(/Na aba Equipe/);
      await user.type(screen.getByLabelText("Sua pergunta"), "e depois?{Enter}");

      expect(perguntarAoAssistente).toHaveBeenLastCalledWith("e depois?", "fechamentos", [
        { papel: "usuario", texto: "Resumo de setembro" },
        { papel: "usuario", texto: "como convido alguém?" },
        { papel: "assistente", texto: RESPOSTA.dados.resposta },
      ]);
    });

    it("o que o roteiro do mês responde tenta o backend primeiro", async () => {
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.type(screen.getByLabelText("Sua pergunta"), "Como estão as pendências de R$ 500?{Enter}");

      expect(await within(conversa()).findByText(/^Os R\$.*em aberto/)).toBeInTheDocument();
      expect(perguntarAoAssistente).toHaveBeenCalledWith("Como estão as pendências de R$ 500?", "fechamentos", []);
    });

    it.each(["Como justifico uma divergência?", "Posso fechar o mês com pendências?"])(
      "sem conciliação, %s vai à Central, mesmo citando termos do mês",
      async (pergunta) => {
        perguntarAoAssistente.mockResolvedValue(RESPOSTA);
        const user = userEvent.setup();
        render(<Conversa contexto={null} onFechar={vi.fn()} />);

        await user.type(screen.getByLabelText("Sua pergunta"), `${pergunta}{Enter}`);

        expect(perguntarAoAssistente).toHaveBeenCalledWith(pergunta, "fechamentos", expect.any(Array));
      },
    );

    it.each(["Como ficou o mês?", "Posso fechar o mês?", "O que ficou em aberto?"])(
      "com conciliação, %s tenta o backend e usa o roteiro quando indisponível",
      async (pergunta) => {
        const user = userEvent.setup();
        render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

        await user.type(screen.getByLabelText("Sua pergunta"), `${pergunta}{Enter}`);

        await vi.waitFor(() => expect(atualizarContexto).toHaveBeenCalled());
        expect(perguntarAoAssistente).toHaveBeenCalledWith(pergunta, "fechamentos", []);
      },
    );

    it("sem resposta na Central, oferece a Central inteira", async () => {
      perguntarAoAssistente.mockResolvedValue({
        ok: true,
        dados: { resposta: "Não encontrei isso na Central de ajuda.", respondida: false, links: [] },
      });
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.type(screen.getByLabelText("Sua pergunta"), "como faço um bolo?{Enter}");

      expect(await within(conversa()).findByRole("link", { name: "Abrir a Central de ajuda" })).toHaveAttribute("href", "/ajuda");
    });

    it("com o assistente fora do ar (503), diz o que o roteiro sabe e aponta a Central", async () => {
      perguntarAoAssistente.mockResolvedValue({ ok: false, status: 503, erro: "O assistente está indisponível no momento." });
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.type(screen.getByLabelText("Sua pergunta"), "como convido alguém?{Enter}");

      expect(await within(conversa()).findByText(/^Por enquanto eu respondo sobre setembro/)).toBeInTheDocument();
      expect(within(conversa()).getByRole("link", { name: "Abrir a Central de ajuda" })).toBeInTheDocument();
    });

    it("no limite do dia (429), mostra o texto do backend", async () => {
      perguntarAoAssistente.mockResolvedValue({
        ok: false,
        status: 429,
        erro: "Você chegou ao limite de perguntas de hoje. Tente amanhã ou consulte a Central de ajuda.",
      });
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.type(screen.getByLabelText("Sua pergunta"), "como convido alguém?{Enter}");

      expect(await within(conversa()).findByText(/limite de perguntas de hoje/)).toBeInTheDocument();
    });

    it("sem conciliação, sugere perguntas de uso e encaminha as que não conhece à Central", async () => {
      perguntarAoAssistente.mockResolvedValue(RESPOSTA);
      const user = userEvent.setup();
      render(<Conversa contexto={null} onFechar={vi.fn()} />);

      expect(conversa()).toHaveTextContent("Ainda não há conciliação para eu olhar");
      expect(screen.getByRole("heading", { level: 6 })).toHaveTextContent(/^Assistente$/);
      await user.click(screen.getByRole("button", { name: "Como convido alguém da equipe?" }));

      expect(perguntarAoAssistente).toHaveBeenCalledWith("Como convido alguém da equipe?", "fechamentos", expect.any(Array));
    });

    it("sessão vencida vai ao login", async () => {
      perguntarAoAssistente.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
      const user = userEvent.setup();
      render(<Conversa contexto={null} onFechar={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Como convido alguém da equipe?" }));

      await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    });
  });
});
