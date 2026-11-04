import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarCnpj } from "../../../(auth)/cadastro/passos";
import { formatarDataHora, formatarInteiro } from "../../../(app)/e/[empresa]/dashboard/resumo";
import { detalharConta } from "../acoes";
import { ROTULO_DA_SITUACAO, chaveDaSituacao, classeDoSelo } from "../situacao";
import { ROTULO_DA_ORIGEM, ROTULO_DO_PAGAMENTO, ROTULO_DO_PERIODO, ROTULO_DO_STATUS, formatarValor } from "../cobranca";
import { AcoesDaConta } from "./acoes-da-conta";
import { AcoesDaAssinatura, DarCupom } from "./cobranca-da-conta";

const ROTULO_DO_EVENTO: Record<string, string> = {
  inativada: "Conta inativada",
  reativada: "Conta reativada",
  piloto_ligado: "Marcada como piloto",
  piloto_desligado: "Piloto desmarcado",
  cancelamento_agendado: "Cancelamento agendado",
  assinatura_cancelada: "Assinatura cancelada",
  cancelamento_desfeito: "Cancelamento desfeito",
  cupom_enviado: "Cupom enviado",
};

/** Os status em que a Stripe ainda cobra: cancelar e dar desconto direto valem só para eles (backend `STATUS_VIVOS`). */
const VIVOS = ["active", "trialing", "past_due"];

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
  const a = c.assinatura;
  const viva = !!a && VIVOS.includes(a.status);
  const dia = (iso: string | null) => (iso ? formatarDataHora(iso).slice(0, 10) : "—");
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
          {viva && <AcoesDaAssinatura id={c.id} nome={c.razaoSocial} agendado={a!.cancelarNoFimDoPeriodo} fimDoPeriodo={a!.periodoAtualFim} />}
          <DarCupom id={c.id} nome={c.razaoSocial} assinaturaViva={viva} />
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 14 }}>
        <section className="card" style={{ padding: 18, display: "grid", gap: 10, alignContent: "start" }} aria-labelledby="conta-assinatura">
          <h2 id="conta-assinatura" className="font-titulo" style={estiloTituloDoCartao}>
            Assinatura
          </h2>
          {!a ? (
            <p style={{ margin: 0 }}>A conta nunca assinou pela Stripe.</p>
          ) : (
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 14 }}>
              <dt style={{ opacity: 0.7 }}>Plano</dt>
              <dd style={{ margin: 0 }}>{`${a.plano} · ${ROTULO_DO_PERIODO[a.periodo] ?? a.periodo}`}</dd>
              <dt style={{ opacity: 0.7 }}>Situação</dt>
              <dd style={{ margin: 0 }}>
                <span className={a.status === "active" ? "selo selo-ok" : a.status === "trialing" ? "selo selo-atencao" : "selo selo-risco"}>{ROTULO_DO_STATUS[a.status] ?? a.status}</span>
                {viva && a.cancelarNoFimDoPeriodo && " · cancelamento agendado"}
              </dd>
              <dt style={{ opacity: 0.7 }}>{viva && !a.cancelarNoFimDoPeriodo ? "Renova em" : "Acesso até"}</dt>
              <dd style={{ margin: 0 }}>{dia(a.periodoAtualFim)}</dd>
              {(a.canceladaEm || a.origemCancelamento) && (
                <>
                  <dt style={{ opacity: 0.7 }}>Cancelamento</dt>
                  <dd style={{ margin: 0 }}>
                    {[a.canceladaEm && `pedido em ${dia(a.canceladaEm)}`, a.origemCancelamento && `por ${(ROTULO_DA_ORIGEM[a.origemCancelamento] ?? a.origemCancelamento).toLowerCase()}`]
                      .filter(Boolean)
                      .join(", ")}
                    {a.motivoCancelamento && <div style={{ opacity: 0.7 }}>{a.motivoCancelamento}</div>}
                  </dd>
                </>
              )}
            </dl>
          )}
          <h2 className="font-titulo" style={{ ...estiloTituloDoCartao, marginTop: 10 }}>
            Cupons
          </h2>
          {c.cupons.length === 0 ? (
            <p style={{ margin: 0 }}>Nenhum cupom dado.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5 }}>
              {c.cupons.map((cupom) => (
                <li key={cupom.id}>
                  <strong>{`${cupom.cupom} (${cupom.desconto})`}</strong>
                  {` · ${dia(cupom.em)}${cupom.operador ? ` · ${cupom.operador}` : ""}`}
                  <br />
                  <span style={{ opacity: 0.7 }}>
                    {[
                      cupom.forma === "assinatura" ? "direto na assinatura" : `código ${cupom.codigo ?? ""}`.trim(),
                      cupom.usadoEm ? `usado em ${dia(cupom.usadoEm)}` : cupom.expiraEm ? `vale até ${dia(cupom.expiraEm)}` : null,
                      cupom.emailEnviado ? null : "e-mail não saiu",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" style={{ padding: 18, display: "grid", gap: 10, alignContent: "start" }} aria-labelledby="conta-pagamentos">
          <h2 id="conta-pagamentos" className="font-titulo" style={estiloTituloDoCartao}>
            Pagamentos recentes
          </h2>
          {c.pagamentos.length === 0 ? (
            <p style={{ margin: 0 }}>Nenhum pagamento.</p>
          ) : (
            <table className="table" aria-label="Pagamentos recentes da conta">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col" className="rel-num">
                    Valor
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {c.pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td>{dia(p.ocorridoEm)}</td>
                    <td className="rel-num">{formatarValor(p.valorCentavos, p.moeda)}</td>
                    <td>
                      <span className={p.status === "paga" ? "selo selo-ok" : "selo selo-risco"}>{ROTULO_DO_PAGAMENTO[p.status] ?? p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ margin: 0, fontSize: 12.5, opacity: 0.7 }}>Os 12 mais recentes, como o webhook da Stripe guardou. Reembolso é no painel da Stripe.</p>
        </section>
      </div>
    </div>
  );
}
