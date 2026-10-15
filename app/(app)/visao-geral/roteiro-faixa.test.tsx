import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaConta } from "../conta";
import { RoteiroFaixa } from "./roteiro-faixa";
import { passosDoRoteiro } from "./roteiro";

vi.mock("../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

const NADA = {
  toleranciaRevisada: false,
  temExtratoDoBanco: false,
  conciliou: false,
  resolveuAlguma: false,
  fechouAlgum: false,
  conciliacaoComPendencia: null,
};

function montar(passos = passosDoRoteiro(NADA)) {
  return render(
    <ProvedorDaConta preferencias={null}>
      <RoteiroFaixa passos={passos} alternativa={<p>sem roteiro</p>} />
    </ProvedorDaConta>,
  );
}

describe("RoteiroFaixa", () => {
  beforeEach(() => window.localStorage.clear());

  it("mostra os seis passos, o progresso e o próximo passo em destaque", async () => {
    montar();
    expect(await screen.findByRole("heading", { name: "Primeiros passos" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Primeiros passos feitos" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("1 de 6")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Definir agora" })).toBeInTheDocument();
    expect(screen.getByText("Escolher o plano").closest("li")).toHaveTextContent("(feito)");
  });

  it("Definir agora abre as Configurações na seção Conciliação", async () => {
    const ouvinte = vi.fn();
    window.addEventListener("ledgr:abrir-configuracoes", ouvinte);
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: "Definir agora" }));
    expect((ouvinte.mock.calls[0][0] as CustomEvent).detail).toEqual({ secao: "conciliacao" });
    window.removeEventListener("ledgr:abrir-configuracoes", ouvinte);
  });

  it("o próximo passo com link leva à tela dele", async () => {
    montar(passosDoRoteiro({ ...NADA, toleranciaRevisada: true }));
    const passo = (await screen.findByText("Enviar o extrato do banco")).closest("li")!;
    expect(within(passo).getByRole("link", { name: "Fazer agora" })).toHaveAttribute("href", "/conciliacoes/nova");
  });

  it("Já sei usar troca pela alternativa e não volta", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    await user.click(await screen.findByRole("button", { name: "Já sei usar" }));
    expect(screen.getByText("sem roteiro")).toBeInTheDocument();
    unmount();
    montar();
    await waitFor(() => expect(screen.getByText("sem roteiro")).toBeInTheDocument());
  });
});
