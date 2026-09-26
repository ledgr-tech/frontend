"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Divergencia } from "@/lib/adaptadores";
import { caminhoDoCsv } from "@/lib/caminhos";

const FALHA = "Não foi possível gerar o CSV agora. Tente de novo em instantes.";

/**
 * "Setembro/2026" → "ledgr-conciliacao-setembro-2026.csv". O backend chama o
 * arquivo pelo começo do id do extrato, que não diz nada a quem abre a pasta de
 * downloads; a competência diz. Com uma categoria escolhida, ela entra no fim,
 * para o recorte não sobrescrever o arquivo inteiro na mesma pasta.
 */
export function nomeDoArquivo(mes: string, status?: Divergencia): string {
  const categoria = status ? `-${status.replaceAll("_", "-")}` : "";
  // sem ano, o `mes` é o "Conciliação" de quando nenhuma linha tem data
  if (!/\d{4}/.test(mes)) return `ledgr-conciliacao${categoria}.csv`;
  const competencia = mes
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `ledgr-conciliacao-${competencia}${categoria}.csv`;
}

export function salvar(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // depois do clique: revogar no mesmo tique cancela o download em alguns navegadores
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Baixa o relatório da conciliação em CSV (padrão Excel BR, montado pelo
 * backend). Busca com fetch em vez de um link direto para poder mostrar o erro
 * na própria tela, sem trocar de página. O arquivo chega como Blob, com os
 * bytes que o backend mandou — o BOM do começo incluído.
 *
 * Uma categoria do relatório (`status`) vai para o backend, que filtra o
 * arquivo. O "Só revisão" junta cinco e o backend filtra por um status só: com
 * ele ligado (`filtrada`), o arquivo traz todas as linhas, e o botão diz isso.
 */
export function ExportarCsv({
  extratoBancoId,
  extratoSistemaId,
  mes,
  filtrada,
  status,
}: {
  extratoBancoId: string;
  extratoSistemaId?: string;
  mes: string;
  filtrada: boolean;
  status?: Divergencia;
}) {
  const router = useRouter();
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar() {
    setExportando(true);
    setErro(null);
    try {
      const resposta = await fetch(caminhoDoCsv(extratoBancoId, extratoSistemaId, status));
      if (resposta.status === 401) {
        router.push("/login");
        return;
      }
      if (!resposta.ok) {
        const corpo: { erro?: unknown } | null = await resposta.json().catch(() => null);
        setErro(typeof corpo?.erro === "string" ? corpo.erro : FALHA);
        return;
      }
      salvar(await resposta.blob(), nomeDoArquivo(mes, status));
    } catch {
      setErro(FALHA);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="exportar-csv">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void exportar()}
        disabled={exportando}
        aria-busy={exportando}
      >
        {exportando ? "Exportando…" : filtrada ? "Exportar CSV (todas as linhas)" : "Exportar CSV"}
      </button>
      {erro && (
        <p role="alert" className="exportar-csv-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
