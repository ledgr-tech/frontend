"use client";

import { Fragment, useRef, useState } from "react";
import { useRoteador } from "@/lib/roteador";
import { formatarMoeda } from "@/lib/mock-data";
import { MensagemErro } from "../../../../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../../../../dashboard/resumo";
import {
  acrescentarLinhaAoRascunho,
  confirmarImportacao,
  corrigirLinhaDoRascunho,
  descartarImportacao,
  removerLinhaDoRascunho,
  type LinhaDoRascunho,
  type Rascunho,
  type ResumoDoRascunho,
} from "../acoes";

type Campos = { data: string; valor: string; descricao: string };
const VAZIA: Campos = { data: "", valor: "", descricao: "" };

/**
 * A tela de conferência (#225): as linhas que a IA devolveu, para corrigir ou remover antes de confirmar.
 * Cada mudança vai ao backend na hora e devolve o resumo recalculado; só "Confirmar importação" faz os
 * lançamentos entrarem no sistema, e "Descartar" apaga o rascunho. O rascunho vence em 7 dias.
 */
export function Revisao({ inicial }: { inicial: Rascunho }) {
  const roteador = useRoteador();
  const [linhas, setLinhas] = useState<LinhaDoRascunho[]>(inicial.itens);
  const [resumo, setResumo] = useState<ResumoDoRascunho>(inicial.resumo);
  const [editando, setEditando] = useState<string | null>(null);
  const [campos, setCampos] = useState<Campos>(VAZIA);
  const [nova, setNova] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const trava = useRef(false);

  /** Uma chamada por vez: a trava fecha antes do primeiro await, como nos outros painéis. */
  async function executar(trabalho: () => Promise<string | null>) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      const falha = await trabalho();
      if (falha) setErro(falha);
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  const salvar = () =>
    executar(async () => {
      if (editando) {
        const r = await corrigirLinhaDoRascunho(inicial.id, editando, campos);
        if (!r.ok) return r.erro;
        setLinhas((atual) => atual.map((l) => (l.id === editando ? r.dados.linha : l)));
        setResumo(r.dados.resumo);
        setEditando(null);
      } else {
        const r = await acrescentarLinhaAoRascunho(inicial.id, campos);
        if (!r.ok) return r.erro;
        setLinhas((atual) => [...atual, r.dados.linha]);
        setResumo(r.dados.resumo);
        setNova(false);
        setCampos(VAZIA);
      }
      return null;
    });

  const remover = (linha: LinhaDoRascunho) =>
    executar(async () => {
      const r = await removerLinhaDoRascunho(inicial.id, linha.id);
      if (!r.ok) return r.erro;
      setLinhas((atual) => atual.filter((l) => l.id !== linha.id));
      setResumo((atual) => ({ ...atual, quantidade: atual.quantidade - 1 }));
      return null;
    });

  const confirmar = () =>
    executar(async () => {
      const r = await confirmarImportacao(inicial.id);
      if (!r.ok) return r.erro;
      roteador.push("/extratos");
      return null;
    });

  const descartar = () =>
    executar(async () => {
      const r = await descartarImportacao(inicial.id);
      if (!r.ok && r.status !== 404) return r.erro;
      roteador.push("/conciliacoes/nova");
      return null;
    });

  function formulario(titulo: string) {
    return (
      <tr>
        <td />
        <td>
          <input className="input" type="date" aria-label={`Data (${titulo})`} value={campos.data} onChange={(e) => setCampos({ ...campos, data: e.target.value })} />
        </td>
        <td>
          <input className="input" aria-label={`Descrição (${titulo})`} value={campos.descricao} maxLength={500} onChange={(e) => setCampos({ ...campos, descricao: e.target.value })} />
        </td>
        <td>
          <input className="input" inputMode="decimal" aria-label={`Valor (${titulo})`} placeholder="-120.50" value={campos.valor} onChange={(e) => setCampos({ ...campos, valor: e.target.value })} />
        </td>
        <td>
          <button type="button" className="btn btn-primary" onClick={salvar} disabled={ocupado}>
            Salvar
          </button>{" "}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setEditando(null);
              setNova(false);
            }}
          >
            Cancelar
          </button>
        </td>
      </tr>
    );
  }

  const maisLinhasQueAsMostradas = inicial.total > inicial.itens.length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p role="status">
        {`${resumo.quantidade} ${resumo.quantidade === 1 ? "lançamento" : "lançamentos"} · entradas ${formatarMoeda(Number(resumo.totalEntradas))} · saídas ${formatarMoeda(Number(resumo.totalSaidas))} · o rascunho vale até ${formatarDataHora(resumo.expiraEm).slice(0, 10)}`}
      </p>
      {maisLinhasQueAsMostradas && (
        <p role="note">{`Mostrando as primeiras ${inicial.itens.length} de ${inicial.total} linhas. As demais entram junto na confirmação.`}</p>
      )}

      <table className="table" aria-label="Linhas importadas">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Data</th>
            <th scope="col">Descrição</th>
            <th scope="col" className="rel-num">
              Valor
            </th>
            <th scope="col">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) =>
            editando === linha.id ? (
              <Fragment key={linha.id}>{formulario(`linha ${linha.numero}`)}</Fragment>
            ) : (
              <tr key={linha.id}>
                <td>{linha.numero}</td>
                <td>{linha.data.split("-").reverse().join("/")}</td>
                <td>{linha.descricao}</td>
                <td className="rel-num">{formatarMoeda(Number(linha.valor))}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={ocupado}
                    onClick={() => {
                      setEditando(linha.id);
                      setNova(false);
                      setCampos({ data: linha.data, valor: linha.valor, descricao: linha.descricao });
                      setErro(null);
                    }}
                  >
                    {`Corrigir linha ${linha.numero}`}
                  </button>{" "}
                  <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => remover(linha)}>
                    {`Remover linha ${linha.numero}`}
                  </button>
                </td>
              </tr>
            ),
          )}
          {nova && formulario("nova linha")}
        </tbody>
      </table>

      {!nova && !editando && (
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setNova(true);
              setCampos(VAZIA);
              setErro(null);
            }}
          >
            Acrescentar linha
          </button>
        </div>
      )}

      {erro && <MensagemErro id="erro-revisao-ia">{erro}</MensagemErro>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={confirmar} disabled={ocupado || resumo.quantidade === 0}>
          Confirmar importação
        </button>
        {confirmandoDescarte ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={descartar} disabled={ocupado}>
              Descartar de vez
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmandoDescarte(false)}>
              Voltar
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmandoDescarte(true)} disabled={ocupado}>
            Descartar importação
          </button>
        )}
      </div>
    </div>
  );
}
