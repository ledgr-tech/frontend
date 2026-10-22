import { Barra, EsqueletoTabela, EsqueletoTela } from "../esqueleto";

// A lista espera o backend no servidor; enquanto isso, a navegação já troca de tela e mostra a
// forma do que vai chegar: o cartão da que está em andamento e a lista.
export default function CarregandoConciliacoes() {
  return (
    <EsqueletoTela>
      <Barra largura="100%" altura={132} style={{ borderRadius: "var(--radius-md)" }} />
      <EsqueletoTabela linhas={6} colunas={7} />
    </EsqueletoTela>
  );
}
