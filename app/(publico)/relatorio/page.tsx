import type { Metadata } from "next";
import { Visualizador } from "./visualizador";

// sem robôs e sem cache: o relatório de um cliente não vai para buscador (o backend manda o mesmo nos cabeçalhos)
export const metadata: Metadata = { title: "Relatório do fechamento · Ledgr", robots: { index: false, follow: false } };

export default function RelatorioPublicoPage() {
  return <Visualizador />;
}
