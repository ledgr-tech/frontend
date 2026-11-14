"use client";

import { Analytics } from "@vercel/analytics/next";
import { enderecoAnonimo } from "@/lib/endereco-anonimo";

/** O Web Analytics da Vercel, sem UUID nem token no endereço (S1-21). Cliente porque `beforeSend` é função. */
export function Visitas() {
  return (
    <Analytics
      beforeSend={(evento) => {
        const url = enderecoAnonimo(evento.url);
        return url ? { ...evento, url } : null;
      }}
    />
  );
}
