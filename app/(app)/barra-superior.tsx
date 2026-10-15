"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { useTeclaDeAtalho } from "@/lib/plataforma";
import { formatarMoeda, type LinhaComparacao } from "@/lib/mock-data";
import { avisosDoMes, idsLidos, marcarLidos } from "./avisos";
import { carregarVisaoGeral, type VisaoGeral } from "./conciliacoes/acoes";

type Achado = {
  href: string;
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

type Leitura = { situacao: "lendo" } | { situacao: "falhou" } | { situacao: "pronta"; visao: VisaoGeral };

// O tema e a conta (nome, empresa e Sair) moram no rodapé do menu lateral.
export function BarraSuperior() {
  const [termo, setTermo] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [leitura, setLeitura] = useState<Leitura>({ situacao: "lendo" });
  const [lidos, setLidos] = useState<string[]>([]);
  const tecla = useTeclaDeAtalho();
  // qual resultado a seta está apontando; -1 = nenhum
  const [ativo, setAtivo] = useState(-1);
  const router = useRouter();
  const buscaRef = useRef<HTMLInputElement>(null);
  const caixaBusca = useRef<HTMLDivElement>(null);
  const caixaAvisos = useRef<HTMLDivElement>(null);

  // A busca e os avisos leem a conciliação mais recente, a mesma da visão geral.
  // ponytail: uma leitura por carga da página — a barra vive no layout e não
  // remonta ao trocar de tela, então uma conciliação nova só aparece aqui ao
  // recarregar. Buscar em todas pede uma rota de busca no backend.
  useEffect(() => {
    let vivo = true;
    carregarVisaoGeral()
      .then((resposta) => {
        if (!vivo) return;
        setLidos(idsLidos());
        setLeitura(resposta.ok ? { situacao: "pronta", visao: resposta.dados } : { situacao: "falhou" });
      })
      .catch(() => vivo && setLeitura({ situacao: "falhou" }));
    return () => {
      vivo = false;
    };
  }, []);

  const visao = leitura.situacao === "pronta" ? leitura.visao : null;
  const avisos = useMemo(() => (visao ? avisosDoMes(visao) : []), [visao]);
  const lancamentos = useMemo<Achado[]>(() => {
    const conciliacao = visao?.recente?.conciliacao;
    if (!conciliacao) return [];
    return conciliacao.linhas.map((linha) => ({
      linha,
      href: caminhoDaConciliacao(conciliacao.id, conciliacao.extratoSistemaId, linha.id),
    }));
  }, [visao]);

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

  const naoLidos = avisos.filter((aviso) => !lidos.includes(aviso.id)).length;

  function lerTodos() {
    const ids = avisos.map((aviso) => aviso.id);
    marcarLidos(ids);
    setLidos(ids);
  }

  const painelAberto = buscaAberta && termo.trim() !== "";

  function aoTeclarNaBusca(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (!painelAberto || achados.length === 0) return;
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAtivo((i) => (i + 1) % achados.length);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAtivo((i) => (i <= 0 ? achados.length - 1 : i - 1));
    } else if (evento.key === "Enter" && ativo >= 0) {
      evento.preventDefault();
      const alvo = achados[ativo];
      setBuscaAberta(false);
      router.push(alvo.href);
    }
  }

  return (
    <div className="app-topo">
      <div className="app-busca-envelope" ref={caixaBusca}>
        <div className="app-busca">
          <span aria-hidden="true" className="app-busca-lupa">
            ⌕
          </span>
          <input
            ref={buscaRef}
            type="text"
            role="combobox"
            className="input app-busca-campo"
            aria-label="Buscar lançamento"
            aria-expanded={painelAberto}
            aria-controls="busca-resultados"
            aria-autocomplete="list"
            aria-activedescendant={
              painelAberto && ativo >= 0 ? `busca-opcao-${ativo}` : undefined
            }
            onKeyDown={aoTeclarNaBusca}
            placeholder="Buscar valor, fornecedor ou data…"
            value={termo}
            onChange={(evento) => {
              setTermo(evento.target.value);
              setBuscaAberta(true);
              setAtivo(-1);
            }}
            onFocus={() => setBuscaAberta(true)}
          />
          <span aria-hidden="true" className="app-busca-atalho">
            {tecla === "⌘" ? "⌘K" : "Ctrl K"}
          </span>
        </div>

        {painelAberto && (
          <div className="app-painel app-busca-painel">
            {achados.length === 0 ? (
              <p className="app-busca-vazio" role="status">
                {visao && !visao.recente
                  ? "Ainda não há conciliação para buscar."
                  : "Nada encontrado na conciliação mais recente. Tente o valor sem centavos ou parte do nome do fornecedor."}
              </p>
            ) : null}
            <div id="busca-resultados" role="listbox" aria-label="Resultados da busca">
              {achados.map(({ href, linha }, i) => (
                <Link
                  key={linha.id}
                  id={`busca-opcao-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  data-ativo={i === ativo ? "true" : undefined}
                  href={href}
                  className="app-busca-achado"
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => setBuscaAberta(false)}
                >
                  <span className="app-busca-achado-titulo">{linha.descricao}</span>
                  <span className="app-busca-achado-detalhe">
                    {linha.data} ·{" "}
                    {formatarMoeda(linha.valorBanco ?? linha.valorSistema ?? 0)}
                  </span>
                </Link>
              ))}
            </div>
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
          <span style={{ fontSize: 15 }}>Avisos</span>
          {/* a conta só depois da leitura: um zero antes dela seria chute */}
          {visao && (
            <span className={naoLidos > 0 ? "app-avisos-conta app-avisos-conta-ativa" : "app-avisos-conta"}>
              {naoLidos}
            </span>
          )}
        </button>

        {avisosAbertos && (
          <div className="app-painel app-avisos-painel">
            <div className="app-avisos-topo">
              <span style={{ fontSize: 17, fontWeight: 600 }}>
                Avisos
              </span>
              {naoLidos > 0 && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={lerTodos}>
                  Marcar como lidos
                </button>
              )}
            </div>
            {leitura.situacao === "lendo" && <p className="app-avisos-vazio">Lendo a última conciliação…</p>}
            {leitura.situacao === "falhou" && (
              <p className="app-avisos-vazio" role="alert">
                Não foi possível ler os avisos agora.
              </p>
            )}
            {visao && avisos.length === 0 && <p className="app-avisos-vazio">Nenhum aviso agora.</p>}
            {avisos.map((aviso) => (
              <Link
                key={aviso.id}
                href={aviso.href}
                className="app-aviso app-aviso-link"
                data-lido={lidos.includes(aviso.id) ? "true" : undefined}
                onClick={() => setAvisosAbertos(false)}
              >
                <span className={`app-aviso-ponto app-aviso-ponto-${aviso.tom}`} aria-hidden="true" />
                <span className="app-aviso-corpo">
                  <span className="app-aviso-titulo">{aviso.titulo}</span>
                  <span className="app-aviso-texto">{aviso.texto}</span>
                  <span className="app-aviso-quando">{aviso.quando}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
