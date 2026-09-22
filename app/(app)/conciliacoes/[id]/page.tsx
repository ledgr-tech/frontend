"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  buscarConciliacao,
  fecharConciliacao,
  formatarMoeda,
  type Conciliacao,
  type LinhaComparacao,
} from "@/lib/mock-data";
import { statusDaLinha } from "../../dashboard/resumo";
import { EsqueletoTela } from "../../esqueleto";
import { filtrarLinhas, ordenarLinhas, type Coluna, type Ordem } from "./ordenar";
import { aplicarDensidade, densidadeAtual, type Densidade } from "../../densidade";

/** Quantas linhas por página. 4.218 lançamentos não cabem numa tela. */
const POR_PAGINA = 25;

/**
 * Cabeçalho ordenável. Vive no escopo do módulo de propósito: definido dentro do
 * componente da página, cada render criava um tipo novo e o <thead> inteiro
 * remontava — perdendo foco de teclado no meio de uma ordenação.
 */
function Cabecalho({
  coluna,
  ordem,
  onOrdenar,
  children,
  direita = false,
}: {
  coluna: Coluna;
  ordem: Ordem;
  onOrdenar: (coluna: Coluna) => void;
  children: React.ReactNode;
  direita?: boolean;
}) {
  const ativa = ordem.coluna === coluna;
  return (
    <th
      className={direita ? "th-direita" : undefined}
      style={direita ? { textAlign: "right" } : undefined}
      aria-sort={ativa ? (ordem.crescente ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="th-ordena" onClick={() => onOrdenar(coluna)}>
        {children}
        <span className="th-ordena-seta" aria-hidden="true">
          {ativa ? (ordem.crescente ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ConciliacaoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [conciliacao, setConciliacao] = useState<Conciliacao | null | undefined>(undefined);
  const [linhaAberta, setLinhaAberta] = useState<LinhaComparacao | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "revisao">("todos");
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "data", crescente: true });
  const [pagina, setPagina] = useState(0);
  // null enquanto não lemos a preferência: só existe no cliente
  const [densidade, setDensidade] = useState<Densidade | null>(null);

  useEffect(() => {
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConciliacao(buscarConciliacao(params.id));
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDensidade(densidadeAtual());
  }, []);

  if (conciliacao === undefined) {
    return <EsqueletoTela />;
  }

  if (conciliacao === null) {
    return (
      <div style={{ padding: "48px 0" }}>
        <p>Conciliação não encontrada.</p>
      </div>
    );
  }

  function fechar() {
    const atualizada = fecharConciliacao(conciliacao!.id);
    if (atualizada) setConciliacao(atualizada);
  }

  if (conciliacao.status === "fechada") {
    return (
      <Fechamento
        conciliacao={conciliacao}
        onNovaConciliacao={() => router.push("/conciliacoes/nova")}
      />
    );
  }

  const emRevisao = filtrarLinhas(conciliacao.linhas, "revisao");
  const ordenadas = ordenarLinhas(filtrarLinhas(conciliacao.linhas, filtro), ordem);
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  // limita em vez de corrigir num efeito: filtrar pode encurtar a lista e deixar a
  // página atual fora do fim, e reagir a isso com setState causaria render extra
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = ordenadas.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);

  function escolherDensidade(proxima: Densidade) {
    aplicarDensidade(proxima);
    setDensidade(proxima);
  }

  function alternarOrdem(coluna: Coluna) {
    setOrdem((atual) =>
      atual.coluna === coluna ? { coluna, crescente: !atual.crescente } : { coluna, crescente: true },
    );
    setPagina(0);
  }

  return (
    <div style={{ padding: "28px 0 72px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="tabela-controles">
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600 }}>Comparação direta</h1>
        <div className="pills">
          <button
            type="button"
            className="pill"
            aria-pressed={filtro === "todos"}
            onClick={() => {
              setFiltro("todos");
              setPagina(0);
            }}
          >
            Todos ({conciliacao.linhas.length})
          </button>
          <button
            type="button"
            className="pill"
            aria-pressed={filtro === "revisao"}
            onClick={() => {
              setFiltro("revisao");
              setPagina(0);
            }}
          >
            Só revisão ({emRevisao.length})
          </button>
        </div>
      </div>

      {densidade !== null && (
        <div className="pills" role="group" aria-label="Densidade da tabela">
          <button
            type="button"
            className="pill"
            aria-pressed={densidade === "padrao"}
            onClick={() => escolherDensidade("padrao")}
          >
            Padrão
          </button>
          <button
            type="button"
            className="pill"
            aria-pressed={densidade === "compacta"}
            onClick={() => escolherDensidade("compacta")}
          >
            Compacta
          </button>
        </div>
      )}

      <div>
        <div className="dash-tabela-rolagem tabela-cartoes">
          <table className="table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <Cabecalho coluna="data" ordem={ordem} onOrdenar={alternarOrdem}>
                  Data
                </Cabecalho>
                <Cabecalho coluna="descricao" ordem={ordem} onOrdenar={alternarOrdem}>
                  Descrição
                </Cabecalho>
                <Cabecalho coluna="valorBanco" ordem={ordem} onOrdenar={alternarOrdem} direita>
                  Banco
                </Cabecalho>
                <Cabecalho coluna="valorSistema" ordem={ordem} onOrdenar={alternarOrdem} direita>
                  Sistema
                </Cabecalho>
                <Cabecalho coluna="status" ordem={ordem} onOrdenar={alternarOrdem} direita>
                  Status
                </Cabecalho>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {visiveis.map((linha) => {
                const status = statusDaLinha(linha.status);
                return (
                  <tr key={linha.id} role="row">
                    <td role="cell" data-rotulo="Data" className="dash-celula-fraca">
                      {linha.data}
                    </td>
                    <td role="cell" data-rotulo="Descrição" data-destaque="true">
                      {/* botão de verdade: a linha inteira com onClick não era
                          alcançável por teclado */}
                      <button
                        type="button"
                        className="celula-abrir"
                        onClick={() => setLinhaAberta(linha)}
                      >
                        {linha.descricao}
                      </button>
                    </td>
                    <td role="cell" data-rotulo="Banco" className="dash-valor-celula">
                      {linha.valorBanco !== null ? formatarMoeda(linha.valorBanco) : "—"}
                    </td>
                    <td role="cell" data-rotulo="Sistema" className="dash-valor-celula">
                      {linha.valorSistema !== null ? formatarMoeda(linha.valorSistema) : "—"}
                    </td>
                    <td role="cell" data-rotulo="Status" style={{ textAlign: "right" }}>
                      <span className={`selo selo-${status.tom}`}>{status.rotulo}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {ordenadas.length === 0 && (
          <p className="tabela-vazia">
            Nada em revisão nesta competência — todos os lançamentos bateram.
          </p>
        )}

        {totalPaginas > 1 && (
          <div className="paginacao">
            <span className="paginacao-conta">
              {paginaAtual * POR_PAGINA + 1}–
              {Math.min((paginaAtual + 1) * POR_PAGINA, ordenadas.length)} de {ordenadas.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={paginaAtual === 0}
                onClick={() => setPagina(paginaAtual - 1)}
              >
                Anterior
              </button>
              <span className="paginacao-conta">
                {paginaAtual + 1} / {totalPaginas}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={paginaAtual >= totalPaginas - 1}
                onClick={() => setPagina(paginaAtual + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button type="button" className="btn btn-primary" onClick={fechar}>
          Fechar mês
        </button>
      </div>

      {linhaAberta && (
        <div className="dialog-backdrop" onClick={() => setLinhaAberta(null)}>
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <span className="dialog-title">{linhaAberta.descricao}</span>
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Extrato do banco</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600 }}>
                  {linhaAberta.valorBanco !== null ? formatarMoeda(linhaAberta.valorBanco) : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Extrato do sistema</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600 }}>
                  {linhaAberta.valorSistema !== null ? formatarMoeda(linhaAberta.valorSistema) : "—"}
                </div>
              </div>
            </div>
            {linhaAberta.explicacao && <p className="dialog-body">{linhaAberta.explicacao}</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                </tr>
              </thead>
              <tbody>
                {linhaAberta.historico.map((evento) => (
                  <tr key={`${evento.quando}-${evento.evento}`}>
                    <td>{evento.quando}</td>
                    <td>{evento.evento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setLinhaAberta(null)}>
                Fechar
              </button>
              {/* ponytail: o diálogo é o espia rápido; o detalhe inteiro é tela própria
                  no design. Os dois mostram a mesma linha — quando a tela provar que
                  basta, o diálogo pode sair. */}
              <Link
                href={`/conciliacoes/${conciliacao.id}/${linhaAberta.id}`}
                className="btn btn-primary"
              >
                Abrir detalhe
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fechamento({
  conciliacao,
  onNovaConciliacao,
}: {
  conciliacao: Conciliacao;
  onNovaConciliacao: () => void;
}) {
  const total = conciliacao.linhas.length;
  const batidos = conciliacao.linhas.filter((linha) => linha.status === "batido").length;
  const pendentes = total - batidos;

  return (
    <div style={{ padding: "44px 0 64px", maxWidth: 1000, display: "flex", flexDirection: "column", gap: 34 }}>
      <div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-accent-700)",
            marginBottom: 14,
          }}
        >
          Mês conciliado
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: 42, fontWeight: 400 }}>
          {pendentes === 0
            ? `${conciliacao.mes} fechou sem divergência pendente.`
            : `${conciliacao.mes} fechado com ${pendentes} ${pendentes === 1 ? "item revisado" : "itens revisados"}.`}
        </h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          borderTop: "1px solid var(--color-divider)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>Lançamentos</span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{total}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>
            Batidos automaticamente
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{batidos}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>
            Revisados manualmente
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{pendentes}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNovaConciliacao}
          style={{ fontSize: 15, padding: "12px 22px" }}
        >
          Começar o próximo mês
        </button>
      </div>
    </div>
  );
}
