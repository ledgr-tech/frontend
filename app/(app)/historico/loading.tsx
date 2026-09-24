import { EsqueletoTabela, EsqueletoTela } from "../esqueleto";

// O histórico espera o backend no servidor; enquanto isso, a navegação já troca
// de tela e mostra a forma da tabela que vai chegar.
export default function CarregandoHistorico() {
  return (
    <EsqueletoTela>
      <EsqueletoTabela colunas={6} />
    </EsqueletoTela>
  );
}
