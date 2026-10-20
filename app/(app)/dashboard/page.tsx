import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { carregarConciliacoes } from "../conciliacoes/acoes";
import { InkHover, Reveal } from "@/app/reveal";
import { Cabecalho } from "../cabecalho";
import { formatarInteiro } from "./resumo";
import { agruparPorMes, pedemDecisao } from "./lista";
import { AgoraDeConciliacoes } from "./em-andamento";
import { ColunaDaTela } from "../coluna/coluna";
import { ListaDeTrabalho } from "./lista-de-trabalho";

/**
 * Conciliações como lista de trabalho: cada extrato do banco uma vez, na rodada que vale, agrupada
 * pelo mês, com o que ainda falta decidir, e no topo a faixa para continuar de onde parou. O resumo do mês fica na visão geral,
 * o trabalho linha a linha na comparação e o que já aconteceu no histórico.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar suas conciliações. Recarregue a página e tente de novo.";

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

export default async function DashboardPage() {
  const resposta = await carregarConciliacoes();
  if (!resposta.ok && resposta.status === 401) redirect("/login");

  const conciliacoes = resposta.ok ? resposta.dados.conciliacoes : [];
  const pendentes = conciliacoes.filter((conciliacao) => pedemDecisao(conciliacao) > 0).length;
  // a faixa "Continue de onde parou" só existe quando alguma conciliação ainda pede decisão
  const contagem = resposta.ok ? resposta.dados.emAndamento : null;
  const daContagem = contagem && conciliacoes.find((item) => item.extratoBancoId === contagem.extratoBancoId);
  const emAndamento = contagem && daContagem ? { conciliacao: daContagem, contagem } : null;

  // mês pronto = o que a lista oferece a fechar: aberto e sem nada a decidir
  const pronto = resposta.ok
    ? agruparPorMes(conciliacoes, resposta.dados.fechamentos).find((mes) => mes.fechamento === null && mes.pedemDecisao === 0)
    : undefined;
  const prontoParaFechar = pronto ? { competencia: pronto.chave, titulo: pronto.titulo } : null;

  return (
    <div>
      {/* o menu chama esta tela de Conciliações: o título é o mesmo */}
      <Cabecalho
        titulo="Conciliações"
        contexto={[
          conciliacoes.length > 0 && plural(conciliacoes.length, "conciliação", "conciliações"),
          pendentes > 0 && `${formatarInteiro(pendentes)} ${pendentes === 1 ? "pede" : "pedem"} decisão`,
        ]}
      />

      {!resposta.ok ? (
        <p role="alert" className="extratos-vazio">
          {FALHA_AO_CARREGAR}
        </p>
      ) : conciliacoes.length === 0 ? (
        <>
          <ColunaDaTela>
            <AgoraDeConciliacoes emAndamento={null} prontoParaFechar={null} />
          </ColunaDaTela>
          <SemConciliacoes />
        </>
      ) : (
        <div className="conc-corpo">
          <ColunaDaTela pendente={emAndamento !== null}>
            <AgoraDeConciliacoes emAndamento={emAndamento} prontoParaFechar={prontoParaFechar} />
          </ColunaDaTela>
          <Reveal delay={0.08}>
            <ListaDeTrabalho
              conciliacoes={conciliacoes}
              fechamentos={resposta.dados.fechamentos}
              parcial={resposta.dados.parcial}
            />
          </Reveal>
        </div>
      )}
    </div>
  );
}

function SemConciliacoes() {
  return (
    <div
      style={{
        padding: "76px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 18,
      }}
    >
      <InkHover style={{ flex: "none" }}>
        <Image
          src="/mascotes/mascote-explicando.png"
          alt="Mascote Ledgr apontando para você"
          width={1000}
          height={1000}
          sizes="250px"
          style={{ width: 250, height: "auto", display: "block" }}
        />
      </InkHover>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400, maxWidth: "24ch", textWrap: "balance" }}>
        Nenhum extrato por aqui ainda.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.75,
          maxWidth: "48ch",
          color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
        }}
      >
        Suba o extrato do banco e o extrato do sistema de gestão. A primeira conciliação fica pronta em
        poucos minutos.
      </p>
      <Link href="/conciliacoes/nova" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 22px" }}>
        Fazer o primeiro upload
      </Link>
    </div>
  );
}
