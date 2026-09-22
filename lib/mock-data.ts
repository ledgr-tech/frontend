export type StatusLinha =
  | "batido"
  | "divergencia_valor"
  | "somente_banco"
  | "somente_sistema";

export type EventoHistorico = {
  quando: string;
  evento: string;
  /** Quem registrou o evento. O detalhe da divergência mostra esta coluna. */
  origem?: "Banco" | "Sistema" | "Ledgr";
};

/** Nível de atenção do design (NIVEIS em Ledgr.dc.html): quanto mais grave, mais o ouro pesa. */
export type Nivel = "neutro" | "leve" | "medio" | "forte";

/** Linha "rótulo: valor" nos cartões de banco e sistema do detalhe da divergência. */
export type CampoLancamento = {
  rotulo: string;
  valor: string;
};

/** Uma competência em que o mesmo lançamento já divergiu — o bloco "crônico, não pontual". */
export type MesCronico = {
  mes: string;
  valorBanco: number;
  valorSistema: number;
  /** Por que divergiu, na linguagem do design: "2 dias de atraso". */
  nota: string;
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
  /** Metadados do extrato, mostrados no detalhe. Opcionais: só a divergência que o
   *  design descreve por inteiro os tem; as outras linhas degradam sem eles. */
  camposBanco?: CampoLancamento[];
  camposSistema?: CampoLancamento[];
  /** Competências anteriores com a mesma divergência, quando é padrão e não caso isolado. */
  cronico?: MesCronico[];
  /** A causa em uma frase, destacada acima da explicação longa no detalhe. */
  causa?: string;
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
        { quando: "28/08/2026", evento: "Título emitido em R$ 12.604,00", origem: "Sistema" },
        { quando: "04/09/2026", evento: "Boleto liquidado em R$ 12.640,00", origem: "Banco" },
        { quando: "30/09/2026", evento: "Divergência de R$ 36,00 detectada", origem: "Ledgr" },
        { quando: "Agora", evento: "Aguardando decisão do responsável", origem: "Ledgr" },
      ],
      camposBanco: [
        { rotulo: "Data do lançamento", valor: "04/09/2026" },
        { rotulo: "Documento", valor: "00071.4482-9" },
        { rotulo: "Tipo", valor: "Boleto liquidado" },
        { rotulo: "Identificador OFX", valor: "BB-4482-0409" },
      ],
      camposSistema: [
        { rotulo: "Data do lançamento", valor: "04/09/2026" },
        { rotulo: "Documento", valor: "00071.4482-9" },
        { rotulo: "Tipo", valor: "Contas a pagar" },
        { rotulo: "Conta contábil", valor: "2.01.01 Fornecedores" },
      ],
      causa: "Juros de dois dias de atraso não lançados no sistema.",
      cronico: [
        { mes: "Julho", valorBanco: 11402, valorSistema: 11380, nota: "1 dia de atraso" },
        { mes: "Agosto", valorBanco: 11905, valorSistema: 11870, nota: "2 dias de atraso" },
        { mes: "Setembro", valorBanco: 12640, valorSistema: 12604, nota: "2 dias de atraso" },
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
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Conciliacao[];
  } catch {
    return [];
  }
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

/**
 * Aceita o extrato do banco como verdade para uma linha: o valor do sistema passa a
 * ser o do banco e a linha vira um match. O design manda o botão de volta para a
 * dashboard sem mudar nada, porque é protótipo estático — aqui ele precisa fazer o
 * que promete, senão os números da dashboard não acompanham a decisão.
 */
export function aceitarValorDoBanco(conciliacaoId: string, linhaId: string): Conciliacao | null {
  const lista = lerConciliacoes();
  const index = lista.findIndex((conciliacao) => conciliacao.id === conciliacaoId);
  if (index === -1) return null;

  const linhas = lista[index].linhas.map((linha) => {
    if (linha.id !== linhaId || linha.valorBanco === null) return linha;
    return {
      ...linha,
      valorSistema: linha.valorBanco,
      status: "batido" as StatusLinha,
      historico: [
        ...linha.historico,
        { quando: "Agora", evento: "Valor do banco aceito pelo responsável", origem: "Ledgr" as const },
      ],
    };
  });

  const atualizada: Conciliacao = { ...lista[index], linhas };
  lista[index] = atualizada;
  salvarConciliacoes(lista);
  return atualizada;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Regras aprendidas ────────────────────────────────────────────────────────
// Catálogo fixo do design (REGRAS em Ledgr.dc.html). Quais estão ativas é escolha
// do usuário, então isso vai para o localStorage; a lista em si não muda.

export type MarcaRegra = "Aprendida" | "Padrão" | "Sugerida";

export type Regra = {
  id: number;
  titulo: string;
  nivel: Nivel;
  marca: MarcaRegra;
  texto: string;
  /** Linha de procedência: quem criou, quando, quantas vezes aplicou. */
  rodape: string;
  /** Quanto resolveria, para a lista de sugeridas. */
  impacto: string;
};

const REGRAS: Regra[] = [
  {
    id: 0,
    titulo: "Juros de atraso da Aço Norte Bobinas",
    nivel: "medio",
    marca: "Aprendida",
    texto:
      "Quando o boleto desse fornecedor liquidar acima do valor emitido, classificar a diferença como despesa financeira e casar automaticamente.",
    rodape: "Criada em 12/08/2026 por Financeiro · aplicada 3 vezes",
    impacto: "3 casos por mês",
  },
  {
    id: 1,
    titulo: "Tarifas e IOF entram conciliados",
    nivel: "leve",
    marca: "Padrão",
    texto:
      "Tarifa de pacote, IOF e taxas bancárias de até R$ 200 casam sem passar pela revisão manual.",
    rodape: "Ativa desde o cadastro · aplicada 41 vezes",
    impacto: "11 casos por mês",
  },
  {
    id: 2,
    titulo: "Estornos de maquininha com dois dias de folga",
    nivel: "medio",
    marca: "Sugerida",
    texto:
      "O sistema lança o estorno na hora e o banco credita no dia seguinte. Uma janela de dois dias para essa descrição resolveria dezoito dos vinte e dois casos do mês.",
    rodape: "Padrão detectado em julho, agosto e setembro",
    impacto: "resolve 5 de 6",
  },
  {
    id: 3,
    titulo: "Folha de pagamento sempre no dia 15",
    nivel: "leve",
    marca: "Sugerida",
    texto:
      "Casar a folha pelo valor total do mês mesmo quando o banco quebrar o pagamento em dois lançamentos.",
    rodape: "Padrão detectado em quatro meses",
    impacto: "resolve 2 de 2",
  },
  {
    id: 4,
    titulo: "Antecipação de recebíveis por lote",
    nivel: "leve",
    marca: "Sugerida",
    texto:
      "Agrupar os lançamentos do mesmo lote de antecipação antes de comparar com o crédito único do banco.",
    rodape: "Padrão detectado em agosto e setembro",
    impacto: "resolve 3 de 4",
  },
];

const REGRAS_KEY = "ledgr_regras_ativas";
/** Estado inicial do protótipo do design: as duas primeiras já vêm ligadas. */
const REGRAS_ATIVAS_PADRAO = [0, 1];

function lerIdsAtivos(): number[] {
  if (typeof window === "undefined") return REGRAS_ATIVAS_PADRAO;
  const raw = window.localStorage.getItem(REGRAS_KEY);
  if (!raw) return REGRAS_ATIVAS_PADRAO;
  try {
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : REGRAS_ATIVAS_PADRAO;
  } catch {
    return REGRAS_ATIVAS_PADRAO;
  }
}

function salvarIdsAtivos(ids: number[]): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REGRAS_KEY, JSON.stringify(ids));
  }
}

