import { Barra, EsqueletoTela } from "../esqueleto";

// A lista espera o backend no servidor; enquanto isso, a forma da tela já aparece no lugar: a faixa
// com Empresas e Equipe, a tabela e o painel ao lado, como nas outras telas.
export default function CarregandoEmpresas() {
  return (
    <EsqueletoTela>
      <Barra largura={420} altura={36} />
      <div className="conc-mesa">
        <div style={{ display: "grid", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Barra key={i} altura={48} style={{ borderRadius: "var(--radius-sm)" }} />
          ))}
        </div>
        <Barra largura="100%" altura={320} style={{ borderRadius: "var(--radius-md)" }} />
      </div>
    </EsqueletoTela>
  );
}
