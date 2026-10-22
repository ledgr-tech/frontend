import { Barra, EsqueletoTela } from "../esqueleto";

// O histórico espera o backend no servidor; enquanto isso, a navegação já troca
// de tela e mostra a forma do que vai chegar: o resumo, o gráfico e os cartões
// da linha do tempo.
export default function CarregandoHistorico() {
  return (
    <EsqueletoTela>
      <div className="grade-colunas dash-resumo esq-resumo">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Barra largura={140} altura={11} />
            <Barra largura={96} altura={34} />
          </div>
        ))}
      </div>
      <Barra largura="100%" altura={176} style={{ borderRadius: "var(--radius-md)" }} />
      {[0, 1, 2].map((i) => (
        <Barra key={i} largura="100%" altura={130} style={{ borderRadius: "var(--radius-md)" }} />
      ))}
    </EsqueletoTela>
  );
}
