import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight, ArrowRight, CalendarCheck, Files, History, type LucideIcon } from "lucide-react";
import { extratosDasExecucoes, type Execucao } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { EMPRESA_MOCK, type Conciliacao } from "@/lib/mock-data";
import { carregarVisaoGeral, type VisaoGeral } from "../conciliacoes/acoes";
import {
  formatarDataHora,
  formatarInteiro,
  formatarMoedaCurta,
  formatarPercentual,
  resumir,
} from "../dashboard/resumo";
import { GraficoDeMatch } from "../historico/grafico";
import { IconeOrigem } from "../icone-origem";
import { NOTA_VER_ATUAL, VerExecucao } from "../historico/ver-execucao";
import { pendencias } from "./pendencias";

/**
 * A home do app: onde o mês está, os atalhos para as outras telas (cada um com o
 * estado dela), o que pede decisão, para onde a taxa de match vai e o que
 * aconteceu por último. Não existe no design — é composta com as peças que as
 * outras telas já têm, e só com dado real: sem execução, vira o guia dos
 * primeiros passos.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar a visão geral. Recarregue a página e tente de novo.";

/** Quantas execuções a atividade recente mostra; o resto fica no histórico. */
const NA_ATIVIDADE = 5;

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

export default async function VisaoGeralPage() {
  const resposta = await carregarVisaoGeral();
  if (!resposta.ok && resposta.status === 401) redirect("/login");

  const recente = resposta.ok ? resposta.dados.recente : null;

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Visão geral</h1>
          <span className="vg-subtitulo">
            {recente
              ? `${EMPRESA_MOCK} · competência ${recente.conciliacao.mes.toLowerCase()}`
              : EMPRESA_MOCK}
          </span>
        </div>
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Nova conciliação
        </Link>
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : recente === null ? (
        <PrimeirosPassos />
      ) : (
        <Conteudo visao={resposta.dados} execucao={recente.execucao} conciliacao={recente.conciliacao} />
      )}
    </div>
  );
}

function Conteudo({
  visao,
  execucao,
  conciliacao,
}: {
  visao: VisaoGeral;
  execucao: Execucao;
  conciliacao: Conciliacao;
}) {
  const resumo = resumir([conciliacao]);

  return (
    <div className="vg-corpo">
      <EstadoDoMes execucao={execucao} resumo={resumo} />

      <Atalhos visao={visao} execucao={execucao} conciliacao={conciliacao} divergentes={resumo.divergentes} />

      <div className="vg-grade">
        <PedeAtencao conciliacao={conciliacao} arquivos={visao.arquivosComLinhasNaoLidas} />
        <section className="vg-tendencia" aria-label="Tendência da taxa de match">
          <GraficoDeMatch execucoes={visao.execucoes} />
        </section>
      </div>

      <AtividadeRecente execucoes={visao.execucoes.slice(0, NA_ATIVIDADE)} total={visao.total} />
    </div>
  );
}

function EstadoDoMes({
  execucao,
  resumo,
}: {
  execucao: Execucao;
  resumo: ReturnType<typeof resumir>;
}) {
  return (
    <section className="vg-estado" aria-labelledby="vg-estado-titulo">
      <div className="vg-estado-topo">
        <h2 id="vg-estado-titulo" className="vg-estado-titulo">
          {`${formatarInteiro(resumo.batidos)} de ${plural(resumo.processados, "lançamento conciliado", "lançamentos conciliados")}`}
        </h2>
        {resumo.valorDivergente > 0 ? (
          <span className="vg-estado-aberto">{`${formatarMoedaCurta(resumo.valorDivergente)} em aberto`}</span>
        ) : (
          <span className="vg-estado-aberto" data-zerado="true">
            Nenhum valor em aberto
          </span>
        )}
      </div>
      <div
        className="vg-progresso"
        role="progressbar"
        aria-label="Lançamentos conciliados"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(resumo.taxaMatch)}
        aria-valuetext={`${formatarPercentual(resumo.taxaMatch)} conciliado`}
      >
        <span className="vg-progresso-feito" style={{ width: `${resumo.taxaMatch}%` }} />
      </div>
      <div className="vg-estado-rodape">
        <span className="vg-nota">
          {`Última conciliação em ${formatarDataHora(execucao.executadaEm)} · ${execucao.arquivoBanco} × ${execucao.arquivoSistema}`}
        </span>
        <Link
          href={caminhoDaConciliacao(execucao.extratoBancoId, execucao.extratoSistemaId)}
          className="btn btn-secondary"
        >
          Ver a conciliação
        </Link>
      </div>
    </section>
  );
}

/**
 * O hub: um cartão por tela, cada um com o estado dela, para a pessoa chegar a
 * qualquer lugar do app pela home. Tudo sai do que a visão geral já carregou —
 * nenhuma chamada a mais ao backend.
 */
