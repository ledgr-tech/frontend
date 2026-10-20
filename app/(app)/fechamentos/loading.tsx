import { Barra, EsqueletoTela } from "../esqueleto";

// O fechamento espera o backend no servidor; enquanto isso, a navegação já troca
// de tela e mostra a forma do que vai chegar: as folhas dos meses.
export default function CarregandoFechamentos() {
  return (
    <EsqueletoTela>
      <Barra largura={340} altura={36} style={{ borderRadius: 999 }} />
      <>
        <div className="extratos-grade">
          {[0, 1, 2].map((i) => (
            <Barra key={i} largura="100%" altura={200} style={{ borderRadius: "var(--radius-sm)" }} />
          ))}
        </div>
      </>
    </EsqueletoTela>
  );
}
