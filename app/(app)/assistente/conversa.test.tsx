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

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
    push.mockReset();
  });

  it("opens with the month in one sentence, from the real numbers", () => {
    render(<Conversa contexto={CONTEXTO} />);
    expect(conversa()).toHaveTextContent(
      "Setembro está 70,0% conciliado. Sobraram 42 linhas para revisar, a maior parte em “Sem correspondência no banco”.",
    );
    expect(screen.getByText("olhando setembro agora")).toBeInTheDocument();
  });

  it("answers a suggested question right away, with a way to the screen that has the detail", async () => {
    const user = userEvent.setup();
    render(<Conversa contexto={CONTEXTO} />);

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
    render(<Conversa contexto={CONTEXTO} />);

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
    render(<Conversa contexto={CONTEXTO} />);

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
    render(<Conversa contexto={CONTEXTO} />);

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
    render(<Conversa contexto={CONTEXTO} />);

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
    render(<Conversa contexto={CONTEXTO} />);

    await user.click(screen.getByRole("button", { name: "Explique a maior divergência" }));

    await within(conversa()).findByText(/<img src=x onerror=alert\(1\)>/);
    expect(conversa().querySelector("img[src='x']")).toBeNull();
  });
});
