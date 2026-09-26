import type { ReactNode } from "react";
import { EMPRESA_MOCK } from "@/lib/mock-data";

type Parte = string | null | false | undefined;

/**
 * O topo de toda tela do app: o título (o mesmo nome do menu), a linha de
 * contexto, as ações da própria tela e o filete embaixo.
 *
 * A linha começa sempre pela empresa; `contexto` diz o resto ("competência
 * setembro/2026", "4 arquivos"), e parte vazia fica de fora. Tela de detalhe
 * não tem a linha: usa `sobretitulo`, que diz onde o item está.
 *
 * ponytail: a empresa é o `EMPRESA_MOCK`, porque o backend não devolve a razão
 * social (sem `GET /me`). Este é o único lugar a trocar quando devolver.
 */
export function Cabecalho({
  titulo,
  contexto,
  sobretitulo,
  acoes,
}: {
  titulo: ReactNode;
  contexto?: Parte[];
  sobretitulo?: ReactNode;
  acoes?: ReactNode;
}) {
  const linha = contexto && [EMPRESA_MOCK, ...contexto.filter(Boolean)].join(" · ");
  return (
    <div className="dash-cabecalho">
      <div>
        {sobretitulo && <div className="det-kicker">{sobretitulo}</div>}
        <h1 className="tela-titulo">{titulo}</h1>
        {linha && <span className="vg-subtitulo tela-contexto">{linha}</span>}
      </div>
      {acoes && <div className="tela-acoes">{acoes}</div>}
    </div>
  );
}
