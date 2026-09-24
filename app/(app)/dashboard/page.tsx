"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMPRESA_MOCK, formatarMoeda } from "@/lib/mock-data";
import { carregarPainel, type Painel } from "../conciliacoes/acoes";
import {
  formatarDataHora,
  formatarInteiro,
  estaResolvida,
  formatarMoedaCurta,
  formatarPercentual,
  origemDaLinha,
  periodoDasLinhas,
  resumir,
  statusDaLinha,
  valorDaLinha,
} from "./resumo";
// ponytail: primitivas de UI compartilhadas que hoje moram em (marketing) por
// terem nascido na landing. Se uma terceira tela usar, aí vale mudar de lugar.
import { InkHover, MotionRoot, Reveal, SpotlightHover } from "@/app/(marketing)/reveal";
import { Barra, EsqueletoTabela, EsqueletoTela } from "../esqueleto";

// ponytail: "O que o Ledgr sugere" (as três leituras de padrão do design) saiu
// enquanto não há de onde tirá-las — eram frases fixas, com números inventados,
// ao lado de dados reais que podiam contradizê-las. Voltam quando o backend
// tiver o que comparar entre execuções.

const FALHA_AO_CARREGAR =
  "Não foi possível carregar suas conciliações. Recarregue a página e tente de novo.";

type Estado =
  | { situacao: "carregando" }
  | { situacao: "falhou" }
  | { situacao: "pronto"; painel: Painel };

/** "2026-09-04" → "04/09/2026"; o mock só tem "04/09". */
function dataCompleta(dataISO: string | undefined, data: string): string {
  return dataISO ? dataISO.split("-").reverse().join("/") : data;
}

export default function DashboardPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });

  // O router fica numa ref, fora das dependências: se ele trocar de identidade
  // entre renders, o efeito recarregaria o painel a cada render. O único uso é
  // redirecionar num 401 (mesmo arranjo de `useConciliacao`).
  const irPara = useRef(router);
  useEffect(() => {
    irPara.current = router;
  });

  useEffect(() => {
    let cancelado = false;
    carregarPainel().then(
      (resposta) => {
        if (cancelado) return;
        if (!resposta.ok) {
          if (resposta.status === 401) irPara.current.push("/login");
          setEstado({ situacao: "falhou" });
          return;
        }
        setEstado({ situacao: "pronto", painel: resposta.dados });
      },
      // a action lançou em vez de devolver Resultado (rede, deploy novo no meio)
      () => {
        if (!cancelado) setEstado({ situacao: "falhou" });
      },
    );
    return () => {
      cancelado = true;
    };
  }, []);

  if (estado.situacao === "carregando") {
    return (
      <EsqueletoTela>
        <div className="grade-colunas dash-resumo esq-resumo">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Barra largura={140} altura={11} />
              <Barra largura={96} altura={38} />
              <Barra largura={170} altura={12} />
            </div>
          ))}
        </div>
        <EsqueletoTabela />
      </EsqueletoTela>
    );
  }

  const recente = estado.situacao === "pronto" ? estado.painel.recente : null;
  const anteriores = estado.situacao === "pronto" ? estado.painel.anteriores : [];

  return (
    <MotionRoot>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>{EMPRESA_MOCK}</h1>
          {recente && (
            <span
              style={{
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
                color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
              }}
            >
              Competência {recente.mes.toLowerCase()}
            </span>
          )}
        </div>
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Novo extrato
        </Link>
      </div>

      {estado.situacao === "falhou" ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : recente === null ? (
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
              src="/mascotes/mascote-sentado.png"
              alt="Mascote Ledgr sentado com uma folha"
              width={1000}
              height={1000}
              sizes="250px"
              style={{ width: 250, height: "auto", display: "block" }}
            />
          </InkHover>
          <h2
            style={{ margin: 0, fontSize: 32, fontWeight: 400, maxWidth: "24ch", textWrap: "balance" }}
          >
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
            Suba o extrato do banco e o extrato do sistema de gestão. A primeira conciliação fica
            pronta em poucos minutos.
          </p>
          <Link
            href="/conciliacoes/nova"
            className="btn btn-primary"
            style={{ fontSize: 15, padding: "12px 22px" }}
          >
            Fazer o primeiro upload
          </Link>
        </div>
      ) : (
        <Conteudo recente={recente} anteriores={anteriores} />
      )}
    </MotionRoot>
  );
}

