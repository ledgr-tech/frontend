import Link from "next/link";
import { POR_PAGINA } from "./situacao";

const SECOES = [
  { href: "/admin", rotulo: "Contas" },
  { href: "/admin/estados", rotulo: "Estados" },
  { href: "/admin/pagamentos", rotulo: "Pagamentos" },
  { href: "/admin/cancelamentos", rotulo: "Cancelamentos" },
  { href: "/admin/vencimentos", rotulo: "Vencimentos" },
] as const;

/** As telas do painel interno (#222 e #236), como links no controle segmentado. */
export function NavDoAdmin({ atual }: { atual: (typeof SECOES)[number]["href"] }) {
  return (
    <nav aria-label="Painel interno" className="pills segmentado adm-folga-baixo-16">
      {SECOES.map((s) => (
        <Link key={s.href} href={s.href} className="pill" aria-current={s.href === atual ? "page" : undefined}>
          {s.rotulo}
        </Link>
      ))}
    </nav>
  );
}

/** O rodapé da tabela: "1 a 20 de 53 contas" e Anterior/Próxima, `endereco(pagina)` montando o link. */
export function Paginacao({
  pagina,
  offset,
  quantos,
  total,
  nome,
  endereco,
}: {
  pagina: number;
  offset: number;
  quantos: number;
  total: number;
  nome: string;
  endereco: (pagina: number) => string;
}) {
  return (
    <nav
      aria-label="Páginas"
      className="adm-rodape-tabela"
    >
      <span>{`${offset + 1} a ${offset + quantos} de ${total} ${nome}`}</span>
      <span className="adm-linha">
        {pagina > 1 ? (
          <Link className="btn btn-ghost" href={endereco(pagina - 1)}>
            Anterior
          </Link>
        ) : (
          <span className="btn btn-ghost adm-desligado" aria-disabled="true">
            Anterior
          </span>
        )}
        {pagina * POR_PAGINA < total ? (
          <Link className="btn btn-secondary" href={endereco(pagina + 1)}>
            Próxima
          </Link>
        ) : (
          <span className="btn btn-secondary adm-desligado" aria-disabled="true">
            Próxima
          </span>
        )}
      </span>
    </nav>
  );
}
