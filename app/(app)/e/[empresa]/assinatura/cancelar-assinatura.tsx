"use client";

import { useRef, useState } from "react";
import { ModalDaTela } from "../empresas/modal-da-tela";

/** O que muda ao cancelar (#232): o período pago vale até o fim; depois, só consulta. */
export function textoDoCancelamento(fimDoPeriodo: string): string {
  return `Você continua com acesso a tudo até ${fimDoPeriodo}, o fim do período já pago. Depois disso, o histórico continua disponível para consulta, mas nenhum extrato novo poderá ser conciliado.`;
}

export const NOTA_DO_CANCELAMENTO = "A cobrança ainda não está no ar: nada é cancelado por aqui.";

/**
 * "Cancelar assinatura" e a confirmação, na mesma janela das outras telas (`ModalDaTela`: o <dialog>
 * nativo, com o fundo escurecido e desfocado). A janela abre porque diz o que o cancelamento faria;
 * o "Cancelar mesmo assim" nasce desligado porque não há cobrança no backend para cancelar, e fechar
 * a janela como se tivesse cancelado seria mentira.
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
      {aberto && (
        <ModalDaTela titulo="Cancelar a assinatura desta empresa?" aoFechar={fechar}>
          <p className="dialog-body" style={{ margin: 0, lineHeight: 1.6 }}>
            {textoDoCancelamento(fimDoPeriodo)}
          </p>
          <div className="dialog-actions">
            {/* o primeiro botão recebe o foco: um Enter distraído mantém a assinatura */}
            <button type="button" className="btn btn-secondary" onClick={fechar}>
              Manter assinatura
            </button>
            <button type="button" className="btn btn-primary" disabled aria-describedby="assinatura-cancelar-nota">
              Cancelar mesmo assim
            </button>
          </div>
          <p id="assinatura-cancelar-nota" className="ass-dialogo-nota">
            {NOTA_DO_CANCELAMENTO}
          </p>
        </ModalDaTela>
      )}
    </>
  );
}
