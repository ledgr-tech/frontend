"use client";

import { useState, type DragEvent } from "react";
import { Check } from "lucide-react";
import { IconeOrigem } from "../icone-origem";
import type { Origem } from "./envio";

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Uma área de soltar em forma de folha: a folha é o rótulo de um input de arquivo invisível, então
 * clicar em qualquer lugar dela abre a escolha, e "Trocar arquivo" é só o aviso de que dá para
 * escolher de novo. O que é solto em cima não passa pelo accept do input: a extensão é conferida aqui.
 */
export function FolhaDeExtrato({
  origem,
  titulo,
  dica,
  accept,
  formatos,
  arquivo,
  onArquivo,
  onRecusado,
}: {
  origem: Origem;
  titulo: string;
  dica: string;
  accept: string;
  /** Como o accept aparece no recado de arquivo recusado ("OFX ou CSV"). */
  formatos: string;
  arquivo: File | null;
  onArquivo: (arquivo: File) => void;
  onRecusado: (recado: string) => void;
}) {
  const [arrastando, setArrastando] = useState(false);

  function aoSoltar(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setArrastando(false);
    const solto = event.dataTransfer.files[0];
    if (!solto) return;
    const nome = solto.name.toLowerCase();
    if (!accept.split(",").some((extensao) => nome.endsWith(extensao))) {
      onRecusado(`O ${titulo.toLowerCase()} precisa ser um arquivo ${formatos}.`);
      return;
    }
    onArquivo(solto);
  }

  return (
    <label
      className={`nova-folha nova-folha-${origem}`}
      data-pronto={arquivo ? "" : undefined}
      data-arrastando={arrastando ? "" : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(event) => {
        // sair da folha para um filho dela também dispara o dragleave
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setArrastando(false);
      }}
      onDrop={aoSoltar}
    >
      <span className="rotulo nova-folha-rotulo">
        {/* o ícone de cada lado vira ✓ quando o arquivo entra */}
        <span className="nova-folha-icone">{arquivo ? <Check aria-hidden="true" /> : <IconeOrigem origem={origem} />}</span>
        {origem === "banco" ? "Banco" : "Sistema de gestão"}
      </span>
      <strong className="nova-folha-titulo">{arquivo ? arquivo.name : titulo}</strong>
      {arquivo ? (
        <span className="nova-folha-dica">
          <span>{tamanho(arquivo.size)}</span> · <span className="nova-folha-trocar">Trocar arquivo</span>
        </span>
      ) : (
        <span className="nova-folha-dica">
          <span>{dica}</span>. Solte aqui ou clique para escolher.
        </span>
      )}
      {arquivo && origem === "banco" && (
        <span className="conc-folha-linhas" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <input
        aria-label={titulo}
        className="nova-folha-input"
        type="file"
        accept={accept}
        onChange={(event) => {
          // cancelar a janela de escolha não apaga o arquivo que já estava
          const escolhido = event.target.files?.[0];
          if (escolhido) onArquivo(escolhido);
        }}
      />
    </label>
  );
}
