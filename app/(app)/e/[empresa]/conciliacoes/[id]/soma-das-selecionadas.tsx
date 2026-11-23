import { formatarMoeda } from "@/lib/mock-data";
import { formatarInteiro } from "../../dashboard/resumo";
import type { SomaDasLinhas } from "./selecao";

const reais = (centavos: number) => formatarMoeda(centavos / 100);
const contagem = (quantidade: number) =>
  quantidade === 1 ? "1 linha selecionada" : `${formatarInteiro(quantidade)} linhas selecionadas`;
// a falta vai sem sinal: o sinal fica só no valor da diferença
const desfecho = (soma: SomaDasLinhas) =>
  soma.diferenca === 0 ? "Fecha: a diferença zera" : `Falta ${reais(Math.abs(soma.diferenca))} para zerar`;

/**
 * O que o leitor de tela ouve a cada marcação. A tela põe o texto num role="status" que fica sempre
 * montado: uma região que já nasce com o texto não é anunciada, e a primeira marcação passaria em silêncio.
 */
export function anuncioDaSoma(soma: SomaDasLinhas): string {
  if (soma.quantidade === 0) return "";
  const lado = soma.diferenca === 0 ? "" : ` Sobra no ${soma.diferenca > 0 ? "banco" : "sistema"}.`;
  return `${contagem(soma.quantidade)}. ${desfecho(soma)}.${lado}`;
}

/** Banco, sistema e diferença das linhas selecionadas (#475), no painel ou na faixa da seleção. */
export function SomaDasSelecionadas({ soma }: { soma: SomaDasLinhas }) {
  if (soma.quantidade === 0) return null;

  return (
    <section className="soma-das-selecionadas" aria-label="Soma das selecionadas">
      <p>{contagem(soma.quantidade)}</p>
      <dl>
        <div>
          <dt>Banco</dt>
          <dd>{reais(soma.banco)}</dd>
        </div>
        <div>
          <dt>Sistema</dt>
          <dd>{reais(soma.sistema)}</dd>
        </div>
        <div>
          <dt>Diferença</dt>
          <dd>{reais(soma.diferenca)}</dd>
        </div>
      </dl>
      {soma.diferenca === 0 ? <span className="selo selo-ok">{desfecho(soma)}</span> : <p>{desfecho(soma)}</p>}
    </section>
  );
}
