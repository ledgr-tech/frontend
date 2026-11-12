import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarDataHora } from "../../../../(app)/e/[empresa]/dashboard/resumo";
import { detalharConta, listarPagamentosDaConta } from "../../acoes";
import { ROTULO_DO_PAGAMENTO, enderecoDaLista, formatarValor } from "../../cobranca";
import { Paginacao } from "../../navegacao";

const dia = (iso: string) => formatarDataHora(iso).slice(0, 10);

/** O histórico inteiro de pagamentos de uma conta: o detalhe dela traz só os 12 mais recentes. */
export default async function PagamentosDaContaPage({
  params,
  searchParams,
}: {
  params: Promise<{ conta: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { conta: id } = await params;
  const pagina = Number((await searchParams).pagina) || 1;
  const [conta, r] = await Promise.all([detalharConta(id), listarPagamentosDaConta(id, pagina)]);
  for (const resposta of [conta, r]) {
    if (!resposta.ok && resposta.status === 401) redirect("/login");
    if (!resposta.ok && (resposta.status === 403 || resposta.status === 404)) notFound();
  }

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">
            <Link href={`/admin/${id}`}>{`← ${conta.ok ? conta.dados.razaoSocial : "Conta"}`}</Link> · Painel interno
          </div>
          <h1 className="tela-titulo">Pagamentos da conta</h1>
          {r.ok && <span className="vg-subtitulo tela-contexto">{`${r.dados.total} ${r.dados.total === 1 ? "pagamento" : "pagamentos"}`}</span>}
        </div>
      </div>

      <div className="extratos-corpo" style={{ paddingTop: 20 }}>
        {!r.ok ? (
          <p role="alert">{r.erro}</p>
        ) : r.dados.itens.length === 0 ? (
          <p>Nenhum pagamento.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" aria-label="Pagamentos da conta">
              <thead>
                <tr>
                  <th scope="col" className="rel-num">
                    Valor
                  </th>
                  <th scope="col">Situação</th>
                  <th scope="col">Período cobrado</th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                {r.dados.itens.map((p) => (
                  <tr key={p.id}>
                    <td className="rel-num">{formatarValor(p.valorCentavos, p.moeda)}</td>
                    <td>
                      <span className={p.status === "paga" ? "selo selo-ok" : "selo selo-risco"}>{ROTULO_DO_PAGAMENTO[p.status] ?? p.status}</span>
                    </td>
                    <td>{p.periodoInicio && p.periodoFim ? `${dia(p.periodoInicio)} a ${dia(p.periodoFim)}` : "—"}</td>
                    <td>{formatarDataHora(p.ocorridoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginacao
              pagina={pagina}
              offset={r.dados.offset}
              quantos={r.dados.itens.length}
              total={r.dados.total}
              nome="pagamentos"
              endereco={(n) => enderecoDaLista(`/admin/${id}/pagamentos`, {}, n)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
