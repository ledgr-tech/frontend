import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Execucao } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { EMPRESA_MOCK, type Conciliacao } from "@/lib/mock-data";
import { carregarVisaoGeral, type VisaoGeral } from "../conciliacoes/acoes";
import {
  formatarDataHora,
  formatarInteiro,
  formatarMoedaCurta,
  resumir,
  type Resumo,
} from "../dashboard/resumo";
import { pendencias } from "../visao-geral/pendencias";
import { competencia, primeiraConciliacao, type Competencia } from "./fechamento";

/**
 * O fechamento do mês (FECHAMENTO em Ledgr.dc.html), só com o que o backend sabe.
 * O mês é o da conciliação mais recente, como na visão geral, e está conciliado
 * quando nenhuma linha pede decisão e os dois arquivos foram lidos inteiros;
 * antes disso, a tela diz o que ainda segura o fechamento e leva até lá.
 *
 * Saíram do design, por não terem fonte: o "encerrado em", o parágrafo das
 * decisões (19 corrigidos, 6 aceitos, 2 duplicidades), o ajuste líquido, o tempo
 * total, dois dos três marcos e o "Entregar o fechamento" inteiro.
 *
 * ponytail: fechar o mês de verdade espera um endpoint de fechamento no backend,
 * que não existe. É ele que traz de volta o "encerrado em", o relatório em PDF,
 * a planilha de ajustes e o envio ao contador. Até lá esta tela só lê: nenhum
 * botão aqui finge que fechou ou que entregou.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar o fechamento. Recarregue a página e tente de novo.";

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

/** "setembro" → "Setembro", para abrir a frase; sem competência, "O mês". */
function sujeito(mes: Competencia | null): string {
  return mes ? mes.mes.charAt(0).toUpperCase() + mes.mes.slice(1) : "O mês";
}

export default async function FechamentosPage() {
  const resposta = await carregarVisaoGeral();
  if (!resposta.ok && resposta.status === 401) redirect("/login");

  const recente = resposta.ok ? resposta.dados.recente : null;
  const mes = recente ? competencia(recente.conciliacao.mes) : null;

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>
            {mes ? `Fechamento de ${mes.mes}` : "Fechamentos"}
          </h1>
          {recente && (
            <span className="vg-subtitulo">
              {mes
                ? `${EMPRESA_MOCK} · competência ${recente.conciliacao.mes.toLowerCase()}`
                : EMPRESA_MOCK}
            </span>
          )}
        </div>
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : recente === null ? (
        <SemConciliacao />
      ) : (
        <Fechamento
          visao={resposta.dados}
          execucao={recente.execucao}
          conciliacao={recente.conciliacao}
          mes={mes}
        />
      )}
    </div>
  );
}

