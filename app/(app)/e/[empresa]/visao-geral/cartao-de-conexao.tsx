"use client";

import Image from "next/image";
import { useState } from "react";
import { LOGO } from "@/app/chat-de-ia";
import { InkHover } from "@/app/reveal";
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
  const ultima = ativas
    .filter((conexao): conexao is ConexaoMcp & { ultimoUsoEm: string } => conexao.ultimoUsoEm !== null)
    .sort((a, b) => a.ultimoUsoEm.localeCompare(b.ultimoUsoEm))
    .at(-1);
  // com mais de um cliente, a data diz de qual veio
  const deQuem = ultima && clientes.length > 1 ? `, no ${ultima.cliente}` : "";

  // o traço da caneta da landing (InkHover), claro sobre a tinta do cartão
  return (
    <InkHover as="section" tone="light" className="vg-bloco vg-conexao" aria-labelledby="vg-conexao-titulo">
      <span className="vg-conexao-rotulo">Conexões</span>
      <div className="vg-conexao-selo">
        {ativas.length === 0 ? (
          <>
            <Logo src={LOGO.chatgpt} apagado />
            <Logo src={LOGO.claude} apagado />
          </>
        ) : (
          <>
            {/* um logo por marca: "Claude" e "Claude Code" são dois clientes e um logo só */}
            {[...new Set(clientes.map(logoDe))].map((src) => src && <Logo key={src} src={src} />)}
            <span className="vg-conexao-ativas">{ativas.length === 1 ? "Ativa" : `${ativas.length} ativas`}</span>
          </>
        )}
      </div>
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
            {`Conectado ${LISTA.format(clientes.map((cliente) => `ao ${cliente}`))}.`}
          </h2>
          <p className="vg-conexao-texto">
            {ultima ? `Última consulta em ${formatarDataHora(ultima.ultimoUsoEm)}${deQuem}.` : "Nenhuma consulta ainda."}{" "}
            {clientes.length > 1 ? "Pergunte sobre o mês em qualquer um." : "Pergunte sobre o mês por lá, com os números do Ledgr."}
          </p>
          <div className="vg-conexao-acoes">
            <button type="button" className="vg-conexao-botao" onClick={() => abrirConfiguracoes("conexoes")}>
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
    </InkHover>
  );
}

const LISTA = new Intl.ListFormat("pt-BR");

// ponytail: só os dois clientes que o Ledgr documenta têm logo; outro nome fica só no título
function logoDe(cliente: string): string | null {
  if (/chatgpt|openai/i.test(cliente)) return LOGO.chatgpt;
  if (/claude/i.test(cliente)) return LOGO.claude;
  return null;
}

function Logo({ src, apagado = false }: { src: string; apagado?: boolean }) {
  return (
    <Image src={src} alt="" width={40} height={40} className="vg-conexao-logo" data-apagado={apagado || undefined} aria-hidden="true" />
  );
}
