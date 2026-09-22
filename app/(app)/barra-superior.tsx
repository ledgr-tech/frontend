"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AVISOS,
  formatarMoeda,
  listarConciliacoes,
  type LinhaComparacao,
} from "@/lib/mock-data";

type Achado = {
  conciliacaoId: string;
  linha: LinhaComparacao;
};

/** O que a busca varre em cada lançamento: descrição, data e os dois valores. */
function combina(linha: LinhaComparacao, termo: string): boolean {
  const campos = [
    linha.descricao,
    linha.data,
    linha.valorBanco === null ? "" : formatarMoeda(linha.valorBanco),
    linha.valorSistema === null ? "" : formatarMoeda(linha.valorSistema),
  ];
  return campos.some((campo) => campo.toLowerCase().includes(termo));
}

export function BarraSuperior({
  email,
  avisoNaoLido,
  onMarcarAvisosLidos,
  onSair,
}: {
  email: string;
  avisoNaoLido: boolean;
  onMarcarAvisosLidos: () => void;
  onSair: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [lancamentos, setLancamentos] = useState<Achado[]>([]);
  const buscaRef = useRef<HTMLInputElement>(null);
  const caixaBusca = useRef<HTMLDivElement>(null);
  const caixaAvisos = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLancamentos(
      listarConciliacoes().flatMap((conciliacao) =>
        conciliacao.linhas.map((linha) => ({ conciliacaoId: conciliacao.id, linha })),
      ),
    );
  }, []);

  // ⌘K / Ctrl+K põe o foco na busca, como o atalho que a caixa anuncia.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() === "k" && (evento.metaKey || evento.ctrlKey)) {
        evento.preventDefault();
        buscaRef.current?.focus();
      }
      if (evento.key === "Escape") {
        setBuscaAberta(false);
        setAvisosAbertos(false);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!caixaBusca.current?.contains(alvo)) setBuscaAberta(false);
      if (!caixaAvisos.current?.contains(alvo)) setAvisosAbertos(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const achados = useMemo(() => {
    const limpo = termo.trim().toLowerCase();
    if (limpo === "") return [];
    return lancamentos.filter(({ linha }) => combina(linha, limpo)).slice(0, 8);
  }, [termo, lancamentos]);

  // "financeiro@telhacerta.com.br" → "Financeiro" e "FI"
  const apelido = email.split("@")[0] ?? "";
  const nome = apelido.charAt(0).toUpperCase() + apelido.slice(1);
  const iniciais = apelido.slice(0, 2).toUpperCase();

  const naoLidos = avisoNaoLido ? AVISOS.length : 0;

  return (
    <div className="app-topo">
      <div className="app-busca-envelope" ref={caixaBusca}>
        <div className="app-busca">
          <span aria-hidden="true" className="app-busca-lupa">
            ⌕
          </span>
          <input
            ref={buscaRef}
            type="search"
            className="input app-busca-campo"
            aria-label="Buscar lançamento"
            placeholder="Buscar valor, fornecedor ou data…"
            value={termo}
            onChange={(evento) => {
              setTermo(evento.target.value);
              setBuscaAberta(true);
            }}
            onFocus={() => setBuscaAberta(true)}
          />
          <span aria-hidden="true" className="app-busca-atalho">
            ⌘K
          </span>
        </div>

        {buscaAberta && termo.trim() !== "" && (
          <div className="app-painel app-busca-painel">
            {achados.length === 0 ? (
              <p className="app-busca-vazio">
                Nada encontrado. Tente o valor sem centavos ou parte do nome do fornecedor.
              </p>
            ) : (
              achados.map(({ conciliacaoId, linha }) => (
                <Link
                  key={`${conciliacaoId}-${linha.id}`}
                  href={`/conciliacoes/${conciliacaoId}/${linha.id}`}
                  className="app-busca-achado"
                  onClick={() => setBuscaAberta(false)}
                >
                  <span className="app-busca-achado-titulo">{linha.descricao}</span>
                  <span className="app-busca-achado-detalhe">
                    {linha.data} ·{" "}
                    {formatarMoeda(linha.valorBanco ?? linha.valorSistema ?? 0)}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ position: "relative", flex: "none" }} ref={caixaAvisos}>
        <button
          type="button"
          className="app-avisos-botao"
          aria-expanded={avisosAbertos}
          onClick={() => setAvisosAbertos((aberto) => !aberto)}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>Avisos</span>
          <span className={naoLidos > 0 ? "app-avisos-conta app-avisos-conta-ativa" : "app-avisos-conta"}>
            {naoLidos}
          </span>
        </button>

        {avisosAbertos && (
          <div className="app-painel app-avisos-painel">
            <div className="app-avisos-topo">
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 600 }}>
                Avisos
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 12.5 }}
                onClick={onMarcarAvisosLidos}
              >
                Marcar como lidos
              </button>
            </div>
            {AVISOS.map((aviso) => {
              const corpo = (
                <>
                  <span className={`app-aviso-ponto app-aviso-ponto-${aviso.tom}`} aria-hidden="true" />
                  <span className="app-aviso-corpo">
                    <span className="app-aviso-titulo">{aviso.titulo}</span>
                    <span className="app-aviso-texto">{aviso.texto}</span>
                    <span className="app-aviso-quando">{aviso.quando}</span>
                  </span>
                </>
              );
              // ponytail: dois dos três avisos do design levam a telas que ainda não
              // existem (folha a folha e fechamento). Sem destino, não vira link.
              return aviso.href === null ? (
                <div key={aviso.id} className="app-aviso">
                  {corpo}
                </div>
              ) : (
                <Link
                  key={aviso.id}
                  href={aviso.href}
                  className="app-aviso app-aviso-link"
                  onClick={() => setAvisosAbertos(false)}
                >
                  {corpo}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="app-usuario">
        <span className="app-usuario-iniciais" aria-hidden="true">
          {iniciais}
        </span>
        <span style={{ fontSize: 14 }}>{nome}</span>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13.5 }} onClick={onSair}>
          Sair
        </button>
      </div>
    </div>
  );
}