function Fechamento({
  visao,
  execucao,
  conciliacao,
  mes,
}: {
  visao: VisaoGeral;
  execucao: Execucao;
  conciliacao: Conciliacao;
  mes: Competencia | null;
}) {
  const resumo = resumir([conciliacao]);
  // linha que o parser não leu nem entrou na conciliação: com ela, "nada
  // pendente" seria verdade só sobre a parte que foi lida
  const conciliado = resumo.divergentes === 0 && visao.arquivosComLinhasNaoLidas.length === 0;
  const caminho = caminhoDaConciliacao(execucao.extratoBancoId, execucao.extratoSistemaId);
  const lida = `Última conciliação em ${formatarDataHora(execucao.executadaEm)} · ${execucao.arquivoBanco} × ${execucao.arquivoSistema}`;

  return (
    <div className="fech-corpo">
      {conciliado ? (
        <section className="fech-destaque" aria-labelledby="fech-titulo">
          <Image
            src="/mascotes/mascote-comemorando.png"
            alt="Mascote Ledgr comemorando"
            width={1000}
            height={1000}
            sizes="190px"
            className="fech-mascote"
          />
          <div className="fech-destaque-corpo">
            <p className="fech-kicker">Mês conciliado</p>
            <h2 id="fech-titulo" className="fech-titulo">
              {`${sujeito(mes)} fechou sem divergência pendente.`}
            </h2>
            <span className="fech-filete" aria-hidden="true" />
            <p className="fech-texto">
              Nada em revisão nesta competência — todos os lançamentos bateram.
            </p>
            <div className="vg-estado-rodape">
              <span className="vg-nota">{lida}</span>
              <Link href={caminho} className="btn btn-secondary">
                Ver a conciliação
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="fech-destaque" aria-labelledby="fech-titulo">
          <Image
            src="/mascotes/mascote-lendo.png"
            alt="Mascote Ledgr lendo"
            width={900}
            height={808}
            sizes="190px"
            className="fech-mascote"
          />
          <div className="fech-destaque-corpo">
            {/* a frase é a do aviso do design ("157 divergências aguardando
                decisão"), que é o que existe para o mês que ainda não fechou */}
            <h2 id="fech-titulo" className="fech-titulo" data-estado="aberto">
              {`${sujeito(mes)} não pode ser fechado enquanto houver item pendente.`}
            </h2>
            <span className="fech-filete" data-estado="aberto" aria-hidden="true" />
            <ul className="vg-lista">
              {resumo.divergentes > 0 && (
                <li>
                  <Link href={caminho} className="vg-item">
                    {/* o tom do grupo mais grave, na mesma régua da visão geral */}
                    <span
                      className={`vg-ponto vg-ponto-${pendencias(conciliacao)[0].tom}`}
                      aria-hidden="true"
                    />
                    <span className="vg-item-corpo">
                      <span className="vg-item-titulo">
                        {`${plural(resumo.divergentes, "divergência", "divergências")} aguardando decisão`}
                      </span>
                      {/* data trocada com o mesmo valor não deixa dinheiro em aberto: "R$ 0" confundiria */}
                      {resumo.valorDivergente > 0 && (
                        <span className="vg-item-detalhe">
                          {`${formatarMoedaCurta(resumo.valorDivergente)} em aberto`}
                        </span>
                      )}
                    </span>
                    <span className="vg-item-acao">Revisar</span>
                  </Link>
                </li>
              )}
              {visao.arquivosComLinhasNaoLidas.map((arquivo) => (
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
            <p className="vg-nota" style={{ margin: "14px 0 0" }}>
              {lida}
            </p>
          </div>
        </section>
      )}

      <ResumoDoMes resumo={resumo} />

      <Marcos execucoes={visao.execucoes} total={visao.total} />

      {/* começar o mês seguinte é só subir os extratos: navega, não grava nada */}
      {conciliado && (
        <div className="fech-comecar">
          <Link
            href="/conciliacoes/nova"
            className="btn btn-primary"
            style={{ fontSize: 15, padding: "12px 22px" }}
          >
            {mes ? `Começar ${mes.proximo}` : "Começar o próximo mês"}
          </Link>
          {mes && (
            <span className="fech-comecar-nota">
              {`O extrato de ${mes.proximo} pode ser subido a partir do dia 1º.`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Os rótulos do design que têm fonte (Lançamentos, Resolvidos) e, no lugar do
// ajuste líquido e do tempo total, o valor que ainda está em aberto.
function ResumoDoMes({ resumo }: { resumo: Resumo }) {
  return (
    <dl className="grade-colunas dash-resumo fech-resumo">
      <div>
        <dt className="dash-rotulo">Lançamentos</dt>
        <dd className="dash-valor">{formatarInteiro(resumo.processados)}</dd>
      </div>
      <div>
        <dt className="dash-rotulo">Resolvidos</dt>
        <dd className="dash-valor">{formatarInteiro(resumo.batidos)}</dd>
      </div>
      <div>
        <dt className="dash-rotulo">Em aberto</dt>
        <dd className="dash-valor">{formatarMoedaCurta(resumo.valorDivergente)}</dd>
      </div>
    </dl>
  );
}

/**
 * Dos marcos do design, só a primeira conciliação sai das execuções. "Três meses
 * sem ressalva" pede meses fechados e "Cem divergências resolvidas" pede decisões
 * registradas; o backend não guarda nenhum dos dois. Pelo mesmo motivo sai o
 * "Três de cinco selos": não há os cinco.
 */
function Marcos({ execucoes, total }: { execucoes: Execucao[]; total: number }) {
  const primeira = primeiraConciliacao(execucoes, total);

  return (
    <section>
      <h2 id="fech-marcos-titulo" className="vg-secao-titulo">
        Marcos conquistados
      </h2>
      <ul className="fech-marcos" aria-labelledby="fech-marcos-titulo">
        <li className="fech-marco">
          <Image
            src="/mascotes/medalha-comemorando.png"
            alt=""
            width={1000}
            height={987}
            sizes="118px"
            style={{ width: 118, height: "auto" }}
          />
          <span className="fech-marco-titulo">Primeira conciliação</span>
          {primeira && (
            <span className="fech-marco-texto">
              {`${primeira.quando} · ${plural(primeira.lancamentos, "lançamento", "lançamentos")}.`}
            </span>
          )}
          <span className="selo selo-ok">Conquistado</span>
        </li>
      </ul>
    </section>
  );
}

function SemConciliacao() {
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
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Nenhuma conciliação ainda.</h2>
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
