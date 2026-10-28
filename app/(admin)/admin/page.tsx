import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatarCnpj } from "../../(auth)/cadastro/passos";
import { formatarDataHora } from "../../(app)/e/[empresa]/dashboard/resumo";
import { POR_PAGINA, ROTULO_DA_SITUACAO, SITUACOES, listarContas } from "./acoes";

type Busca = { busca?: string; situacao?: string; ordem?: string; pagina?: string };

function endereco(base: Busca, pagina: number): string {
  const q = new URLSearchParams();
  if (base.busca) q.set("busca", base.busca);
  if (base.situacao) q.set("situacao", base.situacao);
  if (base.ordem) q.set("ordem", base.ordem);
  if (pagina > 1) q.set("pagina", String(pagina));
  const texto = q.toString();
  return texto ? `/admin?${texto}` : "/admin";
}

/** As contas clientes (#222): busca por razão social, CNPJ ou e-mail do admin, filtro de situação, 20 por página. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtros = await searchParams;
  const pagina = Number(filtros.pagina) || 1;
  const r = await listarContas({ ...filtros, pagina });
  if (!r.ok && r.status === 401) redirect("/login");
  // não é da equipe do Ledgr: a rota não existe para a pessoa
  if (!r.ok && (r.status === 403 || r.status === 404)) notFound();

  return (
    <div>
      <div className="det-kicker">Painel interno</div>
      <h1 className="tela-titulo">Contas</h1>
      <form method="get" role="search" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <input
          className="input"
          type="search"
          name="busca"
          defaultValue={filtros.busca ?? ""}
          placeholder="Razão social, CNPJ ou e-mail do admin"
          aria-label="Buscar conta"
          style={{ flex: "1 1 260px" }}
        />
        <select className="input" name="situacao" defaultValue={filtros.situacao ?? ""} aria-label="Situação">
          <option value="">Todas as situações</option>
          {SITUACOES.map((s) => (
            <option key={s} value={s}>
              {ROTULO_DA_SITUACAO[s]}
            </option>
          ))}
        </select>
        <select className="input" name="ordem" defaultValue={filtros.ordem ?? ""} aria-label="Ordem">
          <option value="">Mais novas primeiro</option>
          <option value="teste_termina_em">Teste termina antes</option>
        </select>
        <button type="submit" className="btn btn-primary">
          Filtrar
        </button>
      </form>

      {!r.ok ? (
        <p role="alert">{r.erro}</p>
      ) : r.dados.itens.length === 0 ? (
        <p>Nenhuma conta encontrada.</p>
      ) : (
        <>
          <table className="table" aria-label="Contas clientes">
            <thead>
              <tr>
                <th scope="col">Razão social</th>
                <th scope="col">CNPJ</th>
                <th scope="col">Plano</th>
                <th scope="col">Situação</th>
                <th scope="col">Teste termina</th>
                <th scope="col">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {r.dados.itens.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/${c.id}`}>{c.razaoSocial}</Link>
                  </td>
                  <td>{formatarCnpj(c.cnpj)}</td>
                  <td>{c.plano ?? "—"}</td>
                  <td>{ROTULO_DA_SITUACAO[c.inativa ? "inativa" : c.situacao] ?? c.situacao}</td>
                  <td>{c.testeTerminaEm ? formatarDataHora(c.testeTerminaEm).slice(0, 10) : "—"}</td>
                  <td>{formatarDataHora(c.criadaEm).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <nav aria-label="Páginas" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
            {pagina > 1 && <Link href={endereco(filtros, pagina - 1)}>Anterior</Link>}
            <span>{`${r.dados.total} ${r.dados.total === 1 ? "conta" : "contas"} · página ${pagina} de ${Math.max(1, Math.ceil(r.dados.total / POR_PAGINA))}`}</span>
            {pagina * POR_PAGINA < r.dados.total && <Link href={endereco(filtros, pagina + 1)}>Próxima</Link>}
          </nav>
        </>
      )}
    </div>
  );
}
