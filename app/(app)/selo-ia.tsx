import { Sparkles } from "lucide-react";

/**
 * O selo do texto escrito pela IA, em cima da explicação: neutro, nunca dourado, porque a IA
 * explica e quem decide é quem concilia (DESIGN.md). Os Termos prometem que essas explicações
 * "vêm marcadas como 'Gerada por IA'". Vai no detalhe da linha, no cartão do hover e na
 * demonstração da landing.
 */
export function SeloIa() {
  return (
    <span className="selo explicacao-selo">
      <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
      Gerada por IA · confira antes de decidir
    </span>
  );
}
