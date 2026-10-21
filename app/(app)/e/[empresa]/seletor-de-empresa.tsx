"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { useEmpresaAtiva, useEmpresasDaConta, type EmpresaDaConta } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import { useRoteador } from "@/lib/roteador";
import { destinoDaTroca } from "@/lib/rotas";
import { formatarCnpj } from "../../../(auth)/cadastro/passos";

/** Até este número de empresas a lista cabe à vista; acima, ganha um campo de busca. */
const LIMITE_SEM_BUSCA = 8;

/** "Padaria Ltda" → "PL": as iniciais das duas primeiras palavras, para o menu recolhido. */
function iniciais(razaoSocial: string): string {
  return razaoSocial
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palavra) => palavra[0])
    .join("")
    .toUpperCase();
}

function combina(empresa: EmpresaDaConta, termo: string): boolean {
  const procurado = termo.trim().toLowerCase();
  if (!procurado) return true;
  const digitos = procurado.replace(/\D/g, "");
  return (
    empresa.razaoSocial.toLowerCase().includes(procurado) ||
    formatarCnpj(empresa.cnpj).includes(procurado) ||
    (digitos !== "" && empresa.cnpj.replace(/\D/g, "").includes(digitos))
  );
}

/**
 * O seletor de empresa (spec 2026-10-21-empresa-ativa-na-url), no topo da barra lateral: mostra a empresa
 * da aba e abre a lista das empresas da conta. Trocar leva à mesma tela da outra empresa (de uma tela com
 * id, à raiz da seção) e lembra a escolha no cookie que só serve de destino das URLs sem empresa. Some
 * com uma empresa só.
 */
export function SeletorDeEmpresa() {
  const ativa = useEmpresaAtiva();
  const empresas = useEmpresasDaConta();
  const roteador = useRoteador();
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const idDaLista = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const comBusca = empresas.length > LIMITE_SEM_BUSCA;
  const visiveis = useMemo(() => empresas.filter((empresa) => combina(empresa, busca)), [empresas, busca]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  // a lista abre com o foco na busca, se há, ou na empresa ativa: as setas andam daí
  useEffect(() => {
    if (!aberto) return;
    const alvo = campoBusca.current ?? lista.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    alvo?.focus();
  }, [aberto]);

  if (!ativa || empresas.length < 2) return null;

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    setBusca("");
    if (devolverFoco) botao.current?.focus();
  }

  function escolher(empresa: EmpresaDaConta) {
    fechar(true);
    if (empresa.id === ativa?.id) return;
    gravarEmpresaRecente(empresa.id);
    roteador.push(destinoDaTroca(caminho, empresa.id));
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape" && aberto) {
      evento.preventDefault();
      fechar(true);
      return;
    }
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp" && evento.key !== "Home" && evento.key !== "End") return;
    // Home e End no campo de busca editam o texto; só nas opções andam pela lista
    if ((evento.key === "Home" || evento.key === "End") && evento.target === campoBusca.current) return;
    const opcoes = [...(lista.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    if (opcoes.length === 0) return;
    evento.preventDefault();
    const indice = opcoes.indexOf(document.activeElement as HTMLElement);
    const proximo =
      evento.key === "Home"
        ? 0
        : evento.key === "End"
          ? opcoes.length - 1
          : evento.key === "ArrowDown"
            ? Math.min(indice + 1, opcoes.length - 1)
            : Math.max(indice - 1, 0);
    opcoes[proximo].focus();
  }

  return (
    <div
      className="seletor-empresa"
      ref={caixa}
      onKeyDown={aoTeclar}
      // o foco que sai do seletor (Tab) fecha a lista; clicar numa opção não conta, o foco segue dentro
      onBlur={(evento) => {
        if (aberto && !caixa.current?.contains(evento.relatedTarget as Node | null)) fechar(false);
      }}
    >
      <button
        ref={botao}
        type="button"
        className="seletor-empresa-botao app-dica"
        data-dica={ativa.razaoSocial}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? idDaLista : undefined}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
      >
        <span className="seletor-empresa-iniciais" aria-hidden="true">
          {iniciais(ativa.razaoSocial)}
        </span>
        <span className="app-rotulo seletor-empresa-texto">
          <span className="seletor-empresa-nome">{ativa.razaoSocial}</span>
          {ativa.cnpj && <span className="seletor-empresa-cnpj">{formatarCnpj(ativa.cnpj)}</span>}
        </span>
        <ChevronsUpDown size={16} aria-hidden="true" className="app-rotulo seletor-empresa-seta" />
      </button>
      {aberto && (
        <div className="app-painel seletor-empresa-painel">
          {comBusca && (
            <input
              ref={campoBusca}
              type="search"
              className="input seletor-empresa-busca"
              aria-label="Buscar empresa"
              placeholder="Buscar empresa"
              autoComplete="off"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          )}
          <ul id={idDaLista} ref={lista} role="listbox" aria-label="Empresas" className="seletor-empresa-lista">
            {visiveis.map((empresa) => (
              <li key={empresa.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={empresa.id === ativa.id}
                  className="seletor-empresa-opcao"
                  onClick={() => escolher(empresa)}
                >
                  <span className="seletor-empresa-nome">{empresa.razaoSocial}</span>
                  {empresa.cnpj && <span className="seletor-empresa-cnpj">{formatarCnpj(empresa.cnpj)}</span>}
                </button>
              </li>
            ))}
          </ul>
          {visiveis.length === 0 && <p className="seletor-empresa-vazio">Nenhuma empresa encontrada.</p>}
        </div>
      )}
    </div>
  );
}
