import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { carregarVisaoGeral } from "../conciliacoes/acoes";
import { Conversa } from "./conversa";
import { montarContexto } from "./respostas";

/**
 * O assistente, "Fale com o Ledgr": uma conversa sobre a conciliação mais
 * recente. Lê o mesmo que a visão geral (a última execução e as linhas dela) e
 * responde com esses números; sem conciliação, não há sobre o que conversar.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível abrir o assistente. Recarregue a página e tente de novo.";

export default async function AssistentePage() {
  const resposta = await carregarVisaoGeral();
  if (!resposta.ok && resposta.status === 401) redirect("/login");
  const contexto = resposta.ok ? montarContexto(resposta.dados) : null;

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Fale com o Ledgr</h1>
          <span className="vg-subtitulo">
            {contexto ? `Assistente · conciliação de ${contexto.mes}` : "Assistente"}
          </span>
        </div>
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : contexto === null ? (
        <div className="vg-inicio">
          <Image
            src="/mascotes/mascote-chatbot.png"
            alt="Mascote Ledgr acenando com balão de fala"
            width={1254}
            height={1254}
            sizes="160px"
            style={{ width: 160, height: "auto", display: "block" }}
          />
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Ainda não há sobre o que conversar.</h2>
          <p className="vg-inicio-texto">
            O Ledgr responde sobre a conciliação mais recente. Suba o extrato do banco e o do sistema de
            gestão para começar.
          </p>
          <Link href="/conciliacoes/nova" className="btn btn-primary">
            Nova conciliação
          </Link>
        </div>
      ) : (
        <div style={{ padding: "28px 0 56px" }}>
          <Conversa contexto={contexto} />
        </div>
      )}
    </div>
  );
}
