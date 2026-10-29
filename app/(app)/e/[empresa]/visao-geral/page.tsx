import Image from "next/image";
import Link from "@/lib/link-do-app";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { ArrowLeftRight, ArrowRight, CalendarCheck, Files, History, type LucideIcon } from "lucide-react";
import { extratosDasExecucoes, type Execucao } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { execucoesVigentes } from "@/lib/rodadas";
import { formatarMoeda, type Conciliacao } from "@/lib/mock-data";
import { carregarRoteiro, carregarVisaoGeral, type VisaoGeral } from "../conciliacoes/acoes";
import { passosDoRoteiro, roteiroVisivel } from "./roteiro";
import { RoteiroFaixa } from "./roteiro-faixa";
import {
  formatarDataHora,
  formatarInteiro,
  formatarMoedaCurta,
  formatarPercentual,
  resumir,
} from "../dashboard/resumo";
import { InkHover, Reveal } from "@/app/reveal";
import { matchNaTela, porConciliacao } from "../historico/execucoes";
import { GraficoDeMatch } from "../historico/grafico";
import { IconeOrigem } from "../icone-origem";
import { pendenciasDoMes } from "./pendencias";
import { Cabecalho } from "../cabecalho";
import type { SaldoDoExtrato } from "@/lib/adaptadores";
import { carregarConexoesMcp, type ConexaoMcp } from "../conexoes-mcp/acoes";
import { SEM_SALDO, data } from "../saldo";
import { CartaoDeConexao } from "./cartao-de-conexao";

/**
 * A home do app: onde o mês está, os atalhos para as outras telas (cada um com o
 * estado dela), o que pede decisão, para onde a taxa de match vai e o que
 * aconteceu por último, em blocos (modelo D do canvas de 29/10). É composta com
 * as peças que as outras telas já têm, e só com dado real: um bloco sem dado não
 * aparece, e sem execução a tela vira o guia dos primeiros passos.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar a visão geral. Recarregue a página e tente de novo.";

/** Quantas conciliações a atividade recente mostra; o resto fica no histórico. */
const NA_ATIVIDADE = 5;

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

export default async function VisaoGeralPage() {
  const [resposta, roteiro, conexoes] = await Promise.all([
    carregarVisaoGeral(),
    carregarRoteiro(),
    // 403 para o analista e 404 com a conexão desligada no backend: em ambos, sem o bloco
    carregarConexoesMcp(),
  ]);
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");

  const recente = resposta.ok ? resposta.dados.recente : null;
  // o roteiro de primeiros passos (spec 2026-10-15-primeiro-uso, parte 4): só no primeiro mês
  const roteiroAtivo = roteiro && roteiroVisivel(roteiro) ? roteiro : null;

  return (
    <div>
      <Cabecalho
        titulo="Visão geral"
        contexto={[recente && `competência ${recente.conciliacao.mes.toLowerCase()}`]}
      />

      {roteiroAtivo && (
        // dispensado com "Já sei usar", a conta nova volta a ver o começo de antes
        <RoteiroFaixa passos={passosDoRoteiro(roteiroAtivo)} alternativa={recente === null ? <PrimeirosPassos /> : null} />
      )}

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : recente === null ? (
        !roteiroAtivo && <PrimeirosPassos />
      ) : (
        <Conteudo
          visao={resposta.dados}
          execucao={recente.execucao}
          conciliacao={recente.conciliacao}
          conexoes={conexoes.ok ? conexoes.dados : null}
        />
      )}
    </div>
  );
}

