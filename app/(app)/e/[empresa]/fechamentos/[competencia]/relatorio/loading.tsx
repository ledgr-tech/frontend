import { Barra, EsqueletoTabela, EsqueletoTela } from "../../../esqueleto";

// O relatório junta o fechamento e cada par conciliado, uma chamada por par: demora mais que as outras telas.
export default function CarregandoRelatorio() {
  return (
    <EsqueletoTela>
      <Barra altura={90} style={{ borderRadius: "var(--radius-sm)" }} />
      <EsqueletoTabela linhas={6} colunas={4} />
    </EsqueletoTela>
  );
}
