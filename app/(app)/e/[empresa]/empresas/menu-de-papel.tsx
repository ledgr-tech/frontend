"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { ROTULO_DO_PAPEL, type Papel } from "@/lib/papel";

/** O que cada papel permite, o mesmo texto do cartão do convite e do menu de papel. */
export const DESCRICAO_DO_PAPEL: Partial<Record<Papel, string>> = {
  gestor: "Cadastra empresas, convida analistas, fecha o mês e aprova justificativas.",
  analista: "Concilia e justifica divergências. Não fecha o mês nem convida.",
};

/**
 * O papel de uma pessoa da Equipe como botão com menu, só para o administrador (spec 2026-10-23): escolher
 * Gestor ou Analista troca na hora; "Tornar administrador…" abre a confirmação da transferência. Um menu
 * por vez (quem o controla é o painel), fecha com Esc (devolvendo o foco ao botão) e com um clique fora; as
 * setas andam pelos itens e o foco entra no papel atual.
 */
export function MenuDePapel({
  nome,
  papel,
  aberto,
  aoAlternar,
  salvando,
  desabilitado,
  aoEscolher,
  aoTransferir,
}: {
  nome: string;
  papel: Papel;
  aberto: boolean;
  aoAlternar: (aberto: boolean) => void;
  /** A troca desta pessoa está a caminho: o botão mostra "Salvando…". */
  salvando: boolean;
  /** Outra ação da equipe está em curso. */
  desabilitado: boolean;
  aoEscolher: (papel: "gestor" | "analista") => void;
  aoTransferir: () => void;
}) {
  const envelope = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!envelope.current?.contains(evento.target as Node)) aoAlternar(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto, aoAlternar]);

  // ao abrir, o foco vai ao papel atual: as setas andam daí
  useEffect(() => {
    if (aberto) envelope.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [aberto]);

  function aoTeclar(evento: KeyboardEvent<HTMLElement>) {
    if (!aberto) return;
    if (evento.key === "Escape") {
      evento.preventDefault();
      aoAlternar(false);
      botao.current?.focus();
      return;
    }
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    const itens = [...(envelope.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    if (itens.length === 0) return;
    evento.preventDefault();
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const passo = evento.key === "ArrowDown" ? 1 : -1;
    itens[(atual + passo + itens.length) % itens.length].focus();
  }

  return (
    <span className="equipe-papel-envelope" ref={envelope} onKeyDown={aoTeclar}>
      <button
        ref={botao}
        type="button"
        className="equipe-papel equipe-papel-botao"
        aria-label={`Papel de ${nome}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menuId : undefined}
        disabled={desabilitado || salvando}
        onClick={() => aoAlternar(!aberto)}
      >
        {salvando ? "Salvando…" : ROTULO_DO_PAPEL[papel]}
        {!salvando && <ChevronDown size={14} aria-hidden="true" />}
      </button>
      {aberto && (
        <div id={menuId} role="menu" aria-label={`Papel de ${nome}`} className="equipe-menu">
          {(["gestor", "analista"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              role="menuitemradio"
              aria-checked={papel === opcao}
              className="equipe-menu-item"
              onClick={() => aoEscolher(opcao)}
            >
              <b>{ROTULO_DO_PAPEL[opcao]}</b>
              <span>{DESCRICAO_DO_PAPEL[opcao]}</span>
            </button>
          ))}
          <hr className="equipe-menu-filete" />
          <button type="button" role="menuitem" className="equipe-menu-item" onClick={aoTransferir}>
            <b>Tornar administrador…</b>
            <span>Passa a administração da conta para {nome}. Você vira Gestor.</span>
          </button>
        </div>
      )}
    </span>
  );
}
