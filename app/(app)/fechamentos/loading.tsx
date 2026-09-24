import { Barra, EsqueletoTela } from "../esqueleto";

// O fechamento espera o backend no servidor; enquanto isso, a navegação já troca
// de tela e mostra a forma do que vai chegar: o mascote com a frase do mês, o
// resumo em três colunas e o marco.
export default function CarregandoFechamentos() {
  return (
    <EsqueletoTela>
      <div className="fech-destaque">
        <Barra largura={190} altura={190} style={{ borderRadius: "var(--radius-md)" }} />
        <div className="fech-destaque-corpo" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Barra largura={120} altura={11} />
          <Barra largura="80%" altura={38} />
          <Barra largura={76} altura={1} />
          <Barra largura={300} altura={12} />
        </div>
      </div>
      <div className="grade-colunas dash-resumo esq-resumo">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Barra largura={110} altura={11} />
            <Barra largura={96} altura={34} />
          </div>
        ))}
      </div>
      <Barra largura={220} altura={230} style={{ borderRadius: "var(--radius-md)" }} />
    </EsqueletoTela>
  );
}