function Conteudo({
  visao,
  execucao,
  conciliacao,
  conexoes,
}: {
  visao: VisaoGeral;
  execucao: Execucao;
  conciliacao: Conciliacao;
  /** Null esconde o bloco: analista, ou a conexão desligada no backend. */
  conexoes: { itens: ConexaoMcp[]; endereco: string | null } | null;
}) {
  // o mês em foco inteiro; sem ele (alguma conciliação não carregou), só a mais recente
  const doMes = visao.mes?.conciliacoes ?? [conciliacao];
  const resumo = resumir(doMes);
  const aguardando = doMes.reduce((soma, item) => soma + (item.aguardandoAprovacao ?? 0), 0);

  const menores = [
    // undefined é o backend sem saldo (antes da #118): a tela não fala de saldo
    conciliacao.saldo !== undefined && (
      <BlocoDoSaldo key="saldo" saldo={conciliacao.saldo} arquivo={execucao.arquivoBanco} />
    ),
    aguardando > 0 && <BlocoDeAprovacao key="aprovacao" quantidade={aguardando} />,
  ].filter(Boolean);
  // a coluna ao lado do mês é a conexão; sem ela, os dois blocos menores sobem para lá (um só
  // deixaria a coluna quase vazia, então fica na fileira de baixo)
  const sobem = !conexoes && menores.length === 2;
  const lado = conexoes ? <CartaoDeConexao itens={conexoes.itens} endereco={conexoes.endereco} /> : sobem ? menores : null;
  const temLado = lado !== null;

  return (
    <div className="vg-corpo">
      <Reveal className={temLado ? "vg-blocos-topo" : undefined}>
        <EstadoDoMes execucao={execucao} resumo={resumo} mes={conciliacao.mes} />
        {temLado && <div className="vg-blocos-lado">{lado}</div>}
      </Reveal>

      <Reveal delay={0.08} className="vg-blocos-meio">
        {!sobem && menores}
        <PedeAtencao conciliacoes={doMes} arquivos={visao.arquivosComLinhasNaoLidas} />
      </Reveal>

      <Reveal delay={0.16} className="vg-blocos-par">
        <section className="vg-bloco vg-tendencia" aria-label="Tendência da taxa de match">
          {/* só a rodada que vale: a refeita e a anterior pareceriam uma queda que não houve */}
          <GraficoDeMatch execucoes={execucoesVigentes(visao.execucoes)} />
        </section>
        <Atalhos
          visao={visao}
          execucao={execucao}
          conciliacao={conciliacao}
          divergentes={resumo.divergentes}
          mesFechado={visao.mes?.fechado ?? false}
        />
      </Reveal>

      <Reveal delay={0.24}>
        <AtividadeRecente execucoes={visao.execucoes} total={visao.total} />
      </Reveal>
    </div>
  );
}