function Atalhos({
  visao,
  execucao,
  conciliacao,
  divergentes,
}: {
  visao: VisaoGeral;
  execucao: Execucao;
  conciliacao: Conciliacao;
  divergentes: number;
}) {
  const arquivos = extratosDasExecucoes(visao.execucoes);
  const doBanco = arquivos.filter((arquivo) => arquivo.origem === "banco").length;
  const pares = visao.execucoes.filter((item) => item.atual).length;
  const naoLidas = visao.arquivosComLinhasNaoLidas.reduce((soma, arquivo) => soma + arquivo.linhas, 0);
  const pronto = divergentes === 0 && naoLidas === 0;

  return (
    <nav aria-labelledby="vg-atalhos-titulo">
      <h2 id="vg-atalhos-titulo" className="vg-secao-titulo">
        Atalhos
      </h2>
      <ul className="vg-atalhos">
        <Atalho href="/extratos" icone={Files} nome="Extratos" numero={plural(arquivos.length, "arquivo", "arquivos")}>
          <span className="vg-atalho-detalhe">
            {`${formatarInteiro(doBanco)} do banco · ${formatarInteiro(arquivos.length - doBanco)} do sistema`}
          </span>
          {/* os dois arquivos da conciliação mais recente */}
          <span className="vg-atalho-arquivos">
            {arquivos.slice(0, 2).map((arquivo) => (
              <span key={arquivo.id} className="vg-atalho-arquivo">
                <IconeOrigem origem={arquivo.origem} tamanho={14} />
                {arquivo.nome}
              </span>
            ))}
          </span>
          {naoLidas > 0 && (
            <span className="vg-atalho-aviso">
              <span className="vg-ponto vg-ponto-atencao" aria-hidden="true" />
              {plural(naoLidas, "linha não lida", "linhas não lidas")}
            </span>
          )}
        </Atalho>

        <Atalho
          href="/dashboard"
          icone={ArrowLeftRight}
          nome="Conciliações"
          numero={plural(pares, "conciliação", "conciliações")}
        >
          <span className="vg-atalho-detalhe">{`Última em ${formatarDataHora(execucao.executadaEm)}`}</span>
        </Atalho>

        <Atalho
          href="/fechamentos"
          icone={CalendarCheck}
          nome="Fechamentos"
          numero={conciliacao.mes.replace("/", " de ")}
        >
          {/* a home só carrega a última conciliação: o mês inteiro, com todos os
              pares dele, é a tela de fechamentos que soma */}
          <span className="vg-atalho-aviso">
            <span className={`vg-ponto vg-ponto-${pronto ? "ok" : "atencao"}`} aria-hidden="true" />
            {pronto
              ? "Última conciliação sem pendência"
              : divergentes > 0
                ? `${plural(divergentes, "pendência", "pendências")} na última conciliação`
                : "Linhas não lidas na última conciliação"}
          </span>
        </Atalho>

        <Atalho
          href="/historico"
          icone={History}
          nome="Histórico"
          numero={plural(visao.total, "execução", "execuções")}
        >
          {execucao.acerto !== null && (
            <span className="vg-atalho-detalhe">{`Match de ${formatarPercentual(execucao.acerto)} na última`}</span>
          )}
        </Atalho>
      </ul>
    </nav>
  );
}

function Atalho({
  href,
  icone: Icone,
  nome,
  numero,
  children,
}: {
  href: string;
  icone: LucideIcon;
  nome: string;
  numero: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="vg-atalho">
        <span className="vg-atalho-topo">
          <Icone size={16} aria-hidden="true" />
          {nome}
          <ArrowRight size={16} aria-hidden="true" className="vg-atalho-ir" />
        </span>
        <span className="vg-atalho-numero">{numero}</span>
        {children}
      </Link>
    </li>
  );
}

