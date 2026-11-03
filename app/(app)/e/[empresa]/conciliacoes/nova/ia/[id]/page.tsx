import { notFound } from "next/navigation";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { Cabecalho } from "../../../../cabecalho";
import { carregarRascunho } from "../acoes";
import { Revisao } from "./revisao";

/** A conferência da importação via IA (#225): o rascunho, como a tela de marcar colunas, antes de entrar no sistema. */
export default async function RevisaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await carregarRascunho(id);
  if (!r.ok && r.status === 401) await redirecionarNoApp("/login");
  if (!r.ok && r.status === 404) notFound();
  return (
    <div className="nova-tela">
      <Cabecalho titulo="Conferir a importação" contexto={["rascunho · nada entra no Ledgr antes de você confirmar"]} />
      {r.ok ? (
        <Revisao inicial={r.dados} />
      ) : (
        <p role="alert" style={{ padding: "48px 0" }}>
          {r.erro}
        </p>
      )}
    </div>
  );
}
