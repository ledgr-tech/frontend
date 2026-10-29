import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarCnpj } from "../../../(auth)/cadastro/passos";
import { formatarDataHora, formatarInteiro } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { detalharConta } from "../acoes";
import { ROTULO_DA_SITUACAO, chaveDaSituacao, classeDoSelo } from "../situacao";
import { AcoesDaConta } from "./acoes-da-conta";

const ROTULO_DO_EVENTO: Record<string, string> = {
  inativada: "Conta inativada",
  reativada: "Conta reativada",
  piloto_ligado: "Marcada como piloto",
  piloto_desligado: "Piloto desmarcado",
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "2026-10" → "Outubro de 2026". */
function nomeDoMes(mes: string): string {
  const [ano, numero] = mes.split("-");
  const nome = MESES[Number(numero) - 1];
  return nome ? `${nome} de ${ano}` : mes;
}

const estiloTituloDoCartao = { margin: 0, fontSize: 18, fontWeight: 600 } as const;

/**
 * Uma conta (#222), na opção B do 28/10: ações no topo (cada uma abre uma janela que pede o motivo), cartões de
 * uso (só contagens, nunca dado do cliente), os extratos conciliados por mês, os dados da conta e o histórico.
 */
export default async function ContaPage({ params }: { params: Promise<{ conta: string }> }) {
  const { conta: id } = await params;
  const r = await detalharConta(id);
  if (!r.ok && r.status === 401) redirect("/login");
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();
  if (!r.ok) return <p role="alert">{r.erro}</p>;
  const c = r.dados;
  const data = (iso: string | null) => (iso ? formatarDataHora(iso) : "—");
  const chave = chaveDaSituacao(c);
  const kpis: [string, string, string?][] = [
    ["Empresas", formatarInteiro(c.uso.empresas)],
    ["Pessoas ativas", formatarInteiro(c.uso.usuariosAtivos), c.uso.convitesPendentes > 0 ? `+${c.uso.convitesPendentes} ${c.uso.convitesPendentes === 1 ? "convite" : "convites"}` : undefined],
    ["Conciliações", formatarInteiro(c.uso.conciliacoesTotal)],
    ["API · MCP · links", `${c.uso.chavesApiAtivas} · ${c.uso.conexoesMcpAtivas} · ${c.uso.linksPublicosAtivos}`],
  ];

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">
            <Link href="/admin">← Contas</Link> · Painel interno
          </div>
          <h1 className="tela-titulo">
            {c.razaoSocial} <span className={classeDoSelo(chave)} style={{ verticalAlign: "middle" }}>{ROTULO_DA_SITUACAO[chave] ?? c.situacao}</span>
          </h1>
          <span className="vg-subtitulo tela-contexto">
            {`CNPJ ${formatarCnpj(c.cnpj)}${c.plano ? ` · plano ${c.plano}` : ""}${c.piloto ? " · piloto" : ""}`}
          </span>
        </div>
        <div className="tela-acoes">
          <AcoesDaConta id={c.id} nome={c.razaoSocial} inativa={c.inativa} piloto={c.piloto} />
        </div>
      </div>
      {c.inativacao && <p role="status">{`Inativa desde ${data(c.inativacao.em)}: ${c.inativacao.motivo}`}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, margin: "20px 0" }}>
        {kpis.map(([rotulo, valor, nota]) => (
          <div key={rotulo} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{rotulo}</div>
            <div className="font-titulo" style={{ fontSize: 26, fontWeight: 600 }}>
              {valor} {nota && <span style={{ fontSize: 13, opacity: 0.65, fontFamily: "var(--font-body)" }}>{nota}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <section className="card" style={{ padding: 18, display: "grid", gap: 10, alignContent: "start" }} aria-labelledby="conta-extratos">
          <h2 id="conta-extratos" className="font-titulo" style={estiloTituloDoCartao}>
            Extratos do banco conciliados
          </h2>
          <table className="table" aria-label="Extratos do banco conciliados por mês">
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col" className="rel-num">
                  Extratos
                </th>
              </tr>
            </thead>
            <tbody>
              {c.uso.extratosDoBancoPorMes.map((m) => (
                <tr key={m.mes}>
                  <td>{nomeDoMes(m.mes)}</td>
                  <td className="rel-num">{formatarInteiro(m.extratos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: 0, fontSize: 12.5, opacity: 0.7 }}>A unidade de cobrança: o extrato do banco conciliado pela primeira vez no mês.</p>
        </section>

        <section className="card" style={{ padding: 18, display: "grid", gap: 10, alignContent: "start" }} aria-labelledby="conta-dados">
          <h2 id="conta-dados" className="font-titulo" style={estiloTituloDoCartao}>
            Conta
          </h2>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 14 }}>
            <dt style={{ opacity: 0.7 }}>Admin</dt>
            <dd style={{ margin: 0 }}>{c.admin ? `${c.admin.nome} · ${c.admin.email}` : "—"}</dd>
            <dt style={{ opacity: 0.7 }}>Último login</dt>
            <dd style={{ margin: 0 }}>{data(c.ultimoLoginEm)}</dd>
            <dt style={{ opacity: 0.7 }}>Criada em</dt>
            <dd style={{ margin: 0 }}>{formatarDataHora(c.criadaEm).slice(0, 10)}</dd>
            <dt style={{ opacity: 0.7 }}>Teste termina</dt>
            <dd style={{ margin: 0 }}>{c.testeTerminaEm ? formatarDataHora(c.testeTerminaEm).slice(0, 10) : "—"}</dd>
          </dl>
          <h2 className="font-titulo" style={{ ...estiloTituloDoCartao, marginTop: 10 }}>
            Histórico
          </h2>
          {c.eventos.length === 0 ? (
            <p style={{ margin: 0 }}>Nenhum evento ainda.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5 }}>
              {c.eventos.map((e, i) => (
                <li key={i}>
                  <strong>{ROTULO_DO_EVENTO[e.tipo] ?? e.tipo}</strong>
                  {` · ${formatarDataHora(e.em).slice(0, 10)} · ${e.operador ?? e.origem}`}
                  <br />
                  <span style={{ opacity: 0.7 }}>{e.motivo}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
