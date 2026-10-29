import { Barra, EsqueletoTela } from "../esqueleto";

// O histórico espera o backend no servidor; enquanto isso, a navegação já troca
// de tela e mostra a forma do que vai chegar: o gráfico, o filtro, as folhas do mês
// e a prévia ao lado, como em Conciliações.
export default function CarregandoHistorico() {
  return (
    <EsqueletoTela>
      <Barra largura="100%" altura={176} style={{ borderRadius: "var(--radius-md)" }} />
      <Barra largura={420} altura={36} />
      <div className="conc-mesa">
        <div className="conc-folhas">
          {Array.from({ length: 4 }, (_, i) => (
            <Barra key={i} largura="100%" altura={196} style={{ borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
        <Barra largura="100%" altura={420} style={{ borderRadius: "var(--radius-md)" }} />
      </div>
    </EsqueletoTela>
  );
}
