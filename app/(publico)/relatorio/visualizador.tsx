"use client";

import { useEffect, useRef, useState } from "react";
import { Folha } from "../../(app)/e/[empresa]/fechamentos/folha";
import { Imprimir } from "../../(app)/e/[empresa]/fechamentos/[competencia]/relatorio/imprimir";
import { formatarDataHora } from "../../(app)/e/[empresa]/dashboard/resumo";
import { consultarRelatorioPublico, type ResultadoRelatorioPublico } from "./acoes";

const MENSAGENS = {
  invalido: "Este link expirou ou foi revogado. Peça um novo a quem enviou o relatório.",
  muitas_tentativas: "Muitas tentativas seguidas. Espere um minuto e recarregue a página.",
  falha: "Não foi possível abrir o relatório agora. Recarregue a página em instantes.",
} as const;

/**
 * A página do link público do relatório (#229): `/relatorio#<token>`. O token vem no fragmento, que o
 * navegador não manda ao servidor: a página lê uma vez, tira da barra de endereço e consulta. É a mesma
 * folha do PDF, sem o menu do app.
 */
export function Visualizador() {
  const [resultado, setResultado] = useState<ResultadoRelatorioPublico | null>(null);

  // guardado na memória: o StrictMode roda o efeito duas vezes, e na segunda o fragmento já saiu da barra
  const guardado = useRef<string | null>(null);

  useEffect(() => {
    guardado.current ??= window.location.hash.slice(1);
    const token = guardado.current;
    history.replaceState(null, "", window.location.pathname);
    let vivo = true;
    const consulta: Promise<ResultadoRelatorioPublico> = token
      ? consultarRelatorioPublico(token)
      : Promise.resolve({ ok: false, motivo: "invalido" });
    consulta
      .then((r) => vivo && setResultado(r))
      .catch(() => vivo && setResultado({ ok: false, motivo: "falha" }));
    return () => {
      vivo = false;
    };
  }, []);

  if (!resultado) return <p className="rel-pagina" aria-busy="true">Abrindo o relatório…</p>;
  if (!resultado.ok) {
    return (
      <div className="rel-pagina">
        <p role="alert" style={{ padding: "48px 0" }}>
          {MENSAGENS[resultado.motivo]}
        </p>
      </div>
    );
  }
  return (
    <div className="rel-pagina">
      <div className="rel-barra">
        <span>{`Link válido até ${formatarDataHora(resultado.expiraEm).slice(0, 10)}`}</span>
        <Imprimir automatico={false} />
      </div>
      <Folha relatorio={resultado.relatorio} />
    </div>
  );
}
