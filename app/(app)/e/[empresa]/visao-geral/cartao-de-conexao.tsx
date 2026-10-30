"use client";

import Image from "next/image";
import { useState } from "react";
import { abrirConfiguracoes } from "@/lib/eventos";
import { formatarDataHora } from "../dashboard/resumo";
import type { ConexaoMcp } from "../conexoes-mcp/acoes";

/**
 * O destaque da conexão com o ChatGPT e o Claude na Visão geral (modelo D do canvas de 29/10): o que
 * ficava escondido em Configurações › Conexões. Quem monta só o mostra quando `GET /conexoes-mcp`
 * responde, ou seja, para o admin e o gestor e com `MCP_HABILITADO` ligado no backend.
 */
export function CartaoDeConexao({ itens, endereco }: { itens: ConexaoMcp[]; endereco: string | null }) {
  const ativas = itens.filter((conexao) => conexao.revogadaEm === null);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
    } catch {
      // sem permissão da área de transferência, o endereço continua à vista para copiar à mão
    }
  }

  const clientes = [...new Set(ativas.map((conexao) => conexao.cliente))];
  const ultimoUso = ativas
    .map((conexao) => conexao.ultimoUsoEm)
    .filter((uso): uso is string => uso !== null)
    .sort()
    .at(-1);

  return (
    <section className="vg-bloco vg-conexao" aria-labelledby="vg-conexao-titulo">
      <span className="vg-conexao-rotulo">Conexões</span>
      {ativas.length === 0 ? (
        <>
          <h2 id="vg-conexao-titulo" className="vg-conexao-titulo">
            Pergunte sobre o mês no ChatGPT ou no Claude.
          </h2>
          <p className="vg-conexao-texto">
            Conecte uma vez e pergunte em português, como “Como está outubro?”. A conexão só lê os números: nunca
            altera nada.
          </p>
          {/* o passo a passo mora em Configurações › Conexões; aqui, o caminho até ele e o atalho de quem já sabe */}
          <div className="vg-conexao-acoes">
            <button type="button" className="vg-conexao-botao" onClick={() => abrirConfiguracoes("conexoes")}>
              Ver como conectar
            </button>
            {endereco && (
              <button type="button" className="vg-conexao-botao vg-conexao-botao-contorno" onClick={copiar}>
                {copiado ? "Endereço copiado" : "Copiar endereço do conector"}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <h2 id="vg-conexao-titulo" className="vg-conexao-titulo">
            {`Conectado ao ${clientes.join(" e ")}.`}
          </h2>
          <p className="vg-conexao-texto">
            {ultimoUso ? `Última consulta em ${formatarDataHora(ultimoUso)}.` : "Nenhuma consulta ainda."} Pergunte
            sobre o mês por lá, com os números do Ledgr.
          </p>
          <div className="vg-conexao-acoes">
            <button type="button" className="vg-conexao-botao vg-conexao-botao-contorno" onClick={() => abrirConfiguracoes("conexoes")}>
              Ver conexões
            </button>
          </div>
        </>
      )}
      <Image
        src="/mascotes/mascote-conexao.webp"
        alt=""
        width={1966}
        height={794}
        sizes="480px"
        className="vg-conexao-mascote"
        aria-hidden="true"
      />
    </section>
  );
}
