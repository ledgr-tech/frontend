import { notFound } from "next/navigation";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { Cabecalho } from "../../../../cabecalho";
import { FalhaAoCarregar } from "../../../../falha-ao-carregar";
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
        // o texto do backend diz mais que o genérico: o motivo do rascunho não abrir
        <FalhaAoCarregar oQue="o rascunho" status={r.status} texto={r.erro} voltar={{ href: "/conciliacoes/nova", rotulo: "Voltar à nova conciliação" }} />
      )}
    </div>
  );
}