function PedeAtencao({
  conciliacao,
  arquivos,
}: {
  conciliacao: Conciliacao;
  arquivos: VisaoGeral["arquivosComLinhasNaoLidas"];
}) {
  const grupos = pendencias(conciliacao);

  return (
    <section className="vg-atencao">
      <h2 id="vg-atencao-titulo" className="vg-secao-titulo">
        Pede sua atenção
      </h2>
      {grupos.length === 0 && arquivos.length === 0 ? (
        <div className="vg-tudo-certo">
          <Image
            src="/mascotes/mascote-comemorando.png"
            alt=""
            width={1000}
            height={1000}
            sizes="72px"
            style={{ width: 72, height: "auto", flex: "none" }}
          />
          <p style={{ margin: 0 }}>Nada pede sua atenção agora.</p>
        </div>
      ) : (
        <ul className="vg-lista" aria-labelledby="vg-atencao-titulo">
          {grupos.map((grupo) => (
            <li key={grupo.rotulo}>
              <Link href={grupo.href} className="vg-item">
                <span className={`vg-ponto vg-ponto-${grupo.tom}`} aria-hidden="true" />
                <span className="vg-item-corpo">
                  <span className="vg-item-titulo">{grupo.rotulo}</span>
                  <span className="vg-item-detalhe">
                    {/* data trocada com o mesmo valor não deixa dinheiro em aberto: "R$ 0" confundiria */}
                    {grupo.valor > 0
                      ? `${plural(grupo.quantidade, "lançamento", "lançamentos")} · ${formatarMoedaCurta(grupo.valor)}`
                      : plural(grupo.quantidade, "lançamento", "lançamentos")}
                  </span>
                </span>
                <span className="vg-item-acao">Revisar</span>
              </Link>
            </li>
          ))}
          {/* o que o parser não leu nem entrou na conciliação: o número acima está incompleto */}
          {arquivos.map((arquivo) => (
            <li key={arquivo.nome}>
              <Link href="/extratos" className="vg-item">
                <span className="vg-ponto vg-ponto-atencao" aria-hidden="true" />
                <span className="vg-item-corpo">
                  <span className="vg-item-titulo">Linhas não lidas</span>
                  <span className="vg-item-detalhe">
                    {`${plural(arquivo.linhas, "linha", "linhas")} em ${arquivo.nome}`}
                  </span>
                </span>
                <span className="vg-item-acao">Ver extratos</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AtividadeRecente({ execucoes, total }: { execucoes: Execucao[]; total: number }) {
  return (
    <section>
      <div className="vg-secao-topo">
        <h2 id="vg-atividade-titulo" className="vg-secao-titulo">
          Atividade recente
        </h2>
        <Link href="/historico" className="btn btn-secondary" style={{ fontSize: 13.5 }}>
          Ver histórico
        </Link>
      </div>
      <div className="dash-tabela-rolagem">
        <table className="table" aria-labelledby="vg-atividade-titulo">
          <thead>
            <tr>
              <th style={{ width: 160 }}>Executada em</th>
              <th>Arquivos</th>
              <th style={{ width: 120, textAlign: "right" }}>Lançamentos</th>
              <th style={{ width: 100, textAlign: "right" }}>Match</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {execucoes.map((execucao) => (
              <tr key={execucao.id}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatarDataHora(execucao.executadaEm)}
                </td>
                <td style={{ overflowWrap: "anywhere" }}>
                  {`${execucao.arquivoBanco} × ${execucao.arquivoSistema}`}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatarInteiro(execucao.lancamentos)}
                </td>
                <td className="dash-valor-celula">
                  {execucao.acerto === null ? "—" : formatarPercentual(execucao.acerto)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <VerExecucao execucao={execucao} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > execucoes.length && (
        <p className="vg-nota" style={{ margin: "12px 0 0" }}>
          {`As ${execucoes.length} mais recentes de ${formatarInteiro(total)}.`}
        </p>
      )}
      {execucoes.some((execucao) => !execucao.atual) && (
        <p className="vg-nota" style={{ margin: "12px 0 0" }}>
          {NOTA_VER_ATUAL}
        </p>
      )}
    </section>
  );
}

// Os passos e as dicas vêm do onboarding do design (ONB em Ledgr.dc.html), com os
// numerais romanos dele; o que era cadastro virou upload, que é o que existe.
const PASSOS = [
  {
    numeral: "I",
    titulo: "Suba o extrato do banco",
    texto:
      "É esse extrato que define a verdade da conciliação. Prefira o OFX: ele já vem com data, valor e identificador do lançamento, o que eleva a taxa de match automático.",
  },
  {
    numeral: "II",
    titulo: "Suba o extrato do sistema de gestão",
    texto: "O CSV exportado do seu ERP funciona — Cigam, Bling, Tiny ou outro.",
  },
  {
    numeral: "III",
    titulo: "Revise o que não bateu",
    texto: "Toda divergência é reportada como “o sistema diverge do banco”, nunca o contrário.",
  },
];

function PrimeirosPassos() {
  return (
    <div className="vg-inicio">
      <Image
        src="/mascotes/mascote-sentado.png"
        alt="Mascote Ledgr sentado com uma folha"
        width={1000}
        height={1000}
        sizes="200px"
        style={{ width: 200, height: "auto", display: "block" }}
      />
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400, textWrap: "balance" }}>
        Nenhum extrato por aqui ainda.
      </h2>
      <p className="vg-inicio-texto">
        Suba o extrato do banco e o extrato do sistema de gestão. A primeira conciliação fica
        pronta em poucos minutos.
      </p>
      <ol className="grade-colunas vg-passos" aria-label="Primeiros passos">
        {PASSOS.map((passo) => (
          <li key={passo.numeral} className="vg-passo">
            <span className="vg-passo-numeral" aria-hidden="true">
              {passo.numeral}
            </span>
            <h3 className="vg-passo-titulo">{passo.titulo}</h3>
            <p className="vg-passo-texto">{passo.texto}</p>
          </li>
        ))}
      </ol>
      <Link href="/conciliacoes/nova" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 22px" }}>
        Fazer o primeiro upload
      </Link>
    </div>
  );
}
