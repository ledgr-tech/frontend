"use client";

import { useId, useRef, useState } from "react";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";

/**
 * Aprovar ou rejeitar várias justificativas de uma vez (backend #132, front #208): na mesa de
 * fechamento, as do mês; na comparação, as selecionadas que aguardam. Rejeitar pede o motivo, opcional como
 * na janela da linha. `onDecidir` devolve o motivo de não ter gravado, ou null.
 */
export function DecisaoEmLote({
  quantidade,
  limite,
  objeto,
  onDecidir,
}: {
  quantidade: number;
  /** A seleção de linhas aceita até 500; o lote por competência não tem esse limite. */
  limite?: number;
  /** "justificativa"/"justificativas" na mesa; "justificativa selecionada"/"justificativas selecionadas" na comparação. */
  objeto: { um: string; varios: string };
  onDecidir: (acao: "aprovar" | "rejeitar", motivo?: string) => Promise<string | null>;
}) {
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // um envio por vez: o segundo clique antes do primeiro voltar não manda outro lote
  const travado = useRef(false);
  const idMotivo = useId();
  const quais = quantidade === 1 ? `a ${objeto.um}` : `as ${quantidade.toLocaleString("pt-BR")} ${objeto.varios}`;
  const acimaDoLimite = limite !== undefined && quantidade > limite;

  async function decidir(acao: "aprovar" | "rejeitar") {
    if (travado.current || acimaDoLimite) return;
    travado.current = true;
    setEnviando(true);
    setErro(null);
    let falha: string | null;
    try {
      falha = await onDecidir(acao, acao === "rejeitar" ? motivo.trim() || undefined : undefined);
    } catch {
      // a Server Action lançou (rede caída, deploy novo no meio) em vez de devolver um Resultado
      falha = SEM_SERVIDOR;
    }
    travado.current = false;
    setEnviando(false);
    setErro(falha);
    if (falha === null) {
      setRejeitando(false);
      setMotivo("");
    }
  }

  return (
    <>
      {acimaDoLimite && (
        <p className="vg-nota">{`Selecione no máximo ${limite.toLocaleString("pt-BR")} justificativas para aprovar ou rejeitar de uma vez.`}</p>
      )}
      {rejeitando ? (
        <form
          className="lote-rejeicao"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            void decidir("rejeitar");
          }}
        >
          <div className="field">
            <label htmlFor={idMotivo}>Motivo da rejeição (opcional)</label>
            <textarea
              id={idMotivo}
              className="input"
              rows={2}
              maxLength={1000}
              value={motivo}
              disabled={enviando}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </div>
          <p className="vg-nota">As linhas voltam a divergentes, e quem justificou vê o motivo no histórico.</p>
          <div className="fech-acoes">
            <button type="submit" className="btn btn-secondary" disabled={enviando || acimaDoLimite} aria-busy={enviando || undefined}>
              {`Rejeitar ${quais}`}
            </button>
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => setRejeitando(false)}>
              Voltar
            </button>
          </div>
        </form>
      ) : (
        <div className="fech-acoes">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={enviando || acimaDoLimite}
            aria-busy={enviando || undefined}
            onClick={() => void decidir("aprovar")}
          >
            {`Aprovar ${quais}`}
          </button>
          <button type="button" className="btn btn-secondary" disabled={enviando || acimaDoLimite} onClick={() => setRejeitando(true)}>
            Rejeitar…
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="selo selo-risco fech-erro">
          {erro}
        </p>
      )}
    </>
  );
}
