import Link from "@/lib/link-do-app";
import { TelaDeAviso } from "@/app/tela-de-aviso";

/**
 * A tela vazia de Conciliações, Extratos, Fechamentos e Histórico (#388): o mesmo
 * mascote e a mesma ação, "Nova conciliação", em todas.
 */
export function SemNada({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <TelaDeAviso titulo={titulo} texto={texto} mascote="explicando" nivel="h2">
      <Link href="/conciliacoes/nova" className="btn btn-primary">
        Nova conciliação
      </Link>
    </TelaDeAviso>
  );
}
