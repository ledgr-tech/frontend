import { Barra, EsqueletoTela } from "../../../esqueleto";

// Aqui o servidor busca o roteiro (ou o rascunho) da importação via IA antes de mostrar o passo a passo.
export default function CarregandoImportacaoViaIa() {
  return (
    <EsqueletoTela>
      <Barra altura={220} style={{ borderRadius: "var(--radius-sm)" }} />
      <Barra altura={120} style={{ borderRadius: "var(--radius-sm)" }} />
    </EsqueletoTela>
  );
}
