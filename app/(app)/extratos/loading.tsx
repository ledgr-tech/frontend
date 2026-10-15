import { Barra, EsqueletoTela } from "../esqueleto";

// A lista espera o backend no servidor (uma chamada por arquivo); enquanto isso,
// a forma da galeria já aparece no lugar.
export default function CarregandoExtratos() {
  return (
    <EsqueletoTela>
      <div className="extratos-grade" style={{ paddingTop: 28 }}>
        {[0, 1, 2, 3].map((i) => (
          <Barra key={i} altura={200} style={{ borderRadius: "var(--radius-sm)" }} />
        ))}
      </div>
    </EsqueletoTela>
  );
}
