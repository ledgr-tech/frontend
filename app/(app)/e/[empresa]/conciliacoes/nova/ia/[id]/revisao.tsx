"use client";

import { Fragment, useRef, useState } from "react";
import { ArrowRight, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useRoteador } from "@/lib/roteador";
import { formatarMoeda } from "@/lib/mock-data";
import { MensagemErro } from "../../../../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../../../../dashboard/resumo";
import { IconeOrigem } from "../../../../icone-origem";
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
 * A tela de conferência (#225), no molde da Nova conciliação (versão D, 30/10): a tabela do rascunho
 * dentro da folha do sistema, com corrigir e remover por ícone, e o painel ao lado com quantos
 * lançamentos, entradas, saídas e as ações Confirmar e Descartar (Descartar pede confirmação). Cada mudança vai ao backend na
 * hora e devolve o resumo recalculado; só "Confirmar" faz os lançamentos entrarem no sistema, e
 * "Descartar" apaga o rascunho. O rascunho vence em 7 dias.
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
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
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
  const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
  const periodo =
    resumo.periodoInicio && resumo.periodoFim ? `${dataBr(resumo.periodoInicio)} a ${dataBr(resumo.periodoFim)}` : null;

  return (
    <div className="nova-corpo conc-mesa">
      {/* a tabela do rascunho dentro da folha do sistema: é o que vai virar o extrato do sistema */}
      <div className="ia-rev">
        <div className="ia-rev-cabeca">
          <span className="rotulo">
            <IconeOrigem origem="sistema" tamanho={13} />
            Relatório de lançamentos · rascunho
          </span>
          <span>{`${resumo.quantidade} ${resumo.quantidade === 1 ? "lançamento" : "lançamentos"} lidos do arquivo da IA`}</span>
        </div>
        {maisLinhasQueAsMostradas && (
          <p role="note" className="ia-rev-nota">{`Mostrando as primeiras ${inicial.itens.length} de ${inicial.total} linhas. As demais entram junto na confirmação.`}</p>
        )}
        <div className="ia-rolavel">
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
                    <td className="nova-apagado">{linha.numero}</td>
                    <td>{linha.data.split("-").reverse().join("/")}</td>
                    <td>{linha.descricao}</td>
                    <td className="rel-num">{formatarMoeda(Number(linha.valor))}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Corrigir linha ${linha.numero}`}
                        disabled={ocupado}
                        onClick={() => {
                          setEditando(linha.id);
                          setNova(false);
                          setCampos({ data: linha.data, valor: linha.valor, descricao: linha.descricao });
                          setErro(null);
                        }}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn btn-ghost" aria-label={`Remover linha ${linha.numero}`} disabled={ocupado} onClick={() => remover(linha)}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ),
              )}
              {nova && formulario("nova linha")}
            </tbody>
          </table>
        </div>
        {(erro || (!nova && !editando)) && (
          <div className="ia-rev-pe">
            {erro && <MensagemErro id="erro-revisao-ia">{erro}</MensagemErro>}
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
                  <Plus size={16} aria-hidden="true" />
                  Acrescentar linha
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="conc-previa" aria-label="Resumo do rascunho">
        <span className="rotulo">{`Rascunho · vale até ${formatarDataHora(resumo.expiraEm).slice(0, 10)}`}</span>
        <h2 className="conc-previa-titulo">Confira antes de confirmar</h2>
        <div className="extrato-resultado" role="status">
          <p className="conc-previa-numero">
            <strong>{resumo.quantidade}</strong> {resumo.quantidade === 1 ? "lançamento" : "lançamentos"}
          </p>
        </div>
        <dl className="conc-previa-dados">
          <dt>Entradas</dt>
          <dd>{formatarMoeda(Number(resumo.totalEntradas))}</dd>
          <dt>Saídas</dt>
          <dd>{formatarMoeda(Number(resumo.totalSaidas))}</dd>
          {periodo && (
            <>
              <dt>Período</dt>
              <dd>{periodo}</dd>
            </>
          )}
        </dl>
        <div className="conc-previa-acoes">
          <button type="button" className="btn nova-conciliar" onClick={confirmar} disabled={ocupado || resumo.quantidade === 0}>
            {`Confirmar ${resumo.quantidade} ${resumo.quantidade === 1 ? "lançamento" : "lançamentos"}`}
            <ArrowRight aria-hidden="true" />
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
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmandoDescarte(true)} disabled={ocupado}>
              Descartar importação
            </button>
          )}
        </div>
        <p className="nova-nota">
          <ShieldCheck aria-hidden="true" />
          <span>Ao confirmar, as linhas entram como o extrato do sistema e aparecem em Extratos, prontas para conciliar com o do banco.</span>
        </p>
      </aside>
    </div>
  );
}
