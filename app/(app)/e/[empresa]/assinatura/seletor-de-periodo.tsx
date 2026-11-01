"use client";

import { useState } from "react";
import type { Periodo } from "@/lib/assinatura";

const NOMES: Record<Periodo, string> = { mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };
const OUTROS: Periodo[] = ["trimestral", "semestral"];

/** Mensal e Anual em destaque; "Ver outros períodos" acrescenta Trimestral e Semestral. */
export function SeletorDePeriodo({ periodo, onMudar }: { periodo: Periodo; onMudar: (periodo: Periodo) => void }) {
  const [abrir, setAbertos] = useState(false);
  const abertos = abrir || OUTROS.includes(periodo);
  const opcoes: Periodo[] = abertos ? ["mensal", "trimestral", "semestral", "anual"] : ["mensal", "anual"];
  return (
    <div className="ass-periodos">
      <div className="pills segmentado" role="group" aria-label="Período da cobrança">
        {opcoes.map((opcao) => (
          <button key={opcao} type="button" className="pill" aria-pressed={opcao === periodo} onClick={() => onMudar(opcao)}>
            {NOMES[opcao]}
          </button>
        ))}
      </div>
      {!abertos && (
        <button type="button" className="btn btn-ghost" onClick={() => setAbertos(true)}>
          Ver outros períodos
        </button>
      )}
    </div>
  );
}
