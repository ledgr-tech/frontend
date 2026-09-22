"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  aceitarValorDoBanco,
  buscarConciliacao,
  formatarMoeda,
  type Conciliacao,
  type LinhaComparacao,
} from "@/lib/mock-data";
import { statusDaLinha } from "../../../dashboard/resumo";

type Carregado = { conciliacao: Conciliacao; linha: LinhaComparacao } | "ausente" | null;

function CartaoExtrato({
  titulo,
  marca,
  marcaClasse,
  valor,
  campos,
  destacado,
}: {
  titulo: string;
  marca: string;
  marcaClasse: string;
  valor: number | null;
  campos: { rotulo: string; valor: string }[] | undefined;
  destacado: boolean;
}) {
  return (
    <div className={destacado ? "det-cartao det-cartao-verdade" : "det-cartao"}>
      <div
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}
      >
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 600 }}>
          {titulo}
        </span>
        <span className={marcaClasse}>{marca}</span>
      </div>
      <div className="det-valor" style={destacado ? undefined : { color: "var(--color-risco-700)" }}>
        {valor === null ? "—" : formatarMoeda(valor)}
      </div>
      {campos?.map((campo) => (
        <div key={campo.rotulo} className="det-campo">
          <span style={{ color: "color-mix(in srgb, var(--color-text) 58%, transparent)" }}>
            {campo.rotulo}
          </span>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 16,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
            }}
          >
            {campo.valor}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DetalheDivergenciaPage() {
  const params = useParams<{ id: string; linha: string }>();
  const router = useRouter();
  const [carregado, setCarregado] = useState<Carregado>(null);

  useEffect(() => {
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregado(() => {
      const conciliacao = buscarConciliacao(params.id);
      const linha = conciliacao?.linhas.find((item) => item.id === params.linha);
      return conciliacao && linha ? { conciliacao, linha } : "ausente";
    });
  }, [params.id, params.linha]);

  if (carregado === null) {
    return null;
  }

  if (carregado === "ausente") {
    return (
      <div style={{ padding: "76px 0", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 30, fontWeight: 600 }}>
          Lançamento não encontrado.
        </h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Voltar para a dashboard
        </Link>
      </div>
    );
  }

  const { conciliacao, linha } = carregado;
  const status = statusDaLinha(linha.status);
  const emAberto = conciliacao.linhas.filter((item) => item.status !== "batido");
  const posicao = emAberto.findIndex((item) => item.id === linha.id);
  const delta =
    linha.valorBanco !== null && linha.valorSistema !== null
      ? Math.abs(linha.valorBanco - linha.valorSistema)
      : null;

  function aceitar() {
    aceitarValorDoBanco(conciliacao.id, linha.id);
    router.push(`/conciliacoes/${conciliacao.id}`);
  }

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <div className="det-kicker">
            {status.rotulo}
            {posicao === -1
              ? null
              : ` · item ${String(posicao + 1).padStart(2, "0")} de ${emAberto.length}`}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600 }}>{linha.descricao}</h1>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href={`/conciliacoes/${conciliacao.id}`} className="btn btn-secondary">
            Ignorar por ora
          </Link>
          {/* ponytail: só faz sentido aceitar o banco quando ele tem a linha. */}
          {linha.valorBanco !== null && linha.status !== "batido" && (
            <button type="button" className="btn btn-primary" onClick={aceitar}>
              Aceitar valor do banco
            </button>
          )}
        </div>
      </div>

      <div className="det-corpo">
        <div className="det-comparacao">
          <CartaoExtrato
            titulo="Extrato do banco"
            marca="Fonte da verdade"
            marcaClasse="tag tag-accent"
            valor={linha.valorBanco}
            campos={linha.camposBanco}
            destacado
          />
          <div className="det-delta">
            <div className="det-delta-linha" />
            <div className="det-delta-valor">
              {/* o Δ do design vai sem símbolo de moeda; formatar o número direto evita
                  depender do espaço não-quebrável que o formato de moeda insere */}
              {delta === null
                ? "sem par"
                : `Δ ${delta.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="det-delta-linha" />
          </div>
          <CartaoExtrato
            titulo="Extrato do sistema"
            marca={linha.status === "batido" ? "Conciliado" : "Precisa de ajuste"}
            marcaClasse={linha.status === "batido" ? "selo selo-ok" : "selo selo-risco"}
            valor={linha.valorSistema}
            campos={linha.camposSistema}
            destacado={false}
          />
        </div>

        {linha.explicacao && (
          <div className="det-causa">
            <Image
              src="/mascotes/mascote-lendo.png"
              alt="Mascote Ledgr lendo"
              width={900}
              height={808}
              sizes="130px"
              style={{ flex: "none", width: 130, height: "auto" }}
            />
            <div style={{ flex: "1 1 340px", minWidth: 0 }}>
              <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>
                O que provavelmente aconteceu
              </h6>
              {linha.causa && <div className="det-causa-titulo">{linha.causa}</div>}
              <p className="det-causa-texto">{linha.explicacao}</p>
            </div>
          </div>
        )}

        {linha.cronico && linha.cronico.length > 0 && (
          <div className="det-cronico">
            <div className="det-cronico-topo">
              <div>
                <h6 style={{ margin: "0 0 6px", color: "var(--color-accent-700)" }}>
                  Crônico, não pontual
                </h6>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 21, fontWeight: 600, lineHeight: 1.26 }}>
                  O mesmo fornecedor divergiu nos {linha.cronico.length} últimos meses.
                </div>
              </div>
              <Link href="/regras" className="btn btn-primary" style={{ fontSize: 13.5 }}>
                Criar regra para este fornecedor
              </Link>
            </div>
            <div style={{ borderTop: "1px solid var(--color-divider)" }}>
              {linha.cronico.map((mes) => (
                <div key={mes.mes} className="det-cronico-linha">
                  <span className="det-cronico-mes">{mes.mes}</span>
                  <span className="det-cronico-num">{formatarMoeda(mes.valorBanco)}</span>
                  <span style={{ flex: "none", fontSize: 14, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                    contra
                  </span>
                  <span className="det-cronico-num" style={{ color: "var(--color-risco-700)" }}>
                    {formatarMoeda(mes.valorSistema)}
                  </span>
                  <span className="det-cronico-nota">
                    diferença de {formatarMoeda(Math.abs(mes.valorBanco - mes.valorSistema))} ·{" "}
                    {mes.nota}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>
            Histórico do lançamento
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Quando</th>
                <th>Evento</th>
                <th style={{ width: 150, textAlign: "right" }}>Origem</th>
              </tr>
            </thead>
            <tbody>
              {linha.historico.map((evento) => (
                <tr key={`${evento.quando}-${evento.evento}`}>
                  <td className="dash-celula-fraca">{evento.quando}</td>
                  <td>{evento.evento}</td>
                  <td className="dash-celula-fraca" style={{ textAlign: "right", fontSize: 14 }}>
                    {evento.origem ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
