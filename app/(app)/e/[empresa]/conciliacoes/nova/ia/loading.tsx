import { Barra, EsqueletoTela } from "../../../esqueleto";
import { TransicaoEntrePaginas } from "../../../../../../transicao-de-tela";

// Aqui o servidor busca o roteiro (ou o rascunho) da importação via IA antes de mostrar o passo a passo.
export default function CarregandoImportacaoViaIa() {
  return (
    <EsqueletoTela>
      {/* o esqueleto é o primeiro quadro da página inteira: sem isto, a transição do navegador não acontece */}
      <TransicaoEntrePaginas />
      <Barra altura={220} style={{ borderRadius: "var(--radius-sm)" }} />
      <Barra altura={120} style={{ borderRadius: "var(--radius-sm)" }} />
    </EsqueletoTela>
  );
}