function EstadoDoMes({
  execucao,
  resumo,
  mes,
}: {
  execucao: Execucao;
  resumo: ReturnType<typeof resumir>;
  mes: string;
}) {
  return (
    <section className="vg-bloco vg-estado" aria-labelledby="vg-estado-titulo" data-tutorial="estado-do-mes">
      <div
        className="vg-anel"
        role="progressbar"
        aria-label="Lançamentos conciliados"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(resumo.taxaMatch)}
        aria-valuetext={`${formatarPercentual(resumo.taxaMatch)} conciliado`}
        style={{ "--feito": `${resumo.taxaMatch}%` } as React.CSSProperties}
      >
        <span className="vg-anel-centro" aria-hidden="true">
          {/* para baixo: 99,6% não vira "100%" com lançamento em aberto */}
          <span className="vg-anel-numero">{`${Math.floor(resumo.taxaMatch)}%`}</span>
          conciliado
        </span>
      </div>
      <div className="vg-estado-corpo">
        <span className="vg-bloco-rotulo">{mes.replace("/", " de ")}</span>
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

function BlocoDoSaldo({ saldo, arquivo }: { saldo: SaldoDoExtrato | null; arquivo: string }) {
  return (
    <section className="vg-bloco" aria-labelledby="vg-saldo-titulo">
      <h2 id="vg-saldo-titulo" className="vg-bloco-rotulo">
        Saldo do banco
      </h2>
      {saldo === null ? (
        <p className="vg-nota" style={{ margin: 0 }}>
          {SEM_SALDO}
        </p>
      ) : (
        <>
          <span className="vg-bloco-numero">{formatarMoeda(saldo.final)}</span>
          {/* o do extrato mais recente: com duas contas no mês, cada uma tem o seu */}
          <span className="vg-nota">{`Em ${data(saldo.data)} · ${arquivo}`}</span>
        </>
      )}
    </section>
  );
}

/** Só chega alguma com `APROVACAO_JUSTIFICATIVAS_HABILITADA` ligado no backend; aprovar fica em Fechamentos. */
function BlocoDeAprovacao({ quantidade }: { quantidade: number }) {
  return (
    <Link href="/fechamentos" className="vg-bloco vg-bloco-link">
      <span className="vg-bloco-rotulo">Aguardam aprovação</span>
      <span className="vg-bloco-numero" data-tom="atencao">
        {formatarInteiro(quantidade)}
      </span>
      <span className="vg-nota">
        {`${plural(quantidade, "justificativa", "justificativas")} · Aprovar em Fechamentos`}
      </span>
    </Link>
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
  mesFechado,
}: {
  visao: VisaoGeral;
  execucao: Execucao;
  conciliacao: Conciliacao;
  /** As do mês em foco inteiro, não só da última conciliação. */
  divergentes: number;
  mesFechado: boolean;
}) {
  const arquivos = extratosDasExecucoes(visao.execucoes);
  const doBanco = arquivos.filter((arquivo) => arquivo.origem === "banco").length;
  // uma versão nova do extrato do sistema é outra rodada da mesma conciliação
  const pares = execucoesVigentes(visao.execucoes).length;
  const naoLidas = visao.arquivosComLinhasNaoLidas.reduce((soma, arquivo) => soma + arquivo.linhas, 0);
  const pronto = divergentes === 0 && naoLidas === 0;

  return (
    <nav className="vg-bloco" aria-labelledby="vg-atalhos-titulo" data-tutorial="atalhos">
      <h2 id="vg-atalhos-titulo" className="vg-bloco-rotulo">
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
          {/* o mês em foco inteiro, como Fechamentos o fecharia */}
          <span className="vg-atalho-aviso">
            <span className={`vg-ponto vg-ponto-${mesFechado || pronto ? "ok" : "atencao"}`} aria-hidden="true" />
            {mesFechado
              ? "Mês fechado"
              : pronto
                ? "Pronto para fechar"
                : divergentes > 0
                  ? `${plural(divergentes, "pendência", "pendências")} no mês`
                  : "Linhas não lidas na última conciliação"}
          </span>
        </Atalho>

        <Atalho
          href="/historico"
          icone={History}
          nome="Histórico"
          numero={plural(visao.total, "execução", "execuções")}
        >
          {execucao.lancamentos > 0 && (
            <span className="vg-atalho-detalhe">{`Match de ${matchNaTela(execucao)} na última`}</span>
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
  conciliacoes,
  arquivos,
}: {
  /** As conciliações do mês em foco. */
  conciliacoes: Conciliacao[];
  arquivos: VisaoGeral["arquivosComLinhasNaoLidas"];
}) {
  const grupos = pendenciasDoMes(conciliacoes);

  return (
    <section className="vg-bloco vg-atencao">
      <h2 id="vg-atencao-titulo" className="vg-bloco-rotulo">
        Pede sua atenção
      </h2>
      {grupos.length === 0 && arquivos.length === 0 ? (
        <div className="vg-tudo-certo">
          <Image
            src="/mascotes/mascote-joinha.png"
            alt=""
            width={1073}
            height={1173}
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

/**
 * As conciliações mais recentes, uma linha por extrato do banco com a rodada que vale, como no
 * histórico: a rodada anterior e a refeita não aparecem soltas, e o "Ver" abre a que vale.
 */
function AtividadeRecente({ execucoes, total }: { execucoes: Execucao[]; total: number }) {
  const conciliacoes = porConciliacao(execucoes);
  const recentes = conciliacoes.slice(0, NA_ATIVIDADE);

  return (
    <section className="vg-bloco">
      <div className="vg-secao-topo">
        <h2 id="vg-atividade-titulo" className="vg-bloco-rotulo">
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
            {recentes.map(({ extratoBancoId, arquivoBanco, rodadas, principal: { execucao, rodada } }) => (
              <tr key={extratoBancoId}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatarDataHora(execucao.executadaEm)}
                </td>
                <td style={{ overflowWrap: "anywhere" }}>
                  {`${arquivoBanco} × ${execucao.arquivoSistema}`}
                  {rodadas > 1 && <span className="vg-rodada">{` · rodada ${rodada}`}</span>}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatarInteiro(execucao.lancamentos)}
                </td>
                <td className="dash-valor-celula">{matchNaTela(execucao)}</td>
                <td style={{ textAlign: "right" }}>
                  <Link href={caminhoDaConciliacao(extratoBancoId)} className="btn btn-secondary" style={{ whiteSpace: "nowrap" }}>
                    Ver{" "}<span className="sr-only">{arquivoBanco}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(conciliacoes.length > recentes.length || total > execucoes.length) && (
        <p className="vg-nota" style={{ margin: "12px 0 0" }}>
          {`As ${formatarInteiro(recentes.length)} conciliações mais recentes. As outras estão no histórico.`}
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
    texto: "O CSV exportado do seu ERP funciona: Cigam, Bling, Tiny ou outro.",
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
      <InkHover style={{ flex: "none" }}>
        <Image
          src="/mascotes/mascote-apresenta.png"
          alt="Mascote Ledgr com a prancheta da conciliação"
          width={824}
          height={720}
          sizes="200px"
          style={{ width: 200, height: "auto", display: "block" }}
        />
      </InkHover>
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
