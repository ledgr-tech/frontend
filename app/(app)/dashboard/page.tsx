"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  EMPRESA_MOCK,
  formatarMoeda,
  listarConciliacoes,
  type Conciliacao,
} from "@/lib/mock-data";
import {
  formatarInteiro,
  formatarMoedaCurta,
  formatarPercentual,
  origemDaLinha,
  resumir,
  statusDaLinha,
  valorDaLinha,
} from "./resumo";

// Copy do design ("sugestoes" em Ledgr.dc.html). São leituras de padrão entre
// competências — o mock tem uma competência só, então o texto é fixo até existir
// histórico de verdade para ler.
// ponytail: só a primeira tem CTA. "Criar regra" e "Ver histórico" apontariam
// para /regras e /historico, que ainda não existem; botão que não leva a lugar
// nenhum é pior que botão ausente.
const SUGESTOES = [
  {
    num: "I",
    titulo: "Aço Norte Bobinas aparece em três meses seguidos com juros não lançados",
    texto:
      "Sempre a mesma diferença de dois dias de atraso. Vale criar uma regra de despesa financeira para esse fornecedor.",
    cta: "Ver o caso",
  },
  {
    num: "II",
    titulo: "Vinte e dois estornos de maquininha não existem no extrato do banco",
    texto:
      "O sistema lança o estorno na hora, o banco só no dia seguinte. Uma janela de data de dois dias resolveria cinco deles.",
    cta: null,
  },
  {
    num: "III",
    titulo: "Setembro repetiu o padrão de agosto: 157 divergências, 19 no sistema",
    texto:
      "A taxa de match subiu para 96,3%, mas o gargalo continua sendo lançamento manual no ERP.",
    cta: null,
  },
];

