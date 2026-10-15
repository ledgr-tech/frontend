import { PainelLateral } from "../../../painel-lateral";
import { DetalheDivergencia } from "../../[linha]/detalhe";

/** O detalhe da linha aberto pela tabela: no painel, sobre a comparação. */
export default function PainelDaLinha() {
  return (
    <PainelLateral rotulo="Detalhe do lançamento">
      <DetalheDivergencia painel />
    </PainelLateral>
  );
}
