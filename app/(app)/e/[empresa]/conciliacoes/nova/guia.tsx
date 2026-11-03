import { Check } from "lucide-react";

export type Passo = { titulo: string; texto: string };

/**
 * Os passos de uma tela de envio, como uma seção do painel (`conc-previa`): sem caixa, numa linha do
 * tempo neutra. O passo já feito ganha o ✓ no lugar do número (a importação via IA marca conforme a
 * pessoa avança; a Nova conciliação não marca nenhum).
 */
export function Guia({
  titulo,
  subtitulo,
  passos,
  feitos = [],
}: {
  titulo: string;
  subtitulo: string;
  passos: Passo[];
  feitos?: boolean[];
}) {
  return (
    <section className="nova-guia" aria-label={titulo}>
      <div className="nova-guia-topo">
        <h3 className="rotulo">{titulo}</h3>
        <span>{subtitulo}</span>
      </div>
      <ol className="nova-guia-passos">
        {passos.map((passo, i) => (
          <li key={passo.titulo} data-feito={feitos[i] ? "" : undefined}>
            <span className="nova-guia-num" aria-hidden="true">
              {feitos[i] ? <Check /> : i + 1}
            </span>
            <strong>
              {passo.titulo}
              {feitos[i] && <span className="sr-only"> (feito)</span>}
            </strong>
            <span>{passo.texto}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
