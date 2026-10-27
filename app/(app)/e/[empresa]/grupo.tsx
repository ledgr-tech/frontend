import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Um bloco de uma lista agrupada (os anos do fechamento, os meses ou anos dos extratos): o título
 * com o resumo ao lado, sobre um filete, e o título inteiro é o botão que recolhe o bloco, para
 * chegar ao seguinte sem rolar por ele. A seta diz se está aberto.
 */
export function Grupo({
  id,
  titulo,
  resumo,
  fechado,
  onAlternar,
  children,
}: {
  /** Prefixo dos ids do título e do corpo; único na tela. */
  id: string;
  titulo: string;
  resumo: string;
  fechado: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <section className="grupo" aria-labelledby={`${id}-titulo`}>
      <div className="grupo-topo">
        <h2 id={`${id}-titulo`} className="grupo-titulo">
          <button
            type="button"
            className="grupo-botao"
            aria-expanded={!fechado}
            aria-controls={`${id}-corpo`}
            onClick={onAlternar}
          >
            <ChevronDown size={18} aria-hidden="true" className="grupo-seta" />
            {titulo}
          </button>
        </h2>
        <span className="grupo-meta">{resumo}</span>
      </div>
      <div id={`${id}-corpo`} className="grupo-corpo" hidden={fechado}>
        {children}
      </div>
    </section>
  );
}

/** Tira a chave do conjunto se está nele, põe se não está (para o `set` de um `useState`). */
export const alternarNoConjunto = (chave: string) => (conjunto: ReadonlySet<string>) => {
  const novo = new Set(conjunto);
  if (novo.has(chave)) novo.delete(chave);
  else novo.add(chave);
  return novo;
};
