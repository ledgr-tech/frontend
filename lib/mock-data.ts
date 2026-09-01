export type StatusLinha =
  | "batido"
  | "divergencia_valor"
  | "somente_banco"
  | "somente_sistema";

export type EventoHistorico = {
  quando: string;
  evento: string;
};

export type LinhaComparacao = {
  id: string;
  descricao: string;
  data: string;
  valorBanco: number | null;
  valorSistema: number | null;
  status: StatusLinha;
  explicacao: string | null;
  historico: EventoHistorico[];
};

export type Conciliacao = {
  id: string;
  mes: string;
  status: "em_andamento" | "fechada";
  linhas: LinhaComparacao[];
};

export const EMPRESA_MOCK = "Telha Certa";

const STORAGE_KEY = "ledgr_conciliacoes";

function linhasMock(): LinhaComparacao[] {
  return [
    {
      id: "lc-1",
      descricao: "Pagamento Distribuidora Vale Verde",
      data: "02/09",
      valorBanco: 7300,
      valorSistema: 7300,
      status: "batido",
      explicacao: null,
      historico: [
        { quando: "01/09", evento: "Lançado no sistema de gestão" },
        { quando: "02/09", evento: "Compensado no banco" },
      ],
    },
    {
      id: "lc-2",
      descricao: "Boleto Aço Norte Bobinas",
      data: "04/09",
      valorBanco: 12640,
      valorSistema: 12604,
      status: "divergencia_valor",
      explicacao:
        "O boleto foi emitido em R$ 12.604,00 e pago com acréscimo de R$ 36,00. O banco registrou o valor pago; o sistema guardou o valor da emissão. Aceitar o valor do banco corrige o lançamento e classifica a diferença como despesa financeira.",
      historico: [
        { quando: "01/09", evento: "Boleto emitido no sistema de gestão" },
        { quando: "04/09", evento: "Pago no banco com juros de dois dias de atraso" },
      ],
    },
    {
      id: "lc-3",
      descricao: "Transferência recebida — cliente Metalúrgica Bom Retiro",
      data: "05/09",
      valorBanco: 4180,
      valorSistema: null,
      status: "somente_banco",
      explicacao: null,
      historico: [
        { quando: "05/09", evento: "Recebido no banco, sem lançamento correspondente no sistema" },
      ],
    },
    {
      id: "lc-4",
      descricao: "Nota Fiscal 4821 — Serviços de TI",
      data: "08/09",
      valorBanco: null,
      valorSistema: 2150,
      status: "somente_sistema",
      explicacao: null,
      historico: [
        { quando: "08/09", evento: "Lançado no sistema, ainda não debitado no banco" },
      ],
    },
    {
      id: "lc-5",
      descricao: "Folha de pagamento — setembro",
      data: "05/09",
      valorBanco: 48200,
      valorSistema: 48200,
      status: "batido",
      explicacao: null,
      historico: [
        { quando: "03/09", evento: "Lançado no sistema de gestão" },
        { quando: "05/09", evento: "Debitado no banco" },
      ],
    },
  ];
}

function novaConciliacao(): Conciliacao {
  return {
    id: `conc-${Date.now()}`,
    mes: "Setembro 2026",
    status: "em_andamento",
    linhas: linhasMock(),
  };
}

function lerConciliacoes(): Conciliacao[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Conciliacao[]) : [];
}

function salvarConciliacoes(lista: Conciliacao[]): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  }
}

export function listarConciliacoes(): Conciliacao[] {
  return lerConciliacoes();
}

export function criarConciliacao(): Conciliacao {
  const conciliacao = novaConciliacao();
  const lista = lerConciliacoes();
  lista.unshift(conciliacao);
  salvarConciliacoes(lista);
  return conciliacao;
}

export function buscarConciliacao(id: string): Conciliacao | null {
  return lerConciliacoes().find((conciliacao) => conciliacao.id === id) ?? null;
}

export function fecharConciliacao(id: string): Conciliacao | null {
  const lista = lerConciliacoes();
  const index = lista.findIndex((conciliacao) => conciliacao.id === id);
  if (index === -1) return null;
  const atualizada: Conciliacao = { ...lista[index], status: "fechada" };
  lista[index] = atualizada;
  salvarConciliacoes(lista);
  return atualizada;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
