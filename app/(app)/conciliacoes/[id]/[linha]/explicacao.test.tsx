import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Explicacao, Resultado } from "../../acoes";
import { ExplicacaoDaDivergencia } from "./explicacao";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const explicarDivergencia = vi.fn<(id: string) => Promise<Resultado<Explicacao>>>();
vi.mock("../../acoes", () => ({
  explicarDivergencia: (id: string) => explicarDivergencia(id),
}));

const LINHA = "6f55ff77-7794-4079-8186-ba17414abbe6";
const VOLTAR = "/conciliacoes/banco-1?sistema=sistema-1";
const TEXTO_IA =
  "O lançamento foi classificado como divergência porque há lançamentos do outro lado na mesma data, mas nenhum coincide em valor.";
const TEXTO_MOTOR = "Existe um lançamento do outro lado na mesma data, mas o valor não coincide com o deste item.";

function explicacao(parcial: Partial<Explicacao> = {}): Resultado<Explicacao> {
  return { ok: true, dados: { texto: TEXTO_IA, geradaPorIa: true, indisponibilidade: null, ...parcial } };
}

async function pedir() {
  const user = userEvent.setup();
  render(<ExplicacaoDaDivergencia linhaId={LINHA} voltarPara={VOLTAR} />);
  await user.click(screen.getByRole("button", { name: "Explicar esta divergência" }));
  return user;
}

describe("ExplicacaoDaDivergencia", () => {
  beforeEach(() => {
    explicarDivergencia.mockReset();
    push.mockReset();
  });

  it("só pede a explicação no clique: cada geração custa e tem limite diário", () => {
    render(<ExplicacaoDaDivergencia linhaId={LINHA} voltarPara={VOLTAR} />);

    expect(screen.getByRole("button", { name: "Explicar esta divergência" })).toBeInTheDocument();
    expect(explicarDivergencia).not.toHaveBeenCalled();
  });

  it("trava o botão e avisa que pode demorar enquanto a IA responde", async () => {
    explicarDivergencia.mockReturnValue(new Promise(() => {}));
    await pedir();

    expect(explicarDivergencia).toHaveBeenCalledWith(LINHA);
    const botao = screen.getByRole("button", { name: "Explicando…" });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Pode levar alguns segundos.");
  });

  it("rotula o texto da IA e lembra que a decisão é de quem concilia", async () => {
    explicarDivergencia.mockResolvedValue(explicacao());
    await pedir();

    expect(await screen.findByText(TEXTO_IA)).toBeInTheDocument();
    expect(screen.getByText("Gerada por IA · confira antes de decidir")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Explicar/ })).not.toBeInTheDocument();
  });

  it("não rotula como IA o texto fixo do motor", async () => {
    // recurso desligado: é o estado de hoje em produção
    explicarDivergencia.mockResolvedValue(
      explicacao({ texto: TEXTO_MOTOR, geradaPorIa: false, indisponibilidade: "desabilitado" }),
    );
    await pedir();

    expect(await screen.findByText(TEXTO_MOTOR)).toBeInTheDocument();
    expect(screen.queryByText(/Gerada por IA/)).not.toBeInTheDocument();
    // desligado de propósito não é falha: nada de aviso
    expect(screen.queryByText(/texto padrão do Ledgr/)).not.toBeInTheDocument();
  });

  it.each([
    ["limite_diario" as const, "O limite diário de explicações automáticas acabou (volta às 21h)"],
    ["erro_provedor" as const, "A explicação automática não respondeu agora"],
  ])("diz com discrição por que veio o texto padrão (%s)", async (indisponibilidade, aviso) => {
    explicarDivergencia.mockResolvedValue(
      explicacao({ texto: TEXTO_MOTOR, geradaPorIa: false, indisponibilidade }),
    );
    await pedir();

    expect(await screen.findByText(TEXTO_MOTOR)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(aviso.replace(/[()]/g, "\\$&")))).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra o texto como texto, nunca como HTML", async () => {
    // a explicação é gerada a partir de descrições de extrato de terceiro
    explicarDivergencia.mockResolvedValue(explicacao({ texto: "Pagamento <b>urgente</b> <img src=x>" }));
    const { container } = render(<div />);
    await pedir();

    expect(await screen.findByText("Pagamento <b>urgente</b> <img src=x>")).toBeInTheDocument();
    expect(container.ownerDocument.querySelector("b, img[src='x']")).toBeNull();
  });

  it("leva de volta à conciliação quando a linha mudou, em vez de tentar de novo", async () => {
    explicarDivergencia.mockResolvedValue({
      ok: false,
      status: 404,
      erro: "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.",
    });
    await pedir();

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta linha mudou");
    expect(screen.getByRole("link", { name: "Voltar para a conciliação" })).toHaveAttribute("href", VOLTAR);
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("deixa tentar de novo depois de uma falha passageira", async () => {
    explicarDivergencia
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        erro: "A explicação demorou mais que o normal. Tente de novo em instantes.",
      })
      .mockResolvedValueOnce(explicacao());
    const user = await pedir();

    expect(await screen.findByRole("alert")).toHaveTextContent("demorou mais que o normal");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText(TEXTO_IA)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(explicarDivergencia).toHaveBeenCalledTimes(2);
  });

  it("manda a sessão vencida para o login", async () => {
    explicarDivergencia.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await pedir();

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("não fica preso no carregando quando a Server Action lança", async () => {
    // rede caída ou deploy novo no meio: a action nem devolve um Resultado
    explicarDivergencia.mockRejectedValue(new Error("Failed to fetch"));
    await pedir();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível pedir a explicação agora. Tente de novo em instantes.",
    );
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeEnabled();
  });
});
