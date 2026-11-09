import { notFound } from "next/navigation";
import { pareceUuid } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { Cabecalho } from "../../../../cabecalho";
import { FalhaAoCarregar } from "../../../../falha-ao-carregar";
import { verificarNovaVersao } from "../../../acoes";
import { carregarRascunho, recuperarExtratoConfirmado } from "../acoes";
import { RetomarNovaVersao } from "./retomar-nova-versao";
import { Revisao } from "./revisao";

/** A conferência da importação via IA, tanto na primeira conciliação quanto no reenvio. */
export default async function RevisaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ banco?: string | string[]; sistemaAnterior?: string | string[] }>;
}) {
  const [{ id }, { banco, sistemaAnterior }] = await Promise.all([params, searchParams]);
  const novaVersao = banco !== undefined || sistemaAnterior !== undefined;
  if (
    novaVersao &&
    (typeof banco !== "string" || !pareceUuid(banco) ||
      (sistemaAnterior !== undefined && (typeof sistemaAnterior !== "string" || !pareceUuid(sistemaAnterior))))
  ) {
    notFound();
  }

  const origem = typeof banco === "string"
    ? { banco, sistemaAnterior: typeof sistemaAnterior === "string" ? sistemaAnterior : undefined }
    : undefined;
  const voltar = origem
    ? { href: caminhoDaConciliacao(origem.banco, origem.sistemaAnterior), rotulo: "Voltar à comparação" }
    : { href: "/conciliacoes/nova", rotulo: "Voltar à nova conciliação" };

  const r = await carregarRascunho(id);
  if (!r.ok && r.status === 401) await redirecionarNoApp("/login");
  if (!r.ok && r.status === 404 && !origem) notFound();
  let conteudo;
  if (origem && (r.ok || r.status === 409)) {
    const alvo = await verificarNovaVersao(origem.banco, origem.sistemaAnterior, id);
    if (!alvo.ok) {
      if (alvo.status === 401) await redirecionarNoApp("/login");
      conteudo = <FalhaAoCarregar oQue="a comparação de origem" status={alvo.status} texto={alvo.erro} voltar={voltar} />;
    } else {
      const contexto = { ...origem, arquivoBanco: alvo.dados.arquivoBanco };
      if (r.ok) {
        conteudo = <Revisao inicial={r.dados} contexto={contexto} />;
      } else {
        const confirmado = await recuperarExtratoConfirmado(id);
        if (!confirmado.ok && confirmado.status === 401) await redirecionarNoApp("/login");
        conteudo = confirmado.ok
          ? <RetomarNovaVersao contexto={contexto} importacaoId={id} />
          : <FalhaAoCarregar oQue="o extrato confirmado" status={confirmado.status} texto={confirmado.erro} voltar={voltar} />;
      }
    }
  } else {
    conteudo = r.ok
      ? <Revisao inicial={r.dados} />
      : <FalhaAoCarregar oQue="o rascunho" status={r.status} texto={r.erro} voltar={voltar} />;
  }

  return (
    <div className="nova-tela">
      <Cabecalho
        titulo="Conferir a importação"
        contexto={[origem ? "Nova versão do extrato do sistema" : "rascunho · nada entra no Ledgr antes de você confirmar"]}
      />
      {conteudo}
    </div>
  );
}
