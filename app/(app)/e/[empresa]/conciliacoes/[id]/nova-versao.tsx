"use client";

import { Upload } from "lucide-react";
import { caminhoDoReenvio } from "@/lib/caminhos";
import { useRoteador } from "@/lib/roteador";

/**
 * O botão da nova versão do extrato do sistema: a pessoa corrigiu o sistema de gestão e concilia de novo com
 * o mesmo extrato do banco, a rodada seguinte da conciliação (spec 2026-10-02-conciliacao-em-rodadas). O envio
 * é a tela da Nova conciliação em modo reenvio, que pede os dois ids; sem o do extrato do sistema atual não há
 * de onde partir, e o botão não aparece.
 */
export function NovaVersao({
  extratoBancoId,
  extratoSistemaId,
}: {
  extratoBancoId: string;
  extratoSistemaId?: string;
}) {
  const router = useRoteador();
  if (!extratoSistemaId) return null;
  return (
    // a ação que fecha o ciclo da conciliação: em destaque, com o texto curto; o nome inteiro fica para o leitor de tela
    <button
      type="button"
      className="btn btn-primary nova-versao-botao"
      aria-label="Enviar nova versão do extrato do sistema"
      onClick={() => router.push(caminhoDoReenvio(extratoBancoId, extratoSistemaId))}
    >
      <Upload size={17} aria-hidden="true" />
      Enviar nova versão
    </button>
  );
}
