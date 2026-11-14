"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TelaDeAviso } from "@/app/tela-de-aviso";
import { Folha } from "../../(app)/e/[empresa]/fechamentos/folha";
import { Imprimir } from "../../(app)/e/[empresa]/fechamentos/[competencia]/relatorio/imprimir";
import { formatarDataHora } from "../../(app)/e/[empresa]/dashboard/resumo";
import { consultarRelatorioPublico, type ResultadoRelatorioPublico } from "./acoes";

// a tela de quem abriu um link que não serve (#388): a mesma do 404, com mascote, título e saída
const AVISOS = {
  invalido: {
    titulo: "Este link não abre mais.",
    texto: "Ele expirou ou foi revogado. Peça um novo a quem enviou o relatório.",
    mascote: "lupa",
  },
  muitas_tentativas: {
    titulo: "Muitas tentativas seguidas.",
    texto: "Espere um minuto e tente de novo.",
    mascote: "neutro",
  },
  falha: {
    titulo: "Não foi possível abrir o relatório agora.",
    texto: "Tente de novo em instantes.",
    mascote: "tomadas",
  },
} as const;

/**
 * A página do link público do relatório (#229): `/relatorio#<token>`. O token vem no fragmento, que o
 * navegador não manda ao servidor: a página lê uma vez, tira da barra de endereço e consulta. É a mesma
 * folha do PDF, sem o menu do app.
 */
export function Visualizador() {
  const [resultado, setResultado] = useState<ResultadoRelatorioPublico | null>(null);
  // "Tentar de novo" consulta outra vez com o token guardado: ele já saiu da barra, recarregar o perderia
  const [tentativa, setTentativa] = useState(0);

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
  }, [tentativa]);

  if (!resultado) return <p className="rel-pagina" aria-busy="true">Abrindo o relatório…</p>;
  if (!resultado.ok) {
    const aviso = AVISOS[resultado.motivo];
    return (
      <main className="aviso-pagina">
        {/* o alerta fica dentro do main, que segue sendo o marco da página */}
        <div role="alert">
          <TelaDeAviso titulo={aviso.titulo} texto={aviso.texto} mascote={aviso.mascote}>
            {resultado.motivo !== "invalido" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setResultado(null);
                  setTentativa((t) => t + 1);
                }}
              >
                Tentar de novo
              </button>
            )}
            <Link href="/" className={resultado.motivo === "invalido" ? "btn btn-primary" : "btn btn-secondary"}>
              Conhecer o Ledgr
            </Link>
          </TelaDeAviso>
        </div>
      </main>
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
