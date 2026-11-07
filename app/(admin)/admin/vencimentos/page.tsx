import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarDataHora } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { listarVencimentos } from "../acoes";
import { PRAZOS_DE_VENCIMENTO, ROTULO_DO_PERIODO, ROTULO_DO_STATUS, enderecoDaLista } from "../cobranca";
import { NavDoAdmin, Paginacao } from "../navegacao";
import { agoraEmMs, prazoDoTeste } from "../situacao";

type Busca = { dias?: string; pagina?: string };

/**
 * O que vence nos próximos dias (#236, backend #182): assinaturas que renovam (marcando as que vão acabar
 * por cancelamento agendado) e testes que terminam, numa lista só, do mais próximo ao mais distante.
 */
export default async function VencimentosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtros = await searchParams;
  const pagina = Number(filtros.pagina) || 1;
  const r = await listarVencimentos({ dias: Number(filtros.dias) || 7, pagina });
  if (!r.ok && r.status === 401) redirect("/login");
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();
  const dias = r.ok ? r.dados.dias : Number(filtros.dias) || 7;
  const agora = agoraEmMs();

  return (
    <div>
      <NavDoAdmin atual="/admin/vencimentos" />
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">Painel interno</div>
          <h1 className="tela-titulo">Vencimentos</h1>
          {r.ok && <span className="vg-subtitulo tela-contexto">{`${r.dados.total} nos próximos ${dias} dias`}</span>}
        </div>
      </div>

      <form method="get" className="extratos-corpo" style={{ paddingTop: 20 }}>
        <div className="pills segmentado" role="group" aria-label="Prazo">
          {PRAZOS_DE_VENCIMENTO.map((n) => (
            <button key={n} type="submit" name="dias" value={n} className="pill" aria-pressed={dias === n}>
              {`${n} dias`}
            </button>
          ))}
        </div>

        {!r.ok ? (
          <p role="alert">{r.erro}</p>
        ) : r.dados.itens.length === 0 ? (
          <p>Nada vence nesse prazo.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" aria-label="Vencimentos">
              <thead>
                <tr>
                  <th scope="col">Conta</th>
                  <th scope="col">O que vence</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Vence em</th>
                </tr>
              </thead>
              <tbody>
                {r.dados.itens.map((v) => (
                  <tr key={`${v.tipo}-${v.contaId}`}>
                    <td>
                      <Link href={`/admin/${v.contaId}`}>{v.razaoSocial}</Link>
                      {v.inativa && (
                        <>
                          {" "}
                          <span className="selo selo-risco">Inativa</span>
                        </>
                      )}
                    </td>
                    <td>
                      {v.tipo === "teste" ? (
                        <span className="selo selo-atencao">Fim do teste</span>
                      ) : v.cancelamentoAgendado ? (
                        <span className="selo selo-risco">Termina (cancelamento agendado)</span>
                      ) : (
                        <span className="selo selo-ok">{`Renova${v.status && v.status !== "active" ? ` · ${ROTULO_DO_STATUS[v.status] ?? v.status}` : ""}`}</span>
                      )}
                    </td>
                    <td>{v.plano ? `${v.plano}${v.periodo ? ` · ${ROTULO_DO_PERIODO[v.periodo] ?? v.periodo}` : ""}` : "—"}</td>
                    <td>
                      {formatarDataHora(v.venceEm).slice(0, 10)} <span style={{ opacity: 0.65 }}>{`· ${prazoDoTeste(v.venceEm, agora)}`}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginacao
              pagina={pagina}
              offset={r.dados.offset}
              quantos={r.dados.itens.length}
              total={r.dados.total}
              nome="vencimentos"
              endereco={(n) => enderecoDaLista("/admin/vencimentos", { dias: String(dias) }, n)}
            />
          </div>
        )}
      </form>
    </div>
  );
}
