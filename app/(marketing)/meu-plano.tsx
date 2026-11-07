"use client";

import type { PlanoId } from "@/lib/assinatura";
import { ESCOLHER_PLANO } from "@/lib/medidor-de-planos";

/**
 * "Ver o meu plano", no pé de um perfil de "Para quem é": desce até a régua de Preços e a põe no
 * plano daquele perfil. Sem JS é só o link para #preco.
 */
export function MeuPlano({ plano }: { plano: PlanoId }) {
  return (
    <a
      href="#preco"
      className="meu-plano"
      onClick={(evento) => {
        const regua = document.querySelector(".regua-mede");
        if (!regua) return;
        evento.preventDefault();
        window.dispatchEvent(new CustomEvent(ESCOLHER_PLANO, { detail: plano }));
        const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        regua.scrollIntoView({ behavior: calmo ? "auto" : "smooth", block: "center" });
      }}
    >
      Ver o meu plano
    </a>
  );
}
