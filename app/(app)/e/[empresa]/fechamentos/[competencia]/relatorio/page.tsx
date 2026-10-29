import Link from "@/lib/link-do-app";
import { notFound } from "next/navigation";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { ArrowLeft } from "lucide-react";
import { caminhoDoFechamento } from "@/lib/caminhos";
import { carregarRelatorioDoFechamento } from "../../../conciliacoes/acoes";
import { tituloDaCompetencia } from "../../fechamento";
import { Folha } from "../../folha";
import { montarRelatorio } from "../../relatorio";
import { Imprimir } from "./imprimir";

/**
 * O relatório do fechamento do mês (#117): a página que o contador imprime ou salva em PDF, o
 * "Relatório em PDF" do "Entregar o fechamento" do design (Ledgr.dc.html). Na tela, uma prévia da
 * folha com o botão de imprimir; na impressão, só a folha, em A4 (`.rel-*` em globals.css).
 */

const FALHA_AO_CARREGAR = "Não foi possível carregar o relatório. Recarregue a página e tente de novo.";

export default async function RelatorioPage({ params, searchParams }: PageProps<"/e/[empresa]/fechamentos/[competencia]/relatorio">) {
  const { competencia } = await params;
  const { imprimir } = await searchParams;
  const resposta = await carregarRelatorioDoFechamento(competencia);
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");
  if (!resposta.ok && resposta.status === 404) notFound();

  const voltar = caminhoDoFechamento(competencia);
  const dados = resposta.ok ? resposta.dados : null;

  return (
    <div className="rel-pagina">
      <div className="rel-barra">
        <Link href={voltar} className="btn btn-ghost">
          <ArrowLeft size={16} aria-hidden />
          Fechamentos
        </Link>
        {dados?.fechamento && <Imprimir automatico={imprimir === "1"} />}
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : !resposta.dados.fechamento ? (
        <div className="rel-aviso">
          <h1>{`${tituloDaCompetencia(competencia)} ainda não está fechado.`}</h1>
          <p>O relatório fica pronto quando o mês é fechado. Feche o mês na tela de Fechamentos e volte aqui.</p>
          <Link href={voltar} className="btn btn-primary">
            Ir para Fechamentos
          </Link>
        </div>
      ) : (
        <Folha relatorio={montarRelatorio(resposta.dados)} />
      )}
    </div>
  );
}
