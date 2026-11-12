import { describe, expect, it } from "vitest";
import * as cenas from "./index";

const telas = Object.entries(cenas).filter(([nome]) => nome !== "TEXTO_DA_JUSTIFICATIVA");

// as telas do mockup de "Por dentro" são gravadas do app (gravar.mjs --landing): se uma gravação nova perder
// uma marca, o roteiro (mockup-demo.tsx) não acha o alvo do cursor e a animação trava sem erro
describe("cenas do mockup", () => {
  it("cada tela tem o que o roteiro procura", () => {
    expect(cenas.novaVazia).toContain('data-mockup="banco"');
    expect(cenas.novaBanco).toContain('data-mockup="sistema"');
    expect(cenas.novaPronta).toContain('data-mockup="conciliar"');
    expect(cenas.comparando).toMatch(/Comparando banco e sistema/);
    expect(cenas.comparacao).toContain('data-mockup="linha"');
    expect(cenas.comparacaoFoco).toContain('data-mockup="justificar"');
    expect(cenas.justificando).toContain('data-mockup="enviar"');
    // a justificativa é digitada no lugar da marca
    expect(cenas.justificando).toContain("{{TEXTO}}");
    expect(cenas.comparacaoJustificada).toMatch(/Justificadas \(1\)/);
    expect(cenas.comparacaoJustificada).toContain(cenas.TEXTO_DA_JUSTIFICATIVA);
    expect(cenas.fechamentos).toMatch(/Fechamentos/);
  });

  it("o painel explica a divergência como no lançamento, com o selo da IA, e mostra o saldo do extrato", () => {
    for (const cena of [cenas.comparacaoFoco, cenas.comparacaoJustificada]) {
      expect(cena).toMatch(/Gerada por IA/);
      expect(cena).toMatch(/Os dígitos 7 e 5 parecem trocados/);
      expect(cena).toMatch(/Saldo final/);
      expect(cena).toMatch(/64\.600,00/);
    }
  });

  it("só o conteúdo das telas: sem o menu, a barra de cima, o texto de teste do backend-fake, script ou endereço do app", () => {
    for (const [, html] of telas) {
      expect(html).not.toMatch(/app-aside|app-topo|backend fake|<noscript|<script/i);
      expect(html).not.toMatch(/href="\/e\//);
    }
  });
});
