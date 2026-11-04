import { describe, expect, it } from "vitest";
import * as cenas from "./index";

// as telas do mockup do vídeo são capturas do app: se uma nova captura perder uma delas, o roteiro
// (mockup-demo.tsx) não acha o alvo do cursor e o vídeo trava sem erro
describe("cenas do mockup", () => {
  it("cada tela tem o que o roteiro procura", () => {
    expect(cenas.novaVazia).toContain("nova-folha-banco");
    expect(cenas.novaBanco).toContain("nova-folha-sistema");
    expect(cenas.novaPronta).toMatch(/Conciliar extratos/);
    expect(cenas.comparando).toMatch(/Comparando banco e sistema/);
    expect(cenas.comparacao).toMatch(/09\/07/);
    expect(cenas.comparacao).toMatch(/PIX ENVIA/);
    expect(cenas.comparacao).toMatch(/BOLETO FORNECEDOR GAMA/);
    expect(cenas.comparacaoJustificada).toMatch(/Justificadas \(1\)/);
    expect(cenas.fechamentos).toMatch(/Fechamentos/);
  });

  it("o cartão, a janela e a barra de cima vêm à parte", () => {
    expect(cenas.cartaoDoHover).toContain("cartao-lancamento");
    expect(cenas.comparacao).not.toContain("cartao-lancamento ");
    expect(cenas.janelaDeJustificativa).toContain("{{TEXTO}}");
    expect(cenas.janelaDeJustificativa).toMatch(/Justificar/);
    expect(cenas.barraDeCima).toContain("falta 1 dia");
  });

  it("não leva script nem endereço de outra tela do app", () => {
    for (const html of Object.values(cenas).filter((v) => typeof v === "string")) {
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/href="\/e\//);
    }
  });
});
