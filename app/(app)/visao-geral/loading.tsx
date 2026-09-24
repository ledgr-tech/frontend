import { Barra, EsqueletoTabela, EsqueletoTela } from "../esqueleto";

// A visão geral espera o backend no servidor; enquanto isso, a navegação já troca
// de tela e mostra a forma do que vai chegar: o estado do mês, as duas colunas e
// a atividade recente.
export default function CarregandoVisaoGeral() {
  return (
    <EsqueletoTela>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Barra largura={320} altura={30} />
        <Barra altura={6} />
        <Barra largura={260} altura={12} />
      </div>
      <div className="vg-grade">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <Barra key={i} altura={44} />
          ))}
        </div>
        <Barra altura={176} />
      </div>
      <EsqueletoTabela linhas={3} colunas={5} />
    </EsqueletoTela>
  );
}
