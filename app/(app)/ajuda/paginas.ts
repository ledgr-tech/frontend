import {
  ArrowLeftRight,
  CalendarCheck,
  Columns3,
  FileUp,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import type { TelaDoTutorial } from "@/lib/preferencias";

/**
 * As páginas da Central de ajuda (#171), uma por tela do fluxo principal. Escritas aqui, sem editor:
 * mudar um texto é um commit. Rascunho: o texto final passa pela revisão dos sócios, como o do
 * tutorial do mascote (`tutorial/roteiros.ts`), que esta página complementa.
 */
export type PassoDaAjuda = {
  titulo: string;
  texto: string;
};

export type PaginaDeAjuda = {
  id: string;
  titulo: string;
  icone: LucideIcon;
  /** Onde a tela fica no app, como a pessoa a encontra. */
  onde: string;
  /** A frase de abertura da página. */
  resumo: string;
  /** O título e o texto curto do painel da tela, que abre pelo "?". */
  chamada: string;
  curto: string;
  passos: PassoDaAjuda[];
  nota: string;
  seDerErrado?: { texto: string; pagina: string; link: string };
  perguntas: [string, string][];
  /**
   * shortcut: o vídeo entra quando houver gravação; `src` é um arquivo em public/ajuda/. Sem ele, a
   * página não mostra um player vazio.
   */
  video?: { src: string; capitulos: [string, string][] };
};

export const PAGINAS: PaginaDeAjuda[] = [
  {
    id: "nova-conciliacao",
    titulo: "Nova conciliação",
    icone: FileUp,
    onde: "Conciliações › Nova conciliação",
    resumo:
      "Você envia o extrato do banco e o do sistema de gestão do mesmo período, e o Ledgr compara linha por linha.",
    chamada: "Encaixe os dois extratos.",
    curto:
      "O do banco vai à esquerda e o do sistema de gestão à direita, do mesmo período.",
    passos: [
      {
        titulo: "Envie o extrato do banco",
        texto: "OFX ou CSV exportado do internet banking, até 4 MB.",
      },
      {
        titulo: "Envie o do sistema de gestão",
        texto: "Um CSV do mesmo período, com data, descrição e valor.",
      },
      {
        titulo: "Clique em Conciliar extratos",
        texto: "O resultado abre na comparação, separado por categoria.",
      },
    ],
    nota: "O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como “o sistema diverge do banco”.",
    seDerErrado: {
      texto:
        "Se o CSV vier fora do formato, o Ledgr pausa a importação e pede para você apontar as colunas.",
      pagina: "apontar-colunas",
      link: "Como apontar as colunas",
    },
    perguntas: [
      [
        "Posso enviar PDF?",
        "Ainda não. Hoje o Ledgr lê OFX e CSV do banco e CSV do sistema de gestão.",
      ],
      [
        "E se os períodos forem diferentes?",
        "O mês da conciliação é o do extrato do banco. O que estiver fora dele aparece sem correspondência.",
      ],
      [
        "Posso mandar outro arquivo do sistema depois?",
        "Pode. Cada nova versão do extrato do sistema vira uma rodada da mesma conciliação.",
      ],
    ],
  },
  {
    id: "apontar-colunas",
    titulo: "Apontar as colunas do CSV",
    icone: Columns3,
    onde: "Nova conciliação › Importação interrompida",
    resumo:
      "Quando um CSV chega num formato que o Ledgr não reconhece, ele pausa a importação e pede para você dizer qual coluna é qual.",
    chamada: "Diga qual coluna é qual.",
    curto:
      "Aponte a data, a descrição e o valor. O arquivo é lido de novo com essas colunas.",
    passos: [
      {
        titulo: "Veja a amostra",
        texto:
          "As primeiras linhas aparecem como vieram, para você reconhecer as colunas.",
      },
      {
        titulo: "Aponte data, descrição e valor",
        texto:
          "Escolha em cada lista a coluna certa. Valor em duas colunas também serve: entrada e saída.",
      },
      {
        titulo: "Retome a importação",
        texto: "O arquivo é lido de novo com as colunas que você apontou.",
      },
    ],
    nota: "Linhas que ainda assim não puderem ser lidas aparecem com o motivo em Extratos.",
    perguntas: [
      [
        "O Ledgr lembra esse formato?",
        "Ainda não. Por enquanto você aponta as colunas a cada arquivo fora do formato.",
      ],
    ],
  },
  {
    id: "comparacao",
    titulo: "Ler a comparação",
    icone: ArrowLeftRight,
    onde: "Conciliações › comparação",
    resumo:
      "A comparação põe o banco e o sistema lado a lado. O resumo do topo diz quanto já bateu e quanto ainda pede sua atenção.",
    chamada: "O resumo antes da lista.",
    curto:
      "Comece pelo resumo do topo, revise por categoria e abra a linha que divergiu.",
    passos: [
      {
        titulo: "Comece pelo resumo",
        texto:
          "Quantas linhas bateram, quantas bateram na tolerância e quantas divergiram.",
      },
      {
        titulo: "Revise por categoria",
        texto: "Clique numa categoria para ver só as linhas dela.",
      },
      {
        titulo: "Abra uma linha",
        texto:
          "Passe o mouse para espiar os dois lados, ou clique para ver o detalhe.",
      },
    ],
    nota: "Uma linha que bateu dentro da tolerância de dias já conta como resolvida.",
    perguntas: [],
  },
  {
    id: "justificar",
    titulo: "Justificar uma divergência",
    icone: MessageSquareText,
    onde: "Comparação › detalhe da linha",
    resumo:
      "Uma divergência com explicação não precisa travar o fechamento. Você registra o motivo e ela sai das pendências.",
    chamada: "Confira ou justifique.",
    curto:
      "Abra a linha, clique em Justificar e escreva o motivo com as suas palavras.",
    passos: [
      {
        titulo: "Abra a linha divergente",
        texto:
          "Na comparação, clique na linha para ver os dois valores e a diferença.",
      },
      {
        titulo: "Clique em Justificar",
        texto:
          "Escreva o motivo, por exemplo “tarifa cobrada no dia seguinte”.",
      },
      {
        titulo: "Confira em Fechamentos",
        texto:
          "As justificadas aparecem separadas das pendentes, com quem justificou e quando.",
      },
    ],
    nota: "Com o mês fechado não dá para justificar. Reabra o mês em Fechamentos primeiro.",
    perguntas: [],
  },
  {
    id: "tolerancia",
    titulo: "Tolerância de data",
    icone: CalendarCheck,
    onde: "Configurações › Conciliação",
    resumo:
      "A tolerância diz até quantos dias de diferença, para mais ou para menos, dois lançamentos de mesmo valor ainda contam como bateu.",
    chamada: "Quantos dias ainda contam como bateu.",
    curto:
      "Escolha de 0 até o limite. Com 2, vale de dois dias antes a dois dias depois.",
    passos: [
      {
        titulo: "Abra as configurações",
        texto: "Pelo menu da conta ou com Ctrl e vírgula, em Conciliação.",
      },
      {
        titulo: "Escolha os dias",
        texto: "Com − e +, de 0 até o limite que aparece na tela.",
      },
      {
        titulo: "Salve",
        texto:
          "Vale a partir da próxima conciliação. As que já rodaram ficam como estavam.",
      },
    ],
    nota: "Com 0, só casam lançamentos do mesmo dia.",
    perguntas: [],
  },
];

export function paginaDeAjuda(id: string): PaginaDeAjuda | undefined {
  return PAGINAS.find((pagina) => pagina.id === id);
}

/** A página da tela aberta, para o "Ajuda desta tela"; telas sem página ficam só com o tutorial. */
const PAGINA_DA_TELA: Partial<Record<TelaDoTutorial, string>> = {
  "nova-conciliacao": "nova-conciliacao",
  comparacao: "comparacao",
  divergencia: "justificar",
};

export function ajudaDaTela(
  tela: TelaDoTutorial | null,
): PaginaDeAjuda | undefined {
  const id = tela ? PAGINA_DA_TELA[tela] : undefined;
  return id ? paginaDeAjuda(id) : undefined;
}

/** Procura no título, no resumo e nos passos, sem acento e sem diferença de maiúsculas. */
export function procurarAjuda(termo: string): PaginaDeAjuda[] {
  const limpo = normalizar(termo.trim());
  if (!limpo) return PAGINAS;
  return PAGINAS.filter((pagina) =>
    normalizar(
      [
        pagina.titulo,
        pagina.resumo,
        ...pagina.passos.flatMap((p) => [p.titulo, p.texto]),
      ].join(" "),
    ).includes(limpo),
  );
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
