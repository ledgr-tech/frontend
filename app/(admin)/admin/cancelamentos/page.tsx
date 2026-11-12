import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarDataHora } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { listarCancelamentos } from "../acoes";
import { ROTULO_DA_ORIGEM, ROTULO_DO_PERIODO, enderecoDaLista } from "../cobranca";
import { NavDoAdmin, Paginacao } from "../navegacao";

type Busca = { situacao?: string; origem?: string; desde?: string; ate?: string; pagina?: string };

const FILTROS = [
  { valor: "", rotulo: "Todos" },
  { valor: "agendada", rotulo: "Agendados" },
  { valor: "cancelada", rotulo: "Cancelados" },
];

const dia = (iso: string) => formatarDataHora(iso).slice(0, 10);

/**
 * Assinaturas canceladas e com cancelamento agendado (#236, backend #182), com o motivo e quem cancelou
 * (cliente, falta de pagamento, operador ou o painel da Stripe). O período filtra a data do pedido.
 */
export default async function CancelamentosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtros = await searchParams;
  const pagina = Number(filtros.pagina) || 1;
  const r = await listarCancelamentos({ ...filtros, pagina });
  if (!r.ok && r.status === 401) redirect("/login");
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();
  const situacaoAtual = filtros.situacao ?? "";

  return (
    <div>
      <NavDoAdmin atual="/admin/cancelamentos" />
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">Painel interno</div>
          <h1 className="tela-titulo">Cancelamentos</h1>
          {r.ok && <span className="vg-subtitulo tela-contexto">{`${r.dados.total} ${r.dados.total === 1 ? "assinatura" : "assinaturas"}`}</span>}
        </div>
      </div>

      <form method="get" className="extratos-corpo" style={{ paddingTop: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, order: 2, alignItems: "center", flexWrap: "wrap" }}>
            <select className="input" name="origem" defaultValue={filtros.origem ?? ""} aria-label="Origem">
              <option value="">Qualquer origem</option>
              {Object.entries(ROTULO_DA_ORIGEM).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
              De
              <input className="input" type="date" name="desde" defaultValue={filtros.desde ?? ""} />
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
              até
              <input className="input" type="date" name="ate" defaultValue={filtros.ate ?? ""} />
            </label>
            <button type="submit" name="situacao" value={situacaoAtual} className="btn btn-secondary">
              Filtrar
            </button>
          </div>
          <div className="pills segmentado" role="group" aria-label="Situação do cancelamento" style={{ order: 1 }}>
            {FILTROS.map((f) => (
              <button key={f.valor} type="submit" name="situacao" value={f.valor} className="pill" aria-pressed={situacaoAtual === f.valor}>
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>

        {!r.ok ? (
          <p role="alert">{r.erro}</p>
        ) : r.dados.itens.length === 0 ? (
          <p>Nenhum cancelamento encontrado.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" aria-label="Cancelamentos">
              <thead>
                <tr>
                  <th scope="col">Conta</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Origem e motivo</th>
                  <th scope="col">Pedido em</th>
                  <th scope="col">Acesso até</th>
                </tr>
              </thead>
              <tbody>
                {r.dados.itens.map((c) => (
                  <tr key={`${c.contaId}-${c.data}`}>
                    <td>
                      <Link href={`/admin/${c.contaId}`}>{c.razaoSocial}</Link>
                    </td>
                    <td>
                      <span className={c.situacao === "agendada" ? "selo selo-atencao" : "selo selo-risco"}>{c.situacao === "agendada" ? "Agendado" : "Cancelado"}</span>
                    </td>
                    <td>{`${c.plano} · ${ROTULO_DO_PERIODO[c.periodo] ?? c.periodo}`}</td>
                    <td>
                      {c.origem ? (ROTULO_DA_ORIGEM[c.origem] ?? c.origem) : "—"}
                      {c.motivo && <div style={{ fontSize: 12.5, opacity: 0.7 }}>{c.motivo}</div>}
                    </td>
                    <td>{dia(c.data)}</td>
                    <td>{c.periodoAtualFim ? dia(c.periodoAtualFim) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginacao
              pagina={pagina}
              offset={r.dados.offset}
              quantos={r.dados.itens.length}
              total={r.dados.total}
              nome="assinaturas"
              endereco={(n) => enderecoDaLista("/admin/cancelamentos", filtros, n)}
            />
          </div>
        )}
      </form>
    </div>
  );
}