export function listarRegras(): { ativas: Regra[]; sugeridas: Regra[] } {
  const ativos = lerIdsAtivos();
  return {
    ativas: REGRAS.filter((regra) => ativos.includes(regra.id)),
    sugeridas: REGRAS.filter((regra) => !ativos.includes(regra.id)),
  };
}

export function ativarRegra(id: number): void {
  const ativos = lerIdsAtivos();
  if (!ativos.includes(id)) salvarIdsAtivos([...ativos, id]);
}

export function desativarRegra(id: number): void {
  salvarIdsAtivos(lerIdsAtivos().filter((ativo) => ativo !== id));
}

// ── Histórico de conciliações ────────────────────────────────────────────────
// Seis competências do design (histMeses). O gráfico de barras lê desta mesma
// lista: o design tinha um segundo array (histBarras) com os mesmos meses, e as
// duas cópias já estavam fora de sincronia — ver a nota no spec.

export type MesHistorico = {
  mes: string;
  lancamentos: number;
  /** Percentual de 0 a 100. */
  taxaMatch: number;
  ajusteLiquido: number;
  fechadoComRessalva: boolean;
};

/** Da competência mais recente para a mais antiga, como a tabela do design. */
export const HISTORICO_MESES: MesHistorico[] = [
  { mes: "Setembro 2026", lancamentos: 4218, taxaMatch: 96.3, ajusteLiquido: 1284, fechadoComRessalva: false },
  { mes: "Agosto 2026", lancamentos: 3980, taxaMatch: 97.3, ajusteLiquido: 2106, fechadoComRessalva: false },
  { mes: "Julho 2026", lancamentos: 4104, taxaMatch: 96.7, ajusteLiquido: 3418, fechadoComRessalva: false },
  { mes: "Junho 2026", lancamentos: 1302, taxaMatch: 95.1, ajusteLiquido: 4960, fechadoComRessalva: false },
  { mes: "Maio 2026", lancamentos: 1288, taxaMatch: 93.4, ajusteLiquido: 6740, fechadoComRessalva: true },
  { mes: "Abril 2026", lancamentos: 1219, taxaMatch: 91.8, ajusteLiquido: 8115, fechadoComRessalva: true },
];

// ── Avisos ───────────────────────────────────────────────────────────────────
// Lista fixa do design (notificacoes em Ledgr.dc.html). Só o "já li" é estado.

export type Aviso = {
  id: string;
  titulo: string;
  texto: string;
  quando: string;
  nivel: Nivel;
  /** Para onde o aviso leva, quando a tela existe. */
  href: string | null;
};

export const AVISOS: Aviso[] = [
  {
    id: "extrato-outubro",
    titulo: "Extrato de outubro disponível no banco",
    texto: "O Sicredi liberou o arquivo do período 01–31/10.",
    quando: "há 20 minutos",
    nivel: "medio",
    href: "/conciliacoes/nova",
  },
  {
    id: "divergencias-pendentes",
    titulo: "157 divergências aguardando decisão",
    texto: "Setembro não pode ser fechado enquanto houver item pendente.",
    quando: "há 3 horas",
    nivel: "forte",
    // o design manda para a comparação folha a folha, que ainda não existe
    href: null,
  },
  {
    id: "prazo-fechamento",
    titulo: "Prazo de fechamento em 4 dias",
    texto: "O contador pede o relatório até 05/10.",
    quando: "ontem",
    nivel: "leve",
    // o design manda para o fechamento, que ainda não existe
    href: null,
  },
];

const AVISOS_LIDOS_KEY = "ledgr_avisos_lidos";

export function avisosLidos(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AVISOS_LIDOS_KEY) === "1";
}

export function marcarAvisosLidos(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AVISOS_LIDOS_KEY, "1");
  }
}
