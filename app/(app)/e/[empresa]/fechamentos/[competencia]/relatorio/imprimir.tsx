"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * O PDF sai da impressão do navegador ("Salvar como PDF"), sem biblioteca: é o que o Chrome, o
 * Edge e o Safari já fazem, e o CSS de impressão do relatório cuida do A4.
 *
 * Aberto pelo "Baixar PDF" da mesa (`?imprimir=1`), chama a impressão sozinho, depois das fontes:
 * antes delas, o PDF sairia com a fonte de reserva. E tira o parâmetro da URL, para recarregar a
 * aba não abrir a impressão de novo.
 */
export function Imprimir({ automatico }: { automatico: boolean }) {
  useEffect(() => {
    if (!automatico) return;
    let cancelado = false;
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelado) return;
      window.history.replaceState(null, "", window.location.pathname);
      window.print();
    });
    return () => {
      cancelado = true;
    };
  }, [automatico]);

  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <Printer size={16} aria-hidden />
      Imprimir ou salvar PDF
    </button>
  );
}
