import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Explicacao, Resultado } from "../conciliacoes/acoes";
import { Conversa } from "./conversa";
import type { Contexto } from "./respostas";

// a explicação é a IA do backend; aqui a action devolve o que ele responderia
const explicarDivergencia = vi.fn<(id: string) => Promise<Resultado<Explicacao>>>();
vi.mock("../conciliacoes/acoes", () => ({
  explicarDivergencia: (id: string) => explicarDivergencia(id),
}));

// o que o roteiro do mês não responde vai ao assistente da Central (backend #137)
const perguntarAoAssistente = vi.fn();
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

describe("Conversa", () => {
  beforeEach(() => {
    explicarDivergencia.mockReset();
    perguntarAoAssistente.mockReset();
    push.mockReset();
  });

  it("opens with the month in one sentence, from the real numbers", () => {
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);
    expect(conversa()).toHaveTextContent(
      "Setembro está 70,0% conciliado. Sobraram 42 linhas para revisar, a maior parte em “Sem correspondência no banco”.",
    );
    expect(screen.getByRole("heading", { level: 6 })).toHaveTextContent("Assistente · olhando setembro");
    // em 28px, ao lado de cada mensagem, vai só o rosto; o mascote acenando com o balão fica no topo
    const avatares = [...conversa().querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(avatares.length).toBeGreaterThan(0);
    expect(avatares.every((src) => src?.includes("mascote-avatar"))).toBe(true);
    expect(document.querySelector(".asst-topo img")?.getAttribute("src")).toContain("mascote-chatbot");
    // o painel abriu para uma pergunta
    expect(screen.getByRole("textbox", { name: "Sua pergunta" })).toHaveFocus();
  });

  it("closes from its own header", async () => {
    const onFechar = vi.fn();
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={onFechar} />);

    await user.click(screen.getByRole("button", { name: "Fechar conversa" }));
    expect(onFechar).toHaveBeenCalledOnce();
  });

  it("answers a suggested question right away, with a way to the screen that has the detail", async () => {
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "O que falta para fechar?" }));

    expect(within(conversa()).getByText("O que falta para fechar?")).toBeInTheDocument();
    expect(conversa()).toHaveTextContent("Faltam 42 decisões suas.");
    expect(within(conversa()).getByRole("link", { name: "Revisar" })).toHaveAttribute(
      "href",
      "/conciliacoes/b/l1?sistema=s",
    );
    expect(explicarDivergencia).not.toHaveBeenCalled();
  });

  it("answers what is typed, and empties the field", async () => {
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

    const campo = screen.getByRole("textbox", { name: "Sua pergunta" });
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(campo, "e as tarifas?{Enter}");

    expect(conversa()).toHaveTextContent("14 tarifas bancárias em setembro");
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

    it("o histórico leva só a conversa com a Central, nunca os números do mês nem as explicações", async () => {
      perguntarAoAssistente.mockResolvedValue(RESPOSTA);
      explicarDivergencia.mockResolvedValue({
        ok: true,
        dados: { texto: "Juros de atraso.", geradaPorIa: true, indisponibilidade: null },
      });
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Resumo de setembro" }));
      await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));
      await within(conversa()).findByText(/Juros de atraso/);
      await user.type(screen.getByLabelText("Sua pergunta"), "como convido alguém?{Enter}");
      await within(conversa()).findByText(/Na aba Equipe/);
      await user.type(screen.getByLabelText("Sua pergunta"), "e depois?{Enter}");

      expect(perguntarAoAssistente).toHaveBeenLastCalledWith("e depois?", "fechamentos", [
        { papel: "usuario", texto: "como convido alguém?" },
        { papel: "assistente", texto: RESPOSTA.dados.resposta },
      ]);
    });

    it("o que o roteiro do mês responde não vai ao backend", async () => {
      const user = userEvent.setup();
      render(<Conversa contexto={CONTEXTO} onFechar={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Resumo de setembro" }));

      expect(perguntarAoAssistente).not.toHaveBeenCalled();
    });

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

    it("sem conciliação, toda pergunta vai à Central, e as sugestões são de uso", async () => {
      perguntarAoAssistente.mockResolvedValue(RESPOSTA);
      const user = userEvent.setup();
      render(<Conversa contexto={null} onFechar={vi.fn()} />);

      expect(conversa()).toHaveTextContent("Ainda não há conciliação para eu olhar");
      expect(screen.getByRole("heading", { level: 6 })).toHaveTextContent(/^Assistente$/);
      await user.click(screen.getByRole("button", { name: "Como fecho o mês?" }));

      expect(perguntarAoAssistente).toHaveBeenCalledWith("Como fecho o mês?", "fechamentos", expect.any(Array));
    });

    it("sessão vencida vai ao login", async () => {
      perguntarAoAssistente.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
      const user = userEvent.setup();
      render(<Conversa contexto={null} onFechar={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Como fecho o mês?" }));

      await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    });
  });
});
