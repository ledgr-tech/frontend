"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Relatorio } from "@/app/(app)/conciliacoes/[id]/relatorio";
import { agruparPorMes } from "@/app/(app)/fechamentos/fechamento";
import { Painel } from "@/app/(app)/fechamentos/mesa";
import { Reveal } from "@/app/reveal";
import type { Divergencia } from "@/lib/adaptadores";
import type { LinhaComparacao } from "@/lib/mock-data";

/**
 * "Por dentro do Ledgr": três telas do app em miniatura, montadas com os
 * próprios componentes dele e um mês de exemplo, o mesmo agosto do topo da
 * página (4.218 lançamentos, 157 para revisar). Não são capturas de tela: se a
 * tela do app mudar, a miniatura muda junto. São vitrine (`inert`): nada se
 * clica, nada leva para dentro do app.
 */

// As 157 linhas de agosto que pedem revisão, por categoria.
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

// O mesmo mês pela conta do app (`agruparPorMes`): 4.218 − 157 = 4.061 conciliados.
const [AGOSTO] = agruparPorMes([
  {
    execucao: {
      id: "exemplo-agosto",
      extratoBancoId: "00000000-0000-4000-8000-000000000001",
      extratoSistemaId: "00000000-0000-4000-8000-000000000002",
      arquivoBanco: "extrato-08.ofx",
      arquivoSistema: "razao-08.csv",
      executadaEm: "2026-09-02T12:40:00Z",
      lancamentos: 4218,
      acerto: 96.3,
      divergencias: PENDENTES,
      toleranciaDias: 0,
      atual: true,
    },
    primeiraData: "2026-08-01",
    naoLidas: [],
  },
]);

// O que a tela da linha mostra hoje para um valor que diverge: com a IA
// desligada, é o motivo fixo do motor (`_MOTIVOS_DETERMINISTICOS` em
// app/services/ia/prompt.py, no backend), sem o selo de IA.
const MOTIVO_VALOR = "Existe um lançamento do outro lado na mesma data, mas o valor não coincide com o deste item.";

function Explicacao() {
  return (
    <div className="por-dentro-explicacao">
      <div>
        <div className="det-kicker">Valor diverge na mesma data</div>
        <h3 className="por-dentro-linha">Pagamento fornecedor #1082</h3>
      </div>
      <div className="por-dentro-par">
        <span>
          <span className="por-dentro-rotulo">Extrato do banco</span>
          <span className="por-dentro-valor">R$ 12.640,00</span>
        </span>
        <span className="det-delta-valor">Δ 36,00</span>
        <span>
          <span className="por-dentro-rotulo">Extrato do sistema</span>
          <span className="por-dentro-valor">R$ 12.604,00</span>
        </span>
      </div>
      <div className="det-causa">
        <Image
          src="/mascotes/mascote-explicando.png"
          alt=""
          width={1000}
          height={1000}
          sizes="80px"
          style={{ width: 80, height: "auto", flex: "none" }}
        />
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <h6 style={{ margin: "0 0 8px" }}>O que provavelmente aconteceu</h6>
          <p className="det-causa-texto">{MOTIVO_VALOR}</p>
        </div>
      </div>
    </div>
  );
}

function Tela({ legenda, texto, atraso, children }: { legenda: string; texto: string; atraso: number; children: ReactNode }) {
  return (
    <Reveal once delay={atraso}>
      <figure className="por-dentro-item">
        {/* vitrine: fora do foco, do clique e do leitor de tela; quem descreve é a legenda */}
        <div className="por-dentro-tela" inert>
          {children}
        </div>
        <figcaption className="por-dentro-legenda">
          <strong>{legenda}</strong> {texto}
        </figcaption>
      </figure>
    </Reveal>
  );
}

export function PorDentro() {
  return (
    <div className="por-dentro-grade">
      <Tela
        atraso={0}
        legenda="Divergências por categoria."
        texto="As cinco categorias, com o que cada uma deixa em aberto. Um clique mostra só as linhas dela."
      >
        <Relatorio linhas={LINHAS} ativa={null} onEscolher={() => {}} />
      </Tela>
      <Tela
        atraso={0.08}
        legenda="O que provavelmente aconteceu."
        texto="Cada divergência vem com o motivo. Quem decide o que corrigir é você."
      >
        <Explicacao />
      </Tela>
      <Tela
        atraso={0.16}
        legenda="O mês em Fechamentos."
        texto="O que ainda segura o fechamento, e o relatório em CSV para o contador."
      >
        <Painel mes={AGOSTO} />
      </Tela>
    </div>
  );
}
