"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  aceitarValorDoBanco,
  buscarConciliacao,
  formatarMoeda,
  restaurarLinha,
  type Conciliacao,
  type LinhaComparacao,
} from "@/lib/mock-data";
import { statusDaLinha } from "../../../dashboard/resumo";
import { Barra, EsqueletoTela } from "../../../esqueleto";
import { NumeroAnimado } from "../../../numero-animado";

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
        {valor === null ? "—" : <NumeroAnimado valor={valor} formatar={formatarMoeda} />}
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
  const [carregado, setCarregado] = useState<Carregado>(null);
  // retrato da linha antes da decisão; existir significa "dá para desfazer"
  const [desfazivel, setDesfazivel] = useState<LinhaComparacao | null>(null);

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
    return (
      <EsqueletoTela>
        <div className="det-comparacao">
          {[0, 1].map((i) => (
            <div key={i} className="det-cartao" style={{ gap: 16 }}>
              <Barra largura={150} altura={17} />
              <Barra largura={190} altura={36} />
              <Barra />
              <Barra largura="64%" />
            </div>
          ))}
        </div>
      </EsqueletoTela>
    );
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

  // A decisão acontece aqui mesmo, sem navegar: assim a consequência fica visível
  // e o desfazer não precisa sobreviver a uma troca de tela.
  function aceitar() {
    const antes = linha;
    const atualizada = aceitarValorDoBanco(conciliacao.id, linha.id);
    const depois = atualizada?.linhas.find((item) => item.id === linha.id);
    if (!atualizada || !depois) return;
    setCarregado({ conciliacao: atualizada, linha: depois });
    setDesfazivel(antes);
  }

  function desfazer() {
    if (!desfazivel) return;
    const atualizada = restaurarLinha(conciliacao.id, desfazivel);
    const depois = atualizada?.linhas.find((item) => item.id === desfazivel.id);
    if (atualizada && depois) setCarregado({ conciliacao: atualizada, linha: depois });
    setDesfazivel(null);
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
            {linha.status === "batido" ? "Voltar para a conciliação" : "Ignorar por ora"}
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
          /* aberto por padrão: é a leitura que muda o que você faz a seguir */
          <details className="det-cronico recolhivel" open>
            <summary className="recolhivel-titulo">
              <span>
                <span
                  className="det-kicker"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Crônico, não pontual
                </span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 21, fontWeight: 600, lineHeight: 1.26 }}>
                  O mesmo fornecedor divergiu nos {linha.cronico.length} últimos meses.
                </span>
              </span>
            </summary>
            {/* o CTA fica no corpo, não no summary: botão dentro de summary vira
                dois alvos disputando o mesmo clique */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
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
          </details>
        )}

        {/* fechado por padrão: procedência é consulta, não leitura de rotina */}
        <details className="recolhivel">
          <summary className="recolhivel-titulo">
            <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-heading)" }}>
              Histórico do lançamento
            </span>
          </summary>
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
        </details>

        {desfazivel && (
          <div className="desfazer" role="status">
            <span className="desfazer-texto">
              Valor do banco aceito. <strong>{linha.descricao}</strong> agora está conciliado em{" "}
              {formatarMoeda(linha.valorBanco ?? 0)}.
            </span>
            <button type="button" className="btn btn-primary" onClick={desfazer}>
              Desfazer
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDesfazivel(null)}
              style={{ fontSize: 13.5 }}
            >
              Pronto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
