import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarDataHora } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { listarPagamentos } from "../acoes";
import { ROTULO_DO_PAGAMENTO, enderecoDaLista, formatarValor } from "../cobranca";
import { NavDoAdmin, Paginacao } from "../navegacao";

type Busca = { status?: string; desde?: string; ate?: string; pagina?: string };

const FILTROS = [
  { valor: "", rotulo: "Todos" },
  { valor: "paga", rotulo: "Pagos" },
  { valor: "falhou", rotulo: "Falharam" },
];

const dia = (iso: string) => formatarDataHora(iso).slice(0, 10);

/**
 * Os pagamentos de todas as contas (#236, backend #182): o que o webhook da Stripe guardou, sem chamar a
 * Stripe. "Falharam" é a inadimplência. Formulário GET como a lista de contas; o período é no fuso de São Paulo.
 */
export default async function PagamentosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtros = await searchParams;
  const pagina = Number(filtros.pagina) || 1;
  const r = await listarPagamentos({ ...filtros, pagina });
  if (!r.ok && r.status === 401) redirect("/login");
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();
  const statusAtual = filtros.status ?? "";

  return (
    <div>
      <NavDoAdmin atual="/admin/pagamentos" />
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">Painel interno</div>
          <h1 className="tela-titulo">Pagamentos</h1>
          {r.ok && <span className="vg-subtitulo tela-contexto">{`${r.dados.total} ${r.dados.total === 1 ? "pagamento" : "pagamentos"}`}</span>}
        </div>
      </div>

      <form method="get" className="extratos-corpo" style={{ paddingTop: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, order: 2, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
              De
              <input className="input" type="date" name="desde" defaultValue={filtros.desde ?? ""} />
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
              até
              <input className="input" type="date" name="ate" defaultValue={filtros.ate ?? ""} />
            </label>
            <button type="submit" name="status" value={statusAtual} className="btn btn-secondary">
              Filtrar
            </button>
          </div>
          <div className="pills segmentado" role="group" aria-label="Situação do pagamento" style={{ order: 1 }}>
            {FILTROS.map((f) => (
              <button key={f.valor} type="submit" name="status" value={f.valor} className="pill" aria-pressed={statusAtual === f.valor}>
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>

        {!r.ok ? (
          <p role="alert">{r.erro}</p>
        ) : r.dados.itens.length === 0 ? (
          <p>Nenhum pagamento encontrado.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" aria-label="Pagamentos">
              <thead>
                <tr>
                  <th scope="col">Conta</th>
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
                    <td>
                      <Link href={`/admin/${p.contaId}`}>{p.razaoSocial}</Link>
                    </td>
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
              endereco={(n) => enderecoDaLista("/admin/pagamentos", filtros, n)}
            />
          </div>
        )}
      </form>
    </div>
  );
}
