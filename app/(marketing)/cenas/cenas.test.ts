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

  it("a comparação informa o saldo do extrato, e a conta fecha com as linhas", () => {
    for (const cena of [cenas.comparacao, cenas.comparacaoJustificada]) {
      expect(cena).toMatch(/Saldo inicial/);
      expect(cena).toMatch(/20\.000,00/);
      expect(cena).toMatch(/37\.017,00/);
      expect(cena).not.toMatch(/Saldo não informado/);
    }
    // 20.000,00 + as 15 linhas do banco de exemplo (17.017,00) = 37.017,00
    expect(20000 + 17017).toBe(37017);
  });

  it("o cartão, a janela e a barra de cima vêm à parte", () => {
    expect(cenas.cartaoDoHover).toContain("cartao-lancamento");
    expect(cenas.cartaoDoHover).toMatch(/Gerada por IA/);
    // nenhuma cena guarda um cartão aberto (ficaria preso por cima da tela depois de justificar)
    for (const cena of [cenas.novaVazia, cenas.novaBanco, cenas.novaPronta, cenas.comparando, cenas.comparacao, cenas.comparacaoJustificada, cenas.fechamentos]) {
      expect(cena).not.toContain("cartao-lancamento");
    }
    expect(cenas.janelaDeJustificativa).toContain("{{TEXTO}}");
    expect(cenas.janelaDeJustificativa).toMatch(/Justificar/);
    // como o app: os dois valores da linha e a explicação com o selo da IA
    expect(cenas.janelaDeJustificativa).toMatch(/3\.200,00/);
    expect(cenas.janelaDeJustificativa).toMatch(/3\.020,00/);
    expect(cenas.janelaDeJustificativa).toMatch(/Gerada por IA/);
    expect(cenas.barraDeCima).toContain("falta 1 dia");
  });

  it("não leva script nem endereço de outra tela do app", () => {
    for (const html of Object.values(cenas).filter((v) => typeof v === "string")) {
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/href="\/e\//);
    }
  });
});
