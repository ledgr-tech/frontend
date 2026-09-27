"use client";

import { createContext, useContext, type ReactNode } from "react";

type Parte = string | null | false | undefined;

/** A razão social da empresa logada; vazia enquanto o backend não a devolve. */
export const EmpresaDaSessao = createContext("");

/**
 * O topo de toda tela do app: o título (o mesmo nome do menu), a linha de
 * contexto, as ações da própria tela e o filete embaixo.
 *
 * A linha começa sempre pela empresa; `contexto` diz o resto ("competência
 * setembro/2026", "4 arquivos"), e parte vazia fica de fora. Tela de detalhe
 * não tem a linha: usa `sobretitulo`, que diz onde o item está.
 *
 * A empresa é a da sessão, que o `Shell` põe no contexto (vem de `GET /me`).
 * Sem ela, a linha começa direto pelo contexto: nunca o nome de outra empresa.
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
  const empresa = useContext(EmpresaDaSessao);
  const linha = contexto && [empresa, ...contexto].filter(Boolean).join(" · ");
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
