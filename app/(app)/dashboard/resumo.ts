import type { Conciliacao, LinhaComparacao, StatusLinha, Tom } from "@/lib/mock-data";

// Rótulos e tons das 7 categorias que o motor do backend produz
// (`StatusConciliacao` em `app/api/conciliacoes.py`). O tom segue a regra que o
// trabalho de cores fechou: verde o que está resolvido, terracota o que custa
// dinheiro, ouro o que está incompleto, neutro o que já tem explicação.
const STATUS: Record<StatusLinha, { rotulo: string; tom: Tom }> = {
  match_exato: { rotulo: "Match exato", tom: "ok" },
  // casou dentro da tolerância de dias da empresa (ADR-008): resolvido, com a
  // ressalva no próprio rótulo em vez de num tom mais fraco
  match_tolerancia: { rotulo: "Match por tolerância de data", tom: "ok" },
  // achou lançamento do outro lado na mesma data e o valor não bate: dinheiro
  divergente_valor: { rotulo: "Valor diverge na mesma data", tom: "risco" },
  // achou o mesmo valor em outra data: está tudo lá, no dia errado
  divergente_data: { rotulo: "Mesmo valor em outra data", tom: "atencao" },
  // sobra de um grupo que já formou par (ADR-006): pagamento repetido custa caro
  duplicado: { rotulo: "Possível duplicidade", tom: "risco" },
  // ponytail: neutro de propósito. Tarifa ganhou categoria própria na issue #24
  // justamente por ser a sobra que o sistema já sabe explicar — deixar em ouro
  // junto com o que ninguém identificou desperdiçaria a classificação.
  tarifa_bancaria: { rotulo: "Tarifa bancária", tom: "neutro" },
  sem_correspondencia: { rotulo: "Sem correspondência", tom: "atencao" },
};

/** Match exato e match por tolerância; o resto ainda pede decisão de alguém. */
export function estaResolvida(status: StatusLinha): boolean {
  return status === "match_exato" || status === "match_tolerancia";
}

/** Rótulo e tom de um código do motor, sem a linha (as contagens de `/execucoes`). */
export function seloDoStatus(status: StatusLinha): { rotulo: string; tom: Tom } {
  return STATUS[status];
}

export function statusDaLinha(linha: LinhaComparacao): { rotulo: string; tom: Tom } {
  const base = STATUS[linha.status];
  if (linha.status !== "sem_correspondencia") return base;
  // O backend tem um status só pra isso; quem dá o rótulo útil é o lado que falta.
  const rotulo =
    linha.valorBanco === null ? "Sem correspondência no banco" : "Sem correspondência no sistema";
  return { ...base, rotulo };
}

/** O extrato do banco é a fonte da verdade; sem ele, cai para o valor do sistema. */
export function valorDaLinha(linha: LinhaComparacao): number {
  return linha.valorBanco ?? linha.valorSistema ?? 0;
}

export function origemDaLinha(linha: LinhaComparacao): "Banco" | "Sistema" {
  return linha.valorBanco === null ? "Sistema" : "Banco";
}

// Dinheiro some em centavos, não em reais: somar 1234.56 algumas centenas de
// vezes em float acumula resíduo (o backend manda valor como string pelo mesmo
// motivo). Inteiro de centavos não tem esse problema até a casa dos trilhões.
function centavos(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Quanto a linha deixa em aberto: a diferença quando os dois lados existem, o
 * valor inteiro quando só um existe. Sempre pelo tamanho: o backend guarda
 * débito negativo, e somar com sinal fazia um débito órfão descontar da
 * divergência em vez de somar.
 */
function divergenciaEmCentavos(linha: LinhaComparacao): number {
  if (estaResolvida(linha.status)) return 0;
  if (linha.valorBanco !== null && linha.valorSistema !== null) {
    return Math.abs(centavos(linha.valorBanco) - centavos(linha.valorSistema));
  }
  return Math.abs(centavos(valorDaLinha(linha)));
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

/** Quanto as linhas deixam em aberto, em reais; as já resolvidas contam zero. */
export function valorEmAberto(linhas: LinhaComparacao[]): number {
  return linhas.reduce((total, linha) => total + divergenciaEmCentavos(linha), 0) / 100;
}

export function resumir(conciliacoes: Conciliacao[]): Resumo {
  const linhas = conciliacoes.flatMap((conciliacao) => conciliacao.linhas);
  const resolvidas = linhas.filter((linha) => estaResolvida(linha.status));
  const emAberto = linhas.filter((linha) => !estaResolvida(linha.status));
  const orfas = linhas.filter((linha) => linha.status === "sem_correspondencia");

  return {
    processados: linhas.length,
    batidos: resolvidas.length,
    taxaMatch: linhas.length === 0 ? 0 : (resolvidas.length / linhas.length) * 100,
    divergentes: emAberto.length,
    valorDivergente: valorEmAberto(linhas),
    semCorrespondente: orfas.length,
    valorSemCorrespondente: valorEmAberto(orfas),
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

// O servidor da Vercel roda em UTC; data sem fuso explícito sairia 3h adiantada.
const FUSO = "America/Sao_Paulo";

function partes(iso: string): Record<string, string> {
  const formato = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(formato.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

/** "2026-09-24T17:02:11Z" → "24/09/2026 14:02", no horário de Brasília. */
export function formatarDataHora(iso: string): string {
  const { day, month, year, hour, minute } = partes(iso);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/** "2026-10-01T02:30:00Z" → "30/09", no dia de Brasília. */
export function formatarDiaMes(iso: string): string {
  const { day, month } = partes(iso);
  return `${day}/${month}`;
}

const MESES_MINUSCULOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * O período que o extrato cobre, pelas datas das próprias linhas: "01–30 de
 * setembro" como no design, ou "28/08 a 03/09" quando atravessa o mês.
 */
export function periodoDasLinhas(linhas: LinhaComparacao[]): string | null {
  // AAAA-MM-DD ordena como texto
  const datas = linhas.flatMap((linha) => (linha.dataISO ? [linha.dataISO] : [])).sort();
  if (datas.length === 0) return null;
  const [, mesInicio, diaInicio] = datas[0].split("-");
  const [, mesFim, diaFim] = datas[datas.length - 1].split("-");
  if (mesInicio === mesFim) {
    return `${diaInicio}–${diaFim} de ${MESES_MINUSCULOS[Number(mesFim) - 1]}`;
  }
  return `${diaInicio}/${mesInicio} a ${diaFim}/${mesFim}`;
}
