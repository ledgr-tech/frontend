import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvedorDaColuna, ColunaAgora, useColuna } from "../coluna/coluna";
import { AgoraDaVisaoGeral } from "./agora";
import { passosDoRoteiro } from "./roteiro";

vi.mock("next/navigation", () => ({ usePathname: () => "/visao-geral" }));
// as preferências ainda não chegaram: a faixa não mostra nada, e o Agora também não
vi.mock("../conta", () => ({ usePreferencias: () => ({ carregado: false, roteiroDispensado: false }) }));

function Espia() {
  return <span data-testid="pendente">{String(useColuna().pendente)}</span>;
}

describe("AgoraDaVisaoGeral", () => {
  it("does not show the step before the preferences load, so a dismissed roteiro does not flash", () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
    const proximo = passosDoRoteiro({
      toleranciaRevisada: false,
      temExtratoDoBanco: false,
      conciliou: false,
      resolveuAlguma: false,
      fechouAlgum: false,
      conciliacaoComPendencia: null,
    }).find((passo) => !passo.feito)!;
    render(
      <ProvedorDaColuna>
        <ColunaAgora />
        <Espia />
        <AgoraDaVisaoGeral proximo={proximo} pendente={null} />
      </ProvedorDaColuna>,
    );

    expect(screen.queryByText(proximo.titulo)).not.toBeInTheDocument();
    expect(screen.queryByText("Tudo em dia")).not.toBeInTheDocument();
    expect(screen.getByTestId("pendente")).toHaveTextContent("false");
  });
});
