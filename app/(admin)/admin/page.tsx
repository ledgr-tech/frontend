import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarCnpj } from "../../(auth)/cadastro/passos";
import { formatarDataHora } from "../../(app)/e/[empresa]/dashboard/resumo";
import { listarContas } from "./acoes";
import { POR_PAGINA, ROTULO_DA_SITUACAO, SITUACOES, agoraEmMs, chaveDaSituacao, classeDoSelo, prazoDoTeste } from "./situacao";

type Busca = { busca?: string; situacao?: string; ordem?: string; pagina?: string };

const FILTROS = [{ valor: "", rotulo: "Todas" }, ...SITUACOES.map((s) => ({ valor: s, rotulo: ROTULO_DA_SITUACAO[s] }))];

function endereco(base: Busca, pagina: number): string {
  const q = new URLSearchParams();
  if (base.busca) q.set("busca", base.busca);
  if (base.situacao) q.set("situacao", base.situacao);
  if (base.ordem) q.set("ordem", base.ordem);
  if (pagina > 1) q.set("pagina", String(pagina));
  const texto = q.toString();
  return texto ? `/admin?${texto}` : "/admin";
}

const dia = (iso: string) => formatarDataHora(iso).slice(0, 10);

/**
 * As contas clientes (#222), no padrão da tela Empresas (opção B do 28/10): filtros de situação em abas,
 * busca por razão social, CNPJ ou e-mail do admin, e a tabela num cartão com a paginação no rodapé, 20 por
 * página. É um formulário GET, sem JS: o botão Buscar vem primeiro no DOM para ser o que o Enter aciona.
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtros = await searchParams;
  const pagina = Number(filtros.pagina) || 1;
  const r = await listarContas({ ...filtros, pagina });
  if (!r.ok && r.status === 401) redirect("/login");
  // não é da equipe do Ledgr: a rota não existe para a pessoa
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();
  const agora = agoraEmMs();
  const situacaoAtual = filtros.situacao ?? "";

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">Painel interno</div>
          <h1 className="tela-titulo">Contas</h1>
          {r.ok && <span className="vg-subtitulo tela-contexto">{`${r.dados.total} ${r.dados.total === 1 ? "conta cliente" : "contas clientes"}`}</span>}
        </div>
      </div>

      <form method="get" role="search" className="extratos-corpo" style={{ paddingTop: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, order: 2 }}>
            <input
              className="input"
              type="search"
              name="busca"
              defaultValue={filtros.busca ?? ""}
              placeholder="Razão social, CNPJ ou e-mail do admin"
              aria-label="Buscar conta"
              style={{ width: 300 }}
            />
            <select className="input" name="ordem" defaultValue={filtros.ordem ?? ""} aria-label="Ordem">
              <option value="">Mais novas primeiro</option>
              <option value="teste_termina_em">Teste termina antes</option>
            </select>
            <button type="submit" name="situacao" value={situacaoAtual} className="btn btn-secondary">
              Buscar
            </button>
          </div>
          <div className="pills segmentado" role="group" aria-label="Situação" style={{ order: 1 }}>
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
          <p>Nenhuma conta encontrada.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table" aria-label="Contas clientes">
              <thead>
                <tr>
                  <th scope="col">Conta</th>
                  <th scope="col">Plano</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Teste termina</th>
                  <th scope="col">Criada em</th>
                  <th scope="col">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.dados.itens.map((c) => {
                  const chave = chaveDaSituacao(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.razaoSocial}</strong>
                        <div style={{ fontSize: 12.5, opacity: 0.65 }}>{formatarCnpj(c.cnpj)}</div>
                      </td>
                      <td>{c.plano ?? "—"}</td>
                      <td>
                        <span className={classeDoSelo(chave)}>{ROTULO_DA_SITUACAO[chave] ?? c.situacao}</span>
                      </td>
                      <td>
                        {c.testeTerminaEm ? (
                          <>
                            {dia(c.testeTerminaEm)} <span style={{ opacity: 0.65 }}>{`· ${prazoDoTeste(c.testeTerminaEm, agora)}`}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{dia(c.criadaEm)}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link className="btn btn-ghost" href={`/admin/${c.id}`} aria-label={`Abrir ${c.razaoSocial}`}>
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <nav
              aria-label="Páginas"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--color-divider)", fontSize: 14 }}
            >
              <span>{`${r.dados.offset + 1} a ${r.dados.offset + r.dados.itens.length} de ${r.dados.total} contas`}</span>
              <span style={{ display: "flex", gap: 8 }}>
                {pagina > 1 ? (
                  <Link className="btn btn-ghost" href={endereco(filtros, pagina - 1)}>
                    Anterior
                  </Link>
                ) : (
                  <span className="btn btn-ghost" aria-disabled="true" style={{ opacity: 0.45 }}>
                    Anterior
                  </span>
                )}
                {pagina * POR_PAGINA < r.dados.total ? (
                  <Link className="btn btn-secondary" href={endereco(filtros, pagina + 1)}>
                    Próxima
                  </Link>
                ) : (
                  <span className="btn btn-secondary" aria-disabled="true" style={{ opacity: 0.45 }}>
                    Próxima
                  </span>
                )}
              </span>
            </nav>
          </div>
        )}
      </form>
    </div>
  );
}
