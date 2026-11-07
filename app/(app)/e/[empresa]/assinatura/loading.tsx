import { Barra, EsqueletoTela } from "../esqueleto";

// O preço vem do backend no servidor; enquanto isso, as três folhas dos planos já aparecem no lugar.
export default function CarregandoAssinatura() {
  return (
    <EsqueletoTela>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, paddingTop: 12 }}>
        {[0, 1, 2].map((i) => (
          <Barra key={i} altura={260} style={{ borderRadius: "var(--radius-sm)" }} />
        ))}
      </div>
    </EsqueletoTela>
  );
}