export default function DashboardPage() {
  const [conciliacoes, setConciliacoes] = useState<Conciliacao[] | null>(null);

  useEffect(() => {
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConciliacoes(listarConciliacoes());
  }, []);

  if (conciliacoes === null) {
    return null;
  }

  const resumo = resumir(conciliacoes);
  const maisRecente = conciliacoes[0] ?? null;
  // A tabela do design mostra os sete primeiros lançamentos da competência.
  const lancamentos = conciliacoes.flatMap((conciliacao) => conciliacao.linhas).slice(0, 7);

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>{EMPRESA_MOCK}</h1>
          <span
            style={{
              fontSize: 14,
              fontVariantNumeric: "tabular-nums",
              color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
            }}
          >
            Competência setembro/2026
          </span>
        </div>
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Novo extrato
        </Link>
      </div>

      {maisRecente === null ? (
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
          <Image
            src="/mascotes/mascote-sentado.png"
            alt="Mascote Ledgr sentado com uma folha"
            width={1000}
            height={1000}
            sizes="250px"
            style={{ width: 250, height: "auto" }}
          />
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
        <div style={{ padding: "32px 0 56px", display: "flex", flexDirection: "column", gap: 36 }}>
          <div className="grade-colunas dash-resumo">
            <div>
              <span className="dash-rotulo">Lançamentos processados</span>
              <span className="dash-valor">{formatarInteiro(resumo.processados)}</span>
              <span className="dash-nota">Período 01–30 de setembro</span>
            </div>
            <div>
              <span className="dash-rotulo">Match automático</span>
              <span className="dash-valor">{formatarPercentual(resumo.taxaMatch)}</span>
              <span className="dash-nota">
                {formatarInteiro(resumo.batidos)} casados sem intervenção
              </span>
            </div>
            <div>
              <span className="dash-rotulo">Valor em divergência</span>
              <span className="dash-valor" style={{ color: "var(--color-accent)" }}>
                {formatarMoedaCurta(resumo.valorDivergente)}
              </span>
              <span className="dash-nota">
                Distribuído em {formatarInteiro(resumo.divergentes)}{" "}
                {resumo.divergentes === 1 ? "lançamento" : "lançamentos"}
              </span>
            </div>
          </div>

          <div className="dash-analise">
            <div className="dash-sugestoes">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 14,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>O que o Ledgr sugere</h3>
                <span
                  className="dash-sugestoes-contagem"
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                  }}
                >
                  {SUGESTOES.length} observações
                </span>
              </div>
              <div style={{ borderTop: "1px solid var(--color-divider)" }}>
                {SUGESTOES.map((sugestao) => (
                  <div key={sugestao.num} className="dash-sugestao">
                    <span className="dash-sugestao-num">{sugestao.num}</span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      <span className="dash-sugestao-titulo">{sugestao.titulo}</span>
                      <span className="dash-sugestao-texto">{sugestao.texto}</span>
                    </span>
                    {sugestao.cta === null ? null : (
                      <Link
                        href={`/conciliacoes/${maisRecente.id}`}
                        className="btn btn-ghost"
                        style={{ flex: "none", fontSize: 13.5 }}
                      >
                        {sugestao.cta}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {resumo.semCorrespondente === 0 ? null : (
              <div className="dash-destaque">
                <Image
                  src="/mascotes/mascote-explicando.png"
                  alt="Mascote Ledgr apontando"
                  width={1000}
                  height={1000}
                  sizes="116px"
                  style={{ width: 116, height: "auto" }}
                />
                <span className="dash-destaque-titulo">
                  Comece pelas {formatarInteiro(resumo.semCorrespondente)} sem correspondente
                </span>
                <span className="dash-destaque-texto">
                  São elas que respondem por {formatarMoedaCurta(resumo.valorSemCorrespondente)} dos{" "}
                  {formatarMoedaCurta(resumo.valorDivergente)} em divergência.
                </span>
                <Link
                  href={`/conciliacoes/${maisRecente.id}`}
                  className="btn btn-primary"
                  style={{ marginTop: 2 }}
                >
                  Revisar agora
                </Link>
              </div>
            )}
          </div>

          <div>
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
                href={`/conciliacoes/${maisRecente.id}`}
                className="btn btn-secondary"
                style={{ fontSize: 13.5 }}
              >
                Ver a conciliação
              </Link>
            </div>
            <div className="dash-tabela-rolagem">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Data</th>
                    <th>Descrição</th>
                    <th style={{ width: 140, textAlign: "right" }}>Valor</th>
                    <th style={{ width: 250 }}>Status</th>
                    <th style={{ width: 110, textAlign: "right" }}>Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((linha) => {
                    const status = statusDaLinha(linha.status);
                    return (
                      <tr key={linha.id}>
                        <td className="dash-celula-fraca">{linha.data}/2026</td>
                        <td>{linha.descricao}</td>
                        <td className="dash-valor-celula">{formatarMoeda(valorDaLinha(linha))}</td>
                        <td>
                          <span className={`selo selo-${status.nivel}`}>{status.rotulo}</span>
                        </td>
                        <td className="dash-celula-fraca" style={{ textAlign: "right", fontSize: 14 }}>
                          {origemDaLinha(linha)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ponytail: o design pensa numa competência só. Enquanto o mock cria uma
              conciliação por upload, as anteriores precisam continuar alcançáveis. */}
          {conciliacoes.length > 1 && (
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>
                Conciliações anteriores
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Status</th>
                    <th style={{ width: 110 }}>Lançamentos</th>
                    <th style={{ width: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {conciliacoes.slice(1).map((conciliacao) => (
                    <tr key={conciliacao.id}>
                      <td>{conciliacao.mes}</td>
                      <td>
                        <span
                          className={
                            conciliacao.status === "fechada" ? "tag tag-accent" : "tag tag-outline"
                          }
                        >
                          {conciliacao.status === "fechada" ? "Fechada" : "Em andamento"}
                        </span>
                      </td>
                      <td>{conciliacao.linhas.length}</td>
                      <td>
                        <Link href={`/conciliacoes/${conciliacao.id}`} className="btn btn-secondary">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
