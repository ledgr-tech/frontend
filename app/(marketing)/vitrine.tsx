"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeftRight,
  CalendarCheck,
  ChevronsUpDown,
  CreditCard,
  Files,
  History,
  House,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Cabecalho, EmpresaDaSessao } from "@/app/(app)/cabecalho";
import { Relatorio } from "@/app/(app)/conciliacoes/[id]/relatorio";
import { LogoBarras } from "@/app/(app)/logo-barras";
import type { Divergencia } from "@/lib/adaptadores";
import type { LinhaComparacao } from "@/lib/mock-data";
import type { LinhaExtrato } from "./comparacao";
import { TabelaFolhas } from "./tabela-folhas";

/**
 * A tela inteira do app numa janela, como o arc.net mostra o navegador: a
 * "Comparação direta" de agosto de uma empresa genérica ("Sua empresa"), com a
 * linha do fluxo de "Por dentro" em destaque e o cartão do hover do app aberto
 * sobre ela, como se o mouse estivesse ali.
 *
 * O conteúdo usa as classes e os componentes do app (Cabecalho, Relatorio, a
 * tabela em duas folhas, os selos). O menu e a barra de cima não: as regras do
 * app para celular e para o menu recolhido (que o script do <html> liga em
 * qualquer página, a partir do localStorage) reescreveriam a réplica. Por isso
 * eles têm classes próprias (`vitrine-*`), no mesmo desenho.
 *
 * É desenhada numa largura de desktop e encolhe inteira para caber, como uma
 * imagem: `zoom` na escala da janela, medida com ResizeObserver.
 */

const LARGURA = 1280;
const EMPRESA = "Sua empresa";

// ponytail: cópia dos nomes e ícones do menu (ITENS em app/(app)/menu-lateral.tsx).
// Se o menu do app mudar, esta lista muda junto.
const MENU: [string, LucideIcon][] = [
  ["Visão geral", House],
  ["Extratos", Files],
  ["Conciliações", ArrowLeftRight],
  ["Fechamentos", CalendarCheck],
  ["Histórico", History],
  ["Assinatura", CreditCard],
];
const ICONE = { size: 18, strokeWidth: 1.5, "aria-hidden": true } as const;

// As 157 linhas de agosto que pedem revisão, por categoria: o mesmo mês do topo da página.
const PENDENTES: Record<Divergencia, number> = {
  divergente_valor: 41,
  duplicado: 12,
  divergente_data: 58,
  sem_correspondencia: 39,
  tarifa_bancaria: 7,
};

/** Linhas de exemplo com valores variados, para o relatório calcular o que fica em aberto. */
function linhasDe(status: Divergencia, quantidade: number): LinhaComparacao[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const valor = 180 + ((i * 137) % 2400);
    const [banco, sistema] =
      status === "divergente_valor"
        ? [valor, valor - (12 + (i % 9) * 7)]
        : status === "divergente_data"
          ? [valor, valor]
          : status === "tarifa_bancaria"
            ? [9.9 + (i % 4) * 12.5, null]
            : [valor, null];
    return {
      id: `${status}-${i}`,
      descricao: "",
      data: "",
      valorBanco: banco,
      valorSistema: sistema,
      status,
      explicacao: null,
      historico: [],
    };
  });
}

const LINHAS = (Object.entries(PENDENTES) as [Divergencia, number][]).flatMap(([status, quantidade]) =>
  linhasDe(status, quantidade),
);

export function Vitrine({
  banco,
  sistema,
  destaque,
}: {
  banco: LinhaExtrato[];
  sistema: LinhaExtrato[];
  /** a descrição da linha que fica acesa na tabela */
  destaque: string;
}) {
  const janela = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState<number | null>(null);

  useLayoutEffect(() => {
    const elemento = janela.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const medir = (largura: number) => largura > 0 && setEscala(largura / LARGURA);
    medir(elemento.clientWidth);
    const observador = new ResizeObserver(([entrada]) => medir(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return (
    <figure className="vitrine">
      {/* vitrine: fora do foco, do clique e do leitor de tela; quem descreve é a legenda */}
      <div className="vitrine-janela" ref={janela} inert>
        <div className="vitrine-barra" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="vitrine-app" style={escala ? { zoom: escala } : undefined}>
          <div className="vitrine-menu">
            <span className="vitrine-marca">
              <LogoBarras className="app-logo" />
              Ledgr
            </span>
            <span className="vitrine-item vitrine-nova">
              <Plus {...ICONE} />
              Nova conciliação
            </span>
            <div className="vitrine-nav">
              {MENU.map(([nome, Icone]) => (
                <span key={nome} className="vitrine-item" data-ativo={nome === "Conciliações" || undefined}>
                  <Icone {...ICONE} />
                  {nome}
                </span>
              ))}
            </div>
            <div className="vitrine-assistente">
              <Image
                src="/mascotes/mascote-chatbot.png"
                alt=""
                width={1254}
                height={1254}
                sizes="36px"
                className="app-assistente-mascote"
              />
              <span className="app-assistente-texto">
                <span className="app-assistente-chamada">Assistente</span>
                <span className="app-assistente-titulo">Fale com o Ledgr</span>
                <span className="app-assistente-detalhe">Pergunte sobre o mês</span>
              </span>
            </div>
            <div className="vitrine-conta">
              <span className="app-conta-iniciais">FI</span>
              <span className="vitrine-conta-texto">
                <span className="app-conta-nome">Financeiro</span>
                <span className="app-conta-empresa">{EMPRESA}</span>
              </span>
              <ChevronsUpDown {...ICONE} size={15} className="vitrine-conta-seta" />
            </div>
          </div>

          <div className="vitrine-principal">
            <div className="vitrine-topo">
              <div className="app-busca vitrine-busca">
                <span className="app-busca-lupa">⌕</span>
                <span className="vitrine-busca-texto">Buscar valor, fornecedor ou data…</span>
                <span className="app-busca-atalho">Ctrl K</span>
              </div>
              <span className="app-avisos-botao">
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>Avisos</span>
              </span>
            </div>

            <div className="vitrine-conteudo">
              <EmpresaDaSessao value={EMPRESA}>
                <Cabecalho titulo="Comparação direta" contexto={["competência agosto/2026", "4.218 lançamentos"]} />
              </EmpresaDaSessao>
              <div className="vitrine-tela">
                <Relatorio linhas={LINHAS} ativa={null} onEscolher={() => {}} />
                <div className="tabela-ferramentas">
                  <div className="pills segmentado">
                    <button type="button" className="pill" aria-pressed="true">
                      Todos (4.218)
                    </button>
                    <button type="button" className="pill" aria-pressed="false">
                      Só revisão (157)
                    </button>
                  </div>
                </div>
                {/* a mesma tabela da demonstração de "O problema", parada, com a linha do fluxo
                    acesa e o cartão dela aberto, como se o mouse estivesse ali */}
                <TabelaFolhas banco={banco} sistema={sistema} setas destacada={destaque} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        A tela Comparação direta do Ledgr com uma conciliação de agosto. Em cima ficam as divergências por
        categoria; embaixo, o extrato do banco ao lado do sistema de gestão, com a linha “{destaque}” acesa e
        o cartão dela aberto com o motivo da diferença.
      </figcaption>
    </figure>
  );
}
