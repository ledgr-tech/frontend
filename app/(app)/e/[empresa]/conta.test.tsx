import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ProvedorDaConta, useEmail, useLimites, usePreferencias, useTemSenha } from "./conta";

const salvarPreferencias = vi.fn<(p: unknown) => Promise<boolean>>(async () => true);
vi.mock("../../../(auth)/acoes", () => ({ salvarPreferencias: (p: unknown) => salvarPreferencias(p) }));

function Sonda() {
  const p = usePreferencias();
  return (
    <div>
      <span>{p.carregado ? "carregado" : "carregando"}</span>
      <span>{p.tutorialDispensado("extratos") ? "extratos dispensado" : "extratos ativo"}</span>
      <span>{p.roteiroDispensado ? "roteiro dispensado" : "roteiro ativo"}</span>
      <button onClick={() => p.dispensarTutorial("extratos")}>dispensar tutorial</button>
      <button onClick={() => p.dispensarRoteiro()}>dispensar roteiro</button>
    </div>
  );
}

function SondaDosLimites() {
  const limites = useLimites();
  return <span>{limites ? `empresas ${limites.empresas?.usadas}/${limites.empresas?.maximo}` : "sem limites"}</span>;
}

describe("a conta tem senha?", () => {
  it("o provedor entrega o temSenha; sem ele, e fora do provedor, é verdadeiro (a conta única antiga tinha senha)", () => {
    function Sonda() {
      return <span>{useTemSenha() ? "com senha" : "só Google"}</span>;
    }
    const { unmount } = render(
      <ProvedorDaConta preferencias={null} temSenha={false}>
        <Sonda />
      </ProvedorDaConta>,
    );
    expect(screen.getByText("só Google")).toBeInTheDocument();
    unmount();
    render(
      <ProvedorDaConta preferencias={null}>
        <Sonda />
      </ProvedorDaConta>,
    );
    expect(screen.getByText("com senha")).toBeInTheDocument();
    render(<Sonda />);
    expect(screen.getAllByText("com senha")).toHaveLength(2);
  });
});

describe("o e-mail de quem está logado", () => {
  it("o provedor o entrega; sem ele, e fora do provedor, é vazio", () => {
    function Sonda() {
      return <span>{`[${useEmail()}]`}</span>;
    }
    const { unmount } = render(
      <ProvedorDaConta preferencias={null} email="ana@x.com">
        <Sonda />
      </ProvedorDaConta>,
    );
    expect(screen.getByText("[ana@x.com]")).toBeInTheDocument();
    unmount();
    render(<Sonda />);
    expect(screen.getByText("[]")).toBeInTheDocument();
  });
});

describe("limites do plano", () => {
  it("o provedor os entrega, e sem eles (ou fora do provedor) é null", () => {
    const { unmount } = render(
      <ProvedorDaConta preferencias={null} limites={{ empresas: { usadas: 2, maximo: 3 }, usuarios: null }}>
        <SondaDosLimites />
      </ProvedorDaConta>,
    );
    expect(screen.getByText("empresas 2/3")).toBeInTheDocument();
    unmount();

    render(
      <ProvedorDaConta preferencias={null}>
        <SondaDosLimites />
      </ProvedorDaConta>,
    );
    expect(screen.getByText("sem limites")).toBeInTheDocument();
    render(<SondaDosLimites />);
    expect(screen.getAllByText("sem limites")).toHaveLength(2);
  });
});

describe("ProvedorDaConta", () => {
  beforeEach(() => {
    window.localStorage.clear();
    salvarPreferencias.mockClear();
  });

  it("junta o que veio da conta com o navegador", async () => {
    window.localStorage.setItem(
      "ledgr:preferencias",
      JSON.stringify({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false }),
    );
    render(
      <ProvedorDaConta preferencias={{ tutoriaisDispensados: [], roteiroDispensado: true }}>
        <Sonda />
      </ProvedorDaConta>,
    );
    await waitFor(() => expect(screen.getByText("carregado")).toBeInTheDocument());
    expect(screen.getByText("extratos dispensado")).toBeInTheDocument();
    expect(screen.getByText("roteiro dispensado")).toBeInTheDocument();
  });

  it("dispensar guarda no navegador e manda para a conta, uma vez", async () => {
    render(
      <ProvedorDaConta preferencias={null}>
        <Sonda />
      </ProvedorDaConta>,
    );
    await waitFor(() => expect(screen.getByText("carregado")).toBeInTheDocument());
    await act(async () => screen.getByText("dispensar tutorial").click());
    expect(screen.getByText("extratos dispensado")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("ledgr:preferencias")!).tutoriaisDispensados).toEqual(["extratos"]);
    expect(salvarPreferencias).toHaveBeenCalledTimes(1);
    expect(salvarPreferencias).toHaveBeenCalledWith({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false });

    await act(async () => screen.getByText("dispensar roteiro").click());
    expect(screen.getByText("roteiro dispensado")).toBeInTheDocument();
    expect(salvarPreferencias).toHaveBeenLastCalledWith({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
  });
});
