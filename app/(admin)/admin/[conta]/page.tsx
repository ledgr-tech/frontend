import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarCnpj } from "../../../(auth)/cadastro/passos";
import { formatarDataHora, formatarInteiro } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { ROTULO_DA_SITUACAO, detalharConta } from "../acoes";
import { AcoesDaConta } from "./acoes-da-conta";

const ROTULO_DO_EVENTO: Record<string, string> = {
  inativada: "Conta inativada",
  reativada: "Conta reativada",
  piloto_ativado: "Marcada como piloto",
  piloto_desativado: "Piloto desmarcado",
};

/** Uma conta (#222): quem é, o uso (só contagens, nunca dado do cliente), o histórico e as ações. */
export default async function ContaPage({ params }: { params: Promise<{ conta: string }> }) {
  const { conta: id } = await params;
  const r = await detalharConta(id);
  if (!r.ok && r.status === 401) redirect("/login");
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();
  if (!r.ok) return <p role="alert">{r.erro}</p>;
  const c = r.dados;
  const data = (iso: string | null) => (iso ? formatarDataHora(iso) : "—");
  const situacao = ROTULO_DA_SITUACAO[c.inativa ? "inativa" : c.situacao] ?? c.situacao;

  return (
    <div>
      <Link href="/admin">← Contas</Link>
      <h1 className="tela-titulo">{c.razaoSocial}</h1>
      <p>{`CNPJ ${formatarCnpj(c.cnpj)} · ${situacao}${c.plano ? ` · plano ${c.plano}` : ""}`}</p>

      <dl className="rel-numeros">
        <div>
          <dt>Admin</dt>
          <dd>{c.admin ? `${c.admin.nome} (${c.admin.email})` : "—"}</dd>
        </div>
        <div>
          <dt>Último login</dt>
          <dd>{data(c.ultimoLoginEm)}</dd>
        </div>
        <div>
          <dt>Criada em</dt>
          <dd>{data(c.criadaEm)}</dd>
        </div>
        <div>
          <dt>Teste termina</dt>
          <dd>{data(c.testeTerminaEm)}</dd>
        </div>
      </dl>
      {c.inativacao && <p role="status">{`Inativa desde ${data(c.inativacao.em)}: ${c.inativacao.motivo}`}</p>}

      <h2>Uso</h2>
      <dl className="rel-numeros">
        <div>
          <dt>Empresas</dt>
          <dd>{formatarInteiro(c.uso.empresas)}</dd>
        </div>
        <div>
          <dt>Pessoas ativas</dt>
          <dd>{formatarInteiro(c.uso.usuariosAtivos)}</dd>
        </div>
        <div>
          <dt>Convites pendentes</dt>
          <dd>{formatarInteiro(c.uso.convitesPendentes)}</dd>
        </div>
        <div>
          <dt>Conciliações</dt>
          <dd>{formatarInteiro(c.uso.conciliacoesTotal)}</dd>
        </div>
        <div>
          <dt>Chaves da API</dt>
          <dd>{formatarInteiro(c.uso.chavesApiAtivas)}</dd>
        </div>
        <div>
          <dt>Conexões MCP</dt>
          <dd>{formatarInteiro(c.uso.conexoesMcpAtivas)}</dd>
        </div>
        <div>
          <dt>Links públicos</dt>
          <dd>{formatarInteiro(c.uso.linksPublicosAtivos)}</dd>
        </div>
      </dl>
      <table className="table" aria-label="Extratos do banco conciliados por mês">
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col" className="rel-num">
              Extratos do banco conciliados
            </th>
          </tr>
        </thead>
        <tbody>
          {c.uso.extratosDoBancoPorMes.map((m) => (
            <tr key={m.mes}>
              <td>{m.mes}</td>
              <td className="rel-num">{formatarInteiro(m.extratos)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Ações</h2>
      <AcoesDaConta id={c.id} inativa={c.inativa} />

      <h2>Histórico</h2>
      {c.eventos.length === 0 ? (
        <p>Nenhum evento ainda.</p>
      ) : (
        <ul>
          {c.eventos.map((e, i) => (
            <li key={i}>{`${data(e.em)} · ${ROTULO_DO_EVENTO[e.tipo] ?? e.tipo}${e.operador ? ` por ${e.operador}` : ""} (${e.origem}): ${e.motivo}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
