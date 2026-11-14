import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { carregarFechamentos } from "../conciliacoes/acoes";
import { formatarInteiro } from "../dashboard/resumo";
import { agruparPorMes } from "./fechamento";
import { Reveal } from "@/app/reveal";
import { MesaDeFechamento } from "./mesa";
import { Cabecalho } from "../cabecalho";
import { FalhaAoCarregar } from "../falha-ao-carregar";
import { SemNada } from "../sem-nada";

/**
 * Os fechamentos, mês a mês: cada competência com o que ainda segura o
 * fechamento (divergência sem decisão, linha que o parser não leu), o caminho
 * até lá e o fechamento em si (`/fechamentos`, backend #86): fechar, com
 * ressalva quando falta algo, e reabrir. Um mês é todos os pares de extratos
 * conciliados dele.
 *
 * Do FECHAMENTO do design (Ledgr.dc.html) ficam o "Começar outubro", a
 * comemoração do mês pronto e o "encerrado em". O parágrafo das decisões e os
 * marcos seguem fora. Do "Entregar o fechamento", o relatório para o contador:
 * o PDF do mês fechado (`[competencia]/relatorio`, #117) e o CSV de cada
 * conciliação; a planilha de ajustes e o envio por e-mail, não.
 */

export default async function FechamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const resposta = await carregarFechamentos();
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");

  const meses = resposta.ok ? agruparPorMes(resposta.dados.pares, resposta.dados.fechamentos ?? []) : [];
  // ?mes=AAAA-MM: a linha das rodadas de uma conciliação chega aqui no mês dela
  const { mes } = await searchParams;

  return (
    <div>
      <Cabecalho
        titulo="Fechamentos"
        contexto={[
          meses.length > 0 &&
            `${formatarInteiro(meses.length)} ${meses.length === 1 ? "competência" : "competências"}`,
        ]}
      />

      {!resposta.ok ? (
        <FalhaAoCarregar oQue="os fechamentos" status={resposta.status} />
      ) : meses.length === 0 ? (
        <SemConciliacao />
      ) : (
        <Reveal style={{ padding: "28px 0 56px" }}>
          <MesaDeFechamento
            meses={meses}
            inicial={typeof mes === "string" ? mes : undefined}
            // sem a lista de fechamentos não dá para saber o que já está fechado: a mesa só mostra
            podeFechar={resposta.dados.fechamentos !== null}
          />
        </Reveal>
      )}
    </div>
  );
}

function SemConciliacao() {
  return <SemNada titulo="Nenhum mês para fechar ainda." texto="Envie o extrato do banco e o extrato do sistema. A primeira conciliação fica pronta em poucos minutos." />;
}
