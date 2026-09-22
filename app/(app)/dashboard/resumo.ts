import type { Conciliacao, LinhaComparacao, StatusLinha, Tom } from "@/lib/mock-data";

// Rótulos e níveis de atenção vêm do design (NIVEL_STATUS em "Ledgr.dc.html").
// ponytail: o design prevê 7 status, o mock só produz estes 4. Os outros três
// (data divergente, possível duplicidade, match com tolerância) entram junto com
// a conciliação real, que é quem sabe calculá-los.
const STATUS: Record<StatusLinha, { rotulo: string; tom: Tom }> = {
  // bateu: verde, o caso resolvido
  batido: { rotulo: "Match exato", tom: "ok" },
  // os dois lados existem e o dinheiro nao confere: e o unico erro de verdade
  divergencia_valor: { rotulo: "Divergência de valor", tom: "risco" },
  // falta um dos lados: incompleto, nao errado — fica no ouro
  somente_banco: { rotulo: "Sem correspondência no sistema", tom: "atencao" },
  somente_sistema: { rotulo: "Sem correspondência no banco", tom: "atencao" },
};

export function statusDaLinha(status: StatusLinha): { rotulo: string; tom: Tom } {
  return STATUS[status];
}

/** O extrato do banco é a fonte da verdade; sem ele, cai para o valor do sistema. */
export function valorDaLinha(linha: LinhaComparacao): number {
  return linha.valorBanco ?? linha.valorSistema ?? 0;
}

export function origemDaLinha(linha: LinhaComparacao): "Banco" | "Sistema" {
  return linha.valorBanco === null ? "Sistema" : "Banco";
}

/** Quanto a linha deixa em aberto: a diferença quando os dois lados existem, o valor inteiro quando só um existe. */
function divergenciaDaLinha(linha: LinhaComparacao): number {
  if (linha.status === "batido") return 0;
  if (linha.valorBanco !== null && linha.valorSistema !== null) {
    return Math.abs(linha.valorBanco - linha.valorSistema);
  }
  return valorDaLinha(linha);
}

function semCorrespondente(linha: LinhaComparacao): boolean {
  return linha.status === "somente_banco" || linha.status === "somente_sistema";
}

export type Resumo = {
  processados: number;
  batidos: number;
  /** Percentual de 0 a 100. */
  taxaMatch: number;
  divergentes: number;
  valorDivergente: number;
  semCorrespondente: number;
  valorSemCorrespondente: number;
};

export function resumir(conciliacoes: Conciliacao[]): Resumo {
  const linhas = conciliacoes.flatMap((conciliacao) => conciliacao.linhas);
  const batidos = linhas.filter((linha) => linha.status === "batido").length;
  const emAberto = linhas.filter((linha) => linha.status !== "batido");
  const orfas = linhas.filter(semCorrespondente);

  return {
    processados: linhas.length,
    batidos,
    taxaMatch: linhas.length === 0 ? 0 : (batidos / linhas.length) * 100,
    divergentes: emAberto.length,
    valorDivergente: linhas.reduce((total, linha) => total + divergenciaDaLinha(linha), 0),
    semCorrespondente: orfas.length,
    valorSemCorrespondente: orfas.reduce((total, linha) => total + divergenciaDaLinha(linha), 0),
  };
}

export function formatarInteiro(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

/** Valores de destaque no design aparecem sem centavos ("R$ 214.380"). */
export function formatarMoedaCurta(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
