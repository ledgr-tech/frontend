import { DIVERGENCIAS, type Divergencia } from "@/lib/adaptadores";
import type { LinhaComparacao, Tom } from "@/lib/mock-data";
import { formatarMoedaCurta, seloDoStatus, valorEmAberto } from "../../dashboard/resumo";

export type Categoria = {
  status: Divergencia;
  rotulo: string;
  tom: Tom;
  quantidade: number;
  /** Quanto a categoria deixa em aberto, em reais. */
  valor: number;
};

/**
 * As linhas da conciliação pelas cinco categorias do motor, sempre as cinco e
 * sempre na mesma ordem: num relatório, o zero também informa, e a categoria
 * não deveria mudar de lugar entre um mês e outro.
 */
export function porCategoria(linhas: LinhaComparacao[]): Categoria[] {
  return DIVERGENCIAS.map((status) => {
    const daCategoria = linhas.filter((linha) => linha.status === status);
    return {
      status,
      ...seloDoStatus(status),
      quantidade: daCategoria.length,
      valor: valorEmAberto(daCategoria),
    };
  });
}

function plural(quantidade: number, um: string, varios: string): string {
  return `${quantidade.toLocaleString("pt-BR")} ${quantidade === 1 ? um : varios}`;
}

/**
 * O relatório agrupado: um contador por categoria, e cada um é o filtro da
 * tabela logo abaixo (o drill-down: categoria → linhas → detalhe da linha).
 */
export function Relatorio({
  linhas,
  ativa,
  onEscolher,
}: {
  linhas: LinhaComparacao[];
  ativa: Divergencia | null;
  onEscolher: (status: Divergencia | null) => void;
}) {
  const categorias = porCategoria(linhas);
  const emRevisao = categorias.reduce((soma, categoria) => soma + categoria.quantidade, 0);

  return (
    <section className="relatorio" aria-labelledby="relatorio-titulo">
      <div className="relatorio-topo">
        <h2 id="relatorio-titulo" className="relatorio-titulo">
          Divergências por categoria
        </h2>
        <span className="relatorio-total">
          {emRevisao === 0
            ? "Nenhuma linha pede revisão."
            : `${plural(emRevisao, "linha pede", "linhas pedem")} revisão · ${formatarMoedaCurta(valorEmAberto(linhas))} em aberto`}
        </span>
      </div>
      <ul className="relatorio-lista">
        {categorias.map((categoria) => (
          <li key={categoria.status}>
            <button
              type="button"
              className="relatorio-categoria"
              aria-pressed={ativa === categoria.status}
              // sem linha, não há o que abrir; o contador fica, apagado
              disabled={categoria.quantidade === 0 && ativa !== categoria.status}
              onClick={() => onEscolher(ativa === categoria.status ? null : categoria.status)}
            >
              <span className="relatorio-rotulo">
                <span className={`vg-ponto vg-ponto-${categoria.tom}`} aria-hidden="true" />
                {categoria.rotulo}
              </span>
              <span className="relatorio-numero">{categoria.quantidade.toLocaleString("pt-BR")}</span>
              <span className="relatorio-valor">
                {/* data trocada com o mesmo valor não deixa dinheiro em aberto: "R$ 0" confundiria */}
                {categoria.valor > 0 ? `${formatarMoedaCurta(categoria.valor)} em aberto` : "Sem valor em aberto"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
