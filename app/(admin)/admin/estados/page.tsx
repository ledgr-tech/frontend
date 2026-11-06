import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarInteiro } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { contarContasPorUf } from "../acoes";
import { NavDoAdmin } from "../navegacao";
import { UF_NAO_INFORMADA } from "../situacao";

/**
 * Onde estão os clientes e onde estão assinando (backend #184): cada estado com contas, do que tem mais ao
 * que tem menos, e o grupo das contas sem estado. Cada linha abre a lista de contas filtrada.
 */
export default async function EstadosPage() {
  const r = await contarContasPorUf();
  if (!r.ok && r.status === 401) redirect("/login");
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();

  return (
    <div>
      <NavDoAdmin atual="/admin/estados" />
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">Painel interno</div>
          <h1 className="tela-titulo">Estados</h1>
          {r.ok && (
            <span className="vg-subtitulo tela-contexto">
              {`${formatarInteiro(r.dados.contas)} ${r.dados.contas === 1 ? "conta" : "contas"} · ${formatarInteiro(r.dados.assinando)} assinando`}
            </span>
          )}
        </div>
      </div>

      <div className="extratos-corpo" style={{ paddingTop: 20 }}>
        {!r.ok ? (
          <p role="alert">{r.erro}</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" aria-label="Contas por estado">
              <thead>
                <tr>
                  <th scope="col">Estado</th>
                  <th scope="col" className="rel-num">
                    Contas
                  </th>
                  <th scope="col" className="rel-num">
                    Assinando
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...r.dados.ufs, { uf: UF_NAO_INFORMADA, ...r.dados.naoInformada }].map((g) => (
                  <tr key={g.uf}>
                    <td>
                      <Link href={`/admin?uf=${g.uf}`}>{g.uf === UF_NAO_INFORMADA ? "Não informado" : g.uf}</Link>
                    </td>
                    <td className="rel-num">{formatarInteiro(g.contas)}</td>
                    <td className="rel-num">{formatarInteiro(g.assinando)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
