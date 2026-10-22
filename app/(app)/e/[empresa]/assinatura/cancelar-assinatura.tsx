"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * "Cancelar assinatura" e a confirmação do design (dialogoAberto em
 * Ledgr.dc.html). O diálogo abre porque diz o que o cancelamento faria; o
 * "Cancelar mesmo assim" nasce desligado porque não há cobrança no backend
 * para cancelar, e fechar o diálogo como se tivesse cancelado seria mentira.
 */
export function CancelarAssinatura({ fimDoPeriodo }: { fimDoPeriodo: string }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  function fechar() {
    setAberto(false);
    // o foco volta para onde estava, e não para o topo da página
    botao.current?.focus();
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="btn ass-cancelar"
        aria-haspopup="dialog"
        onClick={() => setAberto(true)}
      >
        Cancelar assinatura
      </button>
      {aberto && <Confirmacao fimDoPeriodo={fimDoPeriodo} onFechar={fechar} />}
    </>
  );
}

function Confirmacao({ fimDoPeriodo, onFechar }: { fimDoPeriodo: string; onFechar: () => void }) {
  const tituloId = useId();
  const textoId = useId();
  const notaId = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const manter = useRef<HTMLButtonElement>(null);

  // o foco começa na saída segura: um Enter distraído mantém a assinatura
  useEffect(() => {
    manter.current?.focus();
  }, []);

  // Esc fecha e o Tab fica preso dentro do diálogo enquanto ele está aberto
  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onFechar();
        return;
      }
      const elemento = caixa.current;
      if (evento.key !== "Tab" || !elemento) return;
      const focaveis = [...elemento.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (evento.shiftKey && (ativo === primeiro || !elemento.contains(ativo))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (ativo === ultimo || !elemento.contains(ativo))) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onFechar]);

  return (
    <div
      data-testid="assinatura-fundo"
      className="dialog-backdrop"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={`${textoId} ${notaId}`}
        className="dialog"
      >
        <h2 id={tituloId} className="dialog-title" style={{ margin: 0 }}>
          Cancelar a assinatura desta empresa?
        </h2>
        <p id={textoId} className="dialog-body" style={{ margin: 0, lineHeight: 1.6 }}>
          {`O histórico de setembro continua acessível por doze meses, mas nenhum extrato novo poderá ser conciliado a partir de ${fimDoPeriodo}.`}
        </p>
        <div className="dialog-actions">
          <button ref={manter} type="button" className="btn btn-secondary" onClick={onFechar}>
            Manter assinatura
          </button>
          <button type="button" className="btn btn-primary" disabled aria-describedby={notaId}>
            Cancelar mesmo assim
          </button>
        </div>
        <p id={notaId} className="ass-dialogo-nota">
          A cobrança ainda não está no ar: nada é cancelado por aqui.
        </p>
      </div>
    </div>
  );
}
