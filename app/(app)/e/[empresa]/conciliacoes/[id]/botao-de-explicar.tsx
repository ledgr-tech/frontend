import { Sparkles } from "lucide-react";

/**
 * "Explicar esta divergência", no painel da comparação e no detalhe da linha. Tem o tom do cartão da
 * explicação que ele vira (borda e fundo do acento, bem leves), e o ícone pulsa enquanto o Ledgr lê.
 */
export function BotaoDeExplicar({
  explicando,
  falhou,
  onClick,
}: {
  explicando: boolean;
  falhou: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="btn btn-explicar" disabled={explicando} aria-busy={explicando} onClick={onClick}>
      <Sparkles size={16} aria-hidden="true" />
      {explicando ? "Explicando…" : falhou ? "Tentar de novo" : "Explicar esta divergência"}
    </button>
  );
}
