import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { carregarFechamentos } from "../conciliacoes/acoes";
import { formatarInteiro } from "../dashboard/resumo";
import { agruparPorMes } from "./fechamento";
import { InkHover, Reveal } from "@/app/reveal";
import { MesaDeFechamento } from "./mesa";
import { Cabecalho } from "../cabecalho";

/**
 * Os fechamentos, mês a mês: cada competência com o que ainda segura o
 * fechamento (divergência sem decisão, linha que o parser não leu) e o caminho
 * até lá. Um mês é todos os pares de extratos conciliados dele.
 *
 * Do FECHAMENTO do design (Ledgr.dc.html) ficam o "Começar outubro" e a
 * comemoração do mês pronto. O resto — "encerrado em", o parágrafo das decisões,
 * os marcos e o "Entregar o fechamento" — pede o que o backend não guarda: o
 * encerramento do mês e as decisões de cada linha. O relatório para o contador
 * é o CSV da conciliação, que existe.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar os fechamentos. Recarregue a página e tente de novo.";

export default async function FechamentosPage() {
  const resposta = await carregarFechamentos();
  if (!resposta.ok && resposta.status === 401) redirect("/login");

  const meses = resposta.ok ? agruparPorMes(resposta.dados) : [];

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
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : meses.length === 0 ? (
        <SemConciliacao />
      ) : (
        <Reveal once style={{ padding: "28px 0 56px" }}>
          <MesaDeFechamento meses={meses} />
        </Reveal>
      )}
    </div>
  );
}

function SemConciliacao() {
  return (
    <div className="vg-inicio">
      <InkHover style={{ flex: "none" }}>
        <Image
          src="/mascotes/mascote-sentado.png"
          alt="Mascote Ledgr sentado com uma folha"
          width={1000}
          height={1000}
          sizes="200px"
          style={{ width: 200, height: "auto", display: "block" }}
        />
      </InkHover>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Nenhum mês para fechar ainda.</h2>
      <p className="vg-inicio-texto">
        Suba o extrato do banco e o extrato do sistema de gestão. A primeira conciliação fica
        pronta em poucos minutos.
      </p>
      <Link href="/conciliacoes/nova" className="btn btn-primary">
        Nova conciliação
      </Link>
    </div>
  );
}
