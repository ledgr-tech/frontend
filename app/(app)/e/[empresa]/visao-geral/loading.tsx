import { Barra, EsqueletoTabela, EsqueletoTela } from "../esqueleto";

// A visão geral espera o backend no servidor; enquanto isso, a navegação já troca
// de tela e mostra a forma do que vai chegar: o bloco do mês com o lado, as duas
// colunas e a atividade recente.
export default function CarregandoVisaoGeral() {
  return (
    <EsqueletoTela>
      <div className="vg-blocos-topo">
        <Barra altura={240} />
        <Barra altura={240} />
      </div>
      <div className="vg-grade">
        <Barra altura={176} />
        <Barra altura={176} />
      </div>
      <EsqueletoTabela linhas={3} colunas={5} />
    </EsqueletoTela>
  );
}