function Conteudo({
  recente,
  anteriores,
}: {
  recente: NonNullable<Painel["recente"]>;
  anteriores: Painel["anteriores"];
}) {
  const resumo = resumir([recente]);
  const periodo = periodoDasLinhas(recente.linhas);
  // A tabela do design mostra os sete primeiros lançamentos da competência.
  const lancamentos = recente.linhas.slice(0, 7);
  // "Revisar agora" abre a primeira divergência em aberto; sem nenhuma, vai para a lista.
  const primeiraEmAberto = recente.linhas.find((linha) => !estaResolvida(linha.status)) ?? null;
  const hrefPrimeiroCaso = primeiraEmAberto
    ? `/conciliacoes/${recente.id}/${primeiraEmAberto.id}`
    : `/conciliacoes/${recente.id}`;

  return (
    <div style={{ padding: "32px 0 56px", display: "flex", flexDirection: "column", gap: 36 }}>
      {/* ponytail: o resumo não entra no reveal. É o dado principal da tela e
          fica acima da dobra — se o observer ou o rAF não rodarem, os números
          não podem ficar invisíveis. O que está abaixo da dobra pode animar. */}
      <div className="grade-colunas dash-resumo">
        <div>
          <span className="dash-rotulo">Lançamentos processados</span>
          <span className="dash-valor">{formatarInteiro(resumo.processados)}</span>
          {periodo && <span className="dash-nota">Período {periodo}</span>}
        </div>
        <div>
          <span className="dash-rotulo">Match automático</span>
          <span className="dash-valor" style={{ color: "var(--color-ok)" }}>
            {formatarPercentual(resumo.taxaMatch)}
          </span>
          <span className="dash-nota">{formatarInteiro(resumo.batidos)} casados sem intervenção</span>
        </div>
        <div>
          <span className="dash-rotulo">Valor em divergência</span>
          <span className="dash-valor" style={{ color: "var(--color-risco)" }}>
            {formatarMoedaCurta(resumo.valorDivergente)}
          </span>
          <span className="dash-nota">
            Distribuído em {formatarInteiro(resumo.divergentes)}{" "}
            {resumo.divergentes === 1 ? "lançamento" : "lançamentos"}
          </span>
        </div>
      </div>

      {resumo.semCorrespondente > 0 && (
        <Reveal once className="dash-analise">
          <SpotlightHover className="dash-destaque dash-destaque-faixa">
            <Image
              src="/mascotes/mascote-explicando.png"
              alt="Mascote Ledgr apontando"
              width={1000}
              height={1000}
              sizes="88px"
              style={{ width: 88, height: "auto", flex: "none" }}
            />
            <span className="dash-destaque-corpo">
              <span className="dash-destaque-titulo">
                Comece pelas {formatarInteiro(resumo.semCorrespondente)} sem correspondente
              </span>
              <span className="dash-destaque-texto">
                São elas que respondem por {formatarMoedaCurta(resumo.valorSemCorrespondente)} dos{" "}
                {formatarMoedaCurta(resumo.valorDivergente)} em divergência.
              </span>
            </span>
            <Link href={hrefPrimeiroCaso} className="btn btn-primary">
              Revisar agora
            </Link>
          </SpotlightHover>
        </Reveal>
      )}

      <Reveal once delay={0.08}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Conciliações recentes</h3>
          <Link
            href={`/conciliacoes/${recente.id}`}
            className="btn btn-secondary"
            style={{ fontSize: 13.5 }}
          >
            Ver a conciliação
          </Link>
        </div>
        <div className="dash-tabela-rolagem tabela-cartoes">
          <table className="table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th style={{ width: 110 }}>Data</th>
                <th>Descrição</th>
                <th style={{ width: 140, textAlign: "right" }}>Valor</th>
                <th style={{ width: 250 }}>Status</th>
                <th style={{ width: 110, textAlign: "right" }}>Origem</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {lancamentos.map((linha) => {
                const status = statusDaLinha(linha);
                return (
                  <tr key={linha.id} role="row">
                    <td role="cell" data-rotulo="Data" className="dash-celula-fraca">
                      {dataCompleta(linha.dataISO, linha.data)}
                    </td>
                    <td role="cell" data-rotulo="Descrição" data-destaque="true">
                      {linha.descricao}
                    </td>
                    <td role="cell" data-rotulo="Valor" className="dash-valor-celula">
                      {formatarMoeda(valorDaLinha(linha))}
                    </td>
                    <td role="cell" data-rotulo="Status">
                      <span className={`selo selo-${status.tom}`}>{status.rotulo}</span>
                    </td>
                    <td
                      role="cell"
                      data-rotulo="Origem"
                      className="dash-celula-fraca"
                      style={{ textAlign: "right", fontSize: 14 }}
                    >
                      {origemDaLinha(linha)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* As outras execuções atuais (as refeitas depois ficam só no histórico). */}
      {anteriores.length > 0 && (
        <Reveal once delay={0.16}>
          <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>
            Conciliações anteriores
          </h3>
          <div className="dash-tabela-rolagem">
            <table className="table">
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
                {anteriores.map((execucao) => (
                  <tr key={execucao.id}>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatarDataHora(execucao.executadaEm)}
                    </td>
                    <td style={{ overflowWrap: "anywhere" }}>
                      {execucao.arquivoBanco} × {execucao.arquivoSistema}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatarInteiro(execucao.lancamentos)}
                    </td>
                    <td className="dash-valor-celula">
                      {execucao.acerto === null ? "—" : formatarPercentual(execucao.acerto)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/conciliacoes/${execucao.extratoBancoId}`}
                        className="btn btn-secondary"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}
    </div>
  );
}
