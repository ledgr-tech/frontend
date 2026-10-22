import { Barra, EsqueletoTela } from "../esqueleto";

// A lista espera o backend no servidor; enquanto isso, a forma da tabela já aparece no lugar.
export default function CarregandoEmpresas() {
  return (
    <EsqueletoTela>
      <div style={{ paddingTop: 28, display: "grid", gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <Barra key={i} altura={56} style={{ borderRadius: "var(--radius-sm)" }} />
        ))}
      </div>
    </EsqueletoTela>
  );
}
