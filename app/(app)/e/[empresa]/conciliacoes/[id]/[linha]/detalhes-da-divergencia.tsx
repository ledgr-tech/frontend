"use client";

import { useEffect, useState } from "react";
import { carregarDetalhesDaDivergencia, type DetalhesDaDivergencia } from "../../acoes";

/**
 * Os fatos da divergência (valores, datas, diferença, tolerância), calculados pelo backend (#196). A rota só
 * lê: não chama a IA nem conta no limite diário, então roda ao abrir a linha. Sem resposta (um backend
 * anterior ao #196, uma falha), devolve null e a tela segue como estava.
 */
export function useDetalhesDaDivergencia(linhaId: string): DetalhesDaDivergencia | null {
  const [lido, setLido] = useState<{ linhaId: string; dados: DetalhesDaDivergencia } | null>(null);
  useEffect(() => {
    let atual = true;
    carregarDetalhesDaDivergencia(linhaId)
      .then((resposta) => {
        if (atual && resposta.ok) setLido({ linhaId, dados: resposta.dados });
      })
      .catch(() => {});
    return () => {
      atual = false;
    };
  }, [linhaId]);
  // o resultado de outra linha não vale para esta
  return lido?.linhaId === linhaId ? lido.dados : null;
}

/** Rótulo e valor já formatados pelo backend, sempre como texto puro. */
export function ListaDeDetalhes({ detalhes }: { detalhes: { rotulo: string; valor: string }[] }) {
  if (detalhes.length === 0) return null;
  return (
    <dl className="conc-previa-dados" aria-label="Fatos da divergência">
      {detalhes.map((d, i) => (
        <div key={`${d.rotulo}-${i}`} style={{ display: "contents" }}>
          <dt>{d.rotulo}</dt>
          <dd>{d.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Os fatos sozinhos, abaixo de uma explicação que já está na tela (a da IA, vinda na listagem). */
export function DetalhesDaLinha({ linhaId }: { linhaId: string }) {
  const lidos = useDetalhesDaDivergencia(linhaId);
  return lidos ? <ListaDeDetalhes detalhes={lidos.detalhes} /> : null;
}
