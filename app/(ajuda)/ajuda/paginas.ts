import type { TelaDoTutorial } from "@/lib/preferencias";

/**
 * A Central de ajuda (#171): uma página por tela do app, na ordem do menu, e em cada uma todas as
 * funcionalidades da tela, com o que fazem e como fazer. Escritas aqui, sem editor: mudar um texto é
 * um commit. Rascunho: o texto final passa pela revisão dos sócios. **negrito** marca o nome de um
 * botão ou opção como aparece na tela.
 *
 * As imagens são capturas do app com a conta e os dados de exemplo, em public/ajuda/.
 */
export type ImagemDaAjuda = { src: string; largura: number; altura: number };

export type FuncaoDaAjuda = {
  /** Também é a âncora da seção: /ajuda/<pagina>#<id>. */
  id: string;
  titulo: string;
  /** O que a funcionalidade faz. */
  faz: string;
  /** Como fazer, em passos. */
  passos?: string[];
  nota?: string;
  imagem?: ImagemDaAjuda;
};

export type PaginaDeAjuda = {
  id: string;
  titulo: string;
  /** Onde a tela fica no app, como a pessoa a encontra. */
  onde: string;
  /** Para que a tela serve, a frase de abertura. */
  serve: string;
  /** A tela inteira: capa do vídeo e referência da tela. */
  capa: ImagemDaAjuda;
  funcoes: FuncaoDaAjuda[];
  /** shortcut: o vídeo entra quando houver gravação, um arquivo em public/ajuda/; sem ele, a capa diz "em breve". */
  video?: string;
};

export const PAGINAS: PaginaDeAjuda[] = [
  {
    id: "visao-geral",
    titulo: "Visão geral",
    onde: "Menu lateral › Visão geral",
    serve:
      "A primeira tela depois do login. Mostra como está o mês aberto e o que pede sua atenção agora.",
    capa: {
      src: "/ajuda/visao-geral.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "primeiros-passos",
        titulo: "Primeiros passos",
        faz: "Um roteiro com o caminho até o primeiro mês fechado. Cada passo se marca sozinho quando você o faz.",
        passos: [
          "Revise a **tolerância de dias**: quantos dias de diferença entre o banco e o sistema ainda contam como bateu.",
          "**Suba o extrato do banco** e depois **o do sistema de gestão**.",
          "**Revise o que não bateu** na comparação.",
          "Quando o mês estiver **pronto para fechar**, feche em Fechamentos.",
        ],
        nota: "O roteiro some depois do primeiro mês fechado. Para tirá-lo antes, clique em **Já sei usar**.",
      },
      {
        id: "estado-do-mes",
        titulo: "O mês em um número",
        faz: "Quantos lançamentos do mês aberto já foram conciliados e quanto ainda está em aberto.",
        passos: [
          "Leia o cartão do mês no topo.",
          "Se houver pendências, clique em **Revisar** para ir direto a elas.",
        ],
        imagem: {
          src: "/ajuda/visao-geral--estado-do-mes.webp",
          largura: 1000,
          altura: 153,
        },
      },
      {
        id: "atalhos",
        titulo: "Atalhos e atividade recente",
        faz: "Atalhos para Extratos, Conciliações, Fechamentos e Histórico, a tendência da taxa de match e as últimas conciliações, cada uma com quando rodou, quanto bateu e quantas linhas não foram lidas.",
        passos: [
          "Clique num atalho para abrir a tela.",
          "Clique numa conciliação recente para abrir a comparação dela.",
        ],
        nota: "Quando nada pede decisão, a tela diz “Nada pede sua atenção agora.”",
        imagem: {
          src: "/ajuda/visao-geral--atalhos.webp",
          largura: 1000,
          altura: 214,
        },
      },
    ],
  },
  {
    id: "extratos",
    titulo: "Extratos",
    onde: "Menu lateral › Extratos",
    serve:
      "Todos os arquivos que você enviou, do banco e do sistema de gestão, conciliados ou não.",
    capa: {
      src: "/ajuda/extratos.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "arquivos",
        titulo: "A lista de arquivos",
        faz: "Cada arquivo aparece como um cartão com a miniatura dele, agrupado pelo mês do extrato. Em **Agrupar por**, troque para ano ou para nenhum grupo.",
        passos: [
          "Role até o mês que procura.",
          "Clique num arquivo para ver os detalhes no painel ao lado.",
          "Dê um duplo clique para abrir direto a conciliação do arquivo.",
        ],
        imagem: {
          src: "/ajuda/extratos--arquivos.webp",
          largura: 781,
          altura: 900,
        },
      },
      {
        id: "filtros",
        titulo: "Filtrar por tipo",
        faz: "Os filtros mostram todos os arquivos, só os do banco, só os do sistema ou só os que tiveram problema na leitura.",
        passos: [
          "Escolha **Todos**, **Do banco**, **Do sistema** ou **Com problema** no topo da lista.",
          "Em **Com problema**, o número entre parênteses diz quantos arquivos têm linhas não lidas.",
        ],
        imagem: {
          src: "/ajuda/extratos--filtros.webp",
          largura: 1000,
          altura: 80,
        },
      },
      {
        id: "painel",
        titulo: "O painel do arquivo",
        faz: "O que aconteceu com o arquivo: quanto bateu, origem, período, quantos lançamentos, quando foi enviado e conciliado, com qual arquivo e a tolerância usada. Nos arquivos do banco, também o saldo final e a data do saldo.",
        passos: [
          "Selecione o arquivo na lista.",
          "Veja as linhas que não puderam ser lidas, cada uma com o motivo.",
          "Clique em **Ver conciliação** para abrir a comparação.",
        ],
        nota: "Quando o banco não manda o saldo no arquivo, o painel diz “Saldo não informado no arquivo”, e não R$ 0,00.",
        imagem: {
          src: "/ajuda/extratos--painel.webp",
          largura: 352,
          altura: 626,
        },
      },
    ],
  },
  {
    id: "conciliacoes",
    titulo: "Conciliações",
    onde: "Menu lateral › Conciliações",
    serve:
      "A sua fila de trabalho: uma linha por extrato do banco, com as conciliações abertas primeiro.",
    capa: {
      src: "/ajuda/conciliacoes.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "continuar",
        titulo: "Continue de onde parou",
        faz: "A conciliação que ainda pede decisão fica em destaque no topo, com um botão que volta direto para ela.",
        passos: ["Clique em **Continuar** para voltar à comparação."],
        imagem: {
          src: "/ajuda/conciliacoes--continuar.webp",
          largura: 1000,
          altura: 118,
        },
      },
      {
        id: "filtros",
        titulo: "Filtrar a fila",
        faz: "Mostra só o que pede decisão, só o que já está sem pendência, só os meses fechados ou todas.",
        passos: [
          "Escolha **Pedem decisão**, **Sem pendência**, **Mês fechado** ou **Todas** no topo da lista.",
          "Para ver tudo o que já rodou, clique em **Ver o histórico**.",
        ],
        imagem: {
          src: "/ajuda/conciliacoes--filtros.webp",
          largura: 1000,
          altura: 80,
        },
      },
      {
        id: "fila",
        titulo: "A fila",
        faz: "Cada linha é um extrato do banco com a rodada que vale: o último extrato do sistema conciliado com ele.",
        passos: [
          "Clique na linha para abrir a comparação.",
          "Para começar outra, use **Nova conciliação** no menu lateral.",
        ],
        imagem: {
          src: "/ajuda/conciliacoes--fila.webp",
          largura: 1000,
          altura: 145,
        },
      },
    ],
  },
  {
    id: "nova-conciliacao",
    titulo: "Nova conciliação",
    onde: "Menu lateral › Nova conciliação",
    serve:
      "Você envia o extrato do banco e o do sistema de gestão do mesmo período, e o Ledgr compara linha por linha.",
    capa: {
      src: "/ajuda/nova-conciliacao.webp",
      largura: 1360,
      altura: 850,
    },
    video: "/ajuda/nova-conciliacao.webm",
    funcoes: [
      {
        id: "enviar",
        titulo: "Enviar os dois extratos",
        faz: "O extrato do banco vai à esquerda e o do sistema de gestão à direita. Os dois precisam ser do mesmo período.",
        passos: [
          "Arraste ou escolha o extrato do banco: **OFX ou CSV** exportado do internet banking, até 4 MB.",
          "Arraste ou escolha o do sistema de gestão: um **CSV** com data, descrição e valor.",
        ],
        nota: "PDF ainda não é aceito. O mês da conciliação é o do extrato do banco.",
        imagem: {
          src: "/ajuda/nova-conciliacao--enviar.webp",
          largura: 1000,
          altura: 213,
        },
      },
      {
        id: "conciliar",
        titulo: "Conciliar",
        faz: "Com os dois arquivos, o botão libera. A comparação abre sozinha quando a conciliação termina.",
        passos: [
          "Clique em **Conciliar extratos**.",
          "Espere a comparação abrir.",
        ],
        imagem: {
          src: "/ajuda/nova-conciliacao--conciliar.webp",
          largura: 231,
          altura: 76,
        },
      },
      {
        id: "apontar-colunas",
        titulo: "Apontar as colunas do CSV",
        faz: "Quando um CSV chega num formato que o Ledgr não reconhece, ele pausa a importação e pede para você dizer qual coluna é qual.",
        passos: [
          "Veja a amostra: as primeiras linhas aparecem como vieram.",
          "Aponte em cada lista a coluna de **data**, de **descrição** e de **valor**. Valor em duas colunas, entrada e saída, também serve.",
          "Retome a importação: o arquivo é lido de novo com essas colunas.",
        ],
        nota: "O Ledgr ainda não lembra o formato. Você aponta as colunas a cada arquivo fora do padrão.",
      },
    ],
  },
  {
    id: "comparacao",
    titulo: "Comparação",
    onde: "Conciliações › clique numa conciliação",
    serve:
      "O banco e o sistema lado a lado, linha por linha. O extrato do banco é a fonte da verdade: é sempre o sistema que diverge do banco.",
    capa: {
      src: "/ajuda/comparacao.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "resumo",
        titulo: "O resumo por categoria",
        faz: "As divergências por categoria: **Valor diverge na mesma data**, **Possível duplicidade**, **Mesmo valor em outra data**, **Sem correspondência** e **Tarifa bancária**, cada uma com quantas linhas e quanto valor ficou em aberto.",
        passos: [
          "Leia o resumo antes da lista.",
          "Clique numa categoria para ver só as linhas dela.",
        ],
        imagem: {
          src: "/ajuda/comparacao--resumo.webp",
          largura: 1000,
          altura: 173,
        },
      },
      {
        id: "saldo",
        titulo: "O saldo do extrato",
        faz: "Uma faixa acima do resumo mostra o saldo inicial e o final do extrato do banco, quando o arquivo traz.",
        passos: ["Confira o saldo final com o do internet banking."],
        nota: "Se há linhas não lidas, a faixa avisa que o saldo inicial depende delas em vez de calcular um número errado.",
      },
      {
        id: "filtros",
        titulo: "Filtrar e procurar",
        faz: "Os filtros mostram todas as linhas, só as que pedem revisão ou só as justificadas, com quantas há em cada um.",
        passos: [
          "Escolha **Todos**, **Só revisão** ou **Justificadas** acima da tabela.",
          "Clique no nome de uma coluna para ordenar por ela.",
          "Em **Padrão** ou **Compacta**, deixe as linhas mais espaçadas ou mais juntas.",
        ],
        imagem: {
          src: "/ajuda/comparacao--filtros.webp",
          largura: 527,
          altura: 69,
        },
      },
      {
        id: "conferir",
        titulo: "Marcar como conferida",
        faz: "A coluna Conferida é sua: marque as divergências que já olhou. As que bateram não precisam.",
        passos: [
          "Clique no círculo da coluna **Conferida** na linha que você já olhou.",
        ],
        imagem: {
          src: "/ajuda/comparacao--conferir.webp",
          largura: 136,
          altura: 62,
        },
      },
      {
        id: "abrir-linha",
        titulo: "Abrir uma linha",
        faz: "Abre o detalhe da linha num painel ao lado, sem sair da comparação.",
        passos: [
          "Dê um duplo clique na linha.",
          "Para ver maior, clique em **Abrir em página inteira**.",
        ],
      },
      {
        id: "rodadas",
        titulo: "Rodadas e nova versão do sistema",
        faz: "Cada extrato do sistema conciliado com o mesmo extrato do banco vira uma rodada. A linha das rodadas mostra qual vale.",
        passos: [
          "Corrija o que divergiu no sistema de gestão e exporte um CSV novo.",
          "Clique em **Enviar nova versão do extrato do sistema**.",
          "A comparação abre na rodada nova.",
        ],
        imagem: {
          src: "/ajuda/comparacao--rodadas-linha.webp",
          largura: 139,
          altura: 54,
        },
      },
      {
        id: "mes-fechado",
        titulo: "Quando o mês está fechado",
        faz: "Com o mês fechado, um aviso no topo diz que a comparação está só para leitura: conferir, justificar e enviar nova versão somem.",
        passos: [
          "Clique em **Ver o fechamento**.",
          "Reabra o mês em Fechamentos para mexer de novo.",
        ],
        imagem: {
          src: "/ajuda/comparacao--mes-fechado.webp",
          largura: 1000,
          altura: 67,
        },
      },
    ],
  },
  {
    id: "detalhe-da-linha",
    titulo: "Detalhe da linha",
    onde: "Comparação › duplo clique numa linha (abre ao lado)",
    serve:
      "Uma divergência de perto: o lançamento do banco, o do sistema, a diferença e o que você decidiu sobre ela.",
    capa: {
      src: "/ajuda/detalhe-da-linha.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "lados",
        titulo: "Banco de um lado, sistema do outro",
        faz: "Data, descrição e valor de cada lado, com a diferença entre os dois.",
        passos: [
          "Compare os dois lados.",
          "Veja em **Data no sistema** e **Descrição no sistema** o que precisa ser corrigido lá.",
        ],
        imagem: {
          src: "/ajuda/detalhe-da-linha--lados.webp",
          largura: 543,
          altura: 452,
        },
      },
      {
        id: "motivo",
        titulo: "O provável motivo",
        faz: "Quando você pede, o Ledgr lê os dois lados da linha e explica, em linguagem simples, por que ela não casou.",
        passos: [
          "Clique em **Explicar esta divergência**.",
          "Leia a explicação e confira no seu sistema de gestão antes de decidir.",
        ],
        nota: "Ao pedir, dados resumidos desta linha são enviados à OpenAI. A IA explica; quem decide é você.",
        imagem: {
          src: "/ajuda/detalhe-da-linha--motivo.webp",
          largura: 543,
          altura: 260,
        },
      },
      {
        id: "decidir",
        titulo: "Conferir ou justificar",
        faz: "Uma divergência com explicação não precisa travar o fechamento. A decisão vai para o relatório do mês.",
        passos: [
          "Clique em **Marcar como conferida** se você já olhou e vai corrigir no sistema.",
          "Ou clique em **Justificar** e escreva o motivo, por exemplo “tarifa cobrada no dia seguinte”.",
          "Para voltar atrás, use **Desfazer justificativa**.",
        ],
        nota: "Abaixo fica o histórico da linha: cada evento, quem fez e quando.",
      },
    ],
  },
  {
    id: "fechamentos",
    titulo: "Fechamentos",
    onde: "Menu lateral › Fechamentos",
    serve:
      "Onde você fecha o mês depois de conciliar e decidir as divergências, e onde sai o relatório para o contador.",
    capa: {
      src: "/ajuda/fechamentos.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "meses",
        titulo: "Um cartão por mês",
        faz: "A cor e a porcentagem mostram quanto do mês já bateu, e o selo diz se está com pendência ou fechado.",
        passos: [
          "Filtre por **Todos**, **Prontos para fechar**, **Com pendência** ou **Fechados**.",
          "Clique no mês que quer fechar.",
        ],
        imagem: {
          src: "/ajuda/fechamentos--meses.webp",
          largura: 388,
          altura: 669,
        },
      },
      {
        id: "o-que-falta",
        titulo: "O que falta para fechar",
        faz: "Três conferências: **Extratos conciliados**, **Arquivos lidos por inteiro** e **Divergências decididas**.",
        passos: [
          "Veja o que ainda não está pronto no painel do mês.",
          "Clique em **Revisar pendências** para ir até elas.",
        ],
        imagem: {
          src: "/ajuda/fechamentos--o-que-falta.webp",
          largura: 744,
          altura: 543,
        },
      },
      {
        id: "fechar",
        titulo: "Fechar o mês",
        faz: "Com tudo pronto, o mês fecha num clique. Com pendências, dá para fechar mesmo assim, registrando uma ressalva.",
        passos: [
          "Clique em **Fechar o mês**.",
          "Se houver pendências, clique em **Fechar mesmo assim**, leia o aviso e escreva a ressalva.",
        ],
        nota: "Mês fechado trava a comparação: ninguém confere, justifica ou concilia de novo até reabrir.",
      },
      {
        id: "reabrir",
        titulo: "Reabrir o mês",
        faz: "Volta a permitir conferir, justificar e enviar nova versão do sistema.",
        passos: [
          "Abra o mês fechado.",
          "Clique em **Reabrir** com o nome do mês, por exemplo **Reabrir agosto**.",
        ],
        imagem: {
          src: "/ajuda/fechamentos--reabrir.webp",
          largura: 744,
          altura: 609,
        },
      },
      {
        id: "relatorio",
        titulo: "Relatório para o contador",
        faz: "O resumo do mês, as divergências e como cada uma foi resolvida, em PDF ou em planilha.",
        passos: [
          "Abra um mês fechado e clique em **Baixar PDF**.",
          "O relatório abre numa nova aba com a impressão do navegador. Escolha **Salvar como PDF**.",
          "Para a planilha, clique em **Exportar CSV**. Ela abre no Excel com os acentos certos.",
        ],
        imagem: {
          src: "/ajuda/fechamentos--fechar.webp",
          largura: 744,
          altura: 687,
        },
      },
    ],
  },
  {
    id: "historico",
    titulo: "Histórico",
    onde: "Menu lateral › Histórico",
    serve: "Tudo o que já foi conciliado, mês a mês.",
    capa: {
      src: "/ajuda/historico.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "grafico",
        titulo: "Como os meses andaram",
        faz: "O gráfico mostra quanto bateu em cada mês.",
        imagem: {
          src: "/ajuda/historico--grafico.webp",
          largura: 1000,
          altura: 282,
        },
      },
      {
        id: "lista",
        titulo: "As conciliações",
        faz: "Agrupadas pelo mês do extrato do banco, cada uma com as rodadas que teve, quantos lançamentos, quanto bateu e quantas linhas pedem revisão.",
        passos: [
          "Filtre por **Todos** ou **Com pendência**.",
          "Clique numa conciliação para abrir a comparação daquela rodada.",
          "Use as páginas no fim da lista para ver as mais antigas.",
          "Para levar tudo para uma planilha, clique em **Exportar histórico**.",
        ],
        imagem: {
          src: "/ajuda/historico--lista.webp",
          largura: 1000,
          altura: 438,
        },
      },
      {
        id: "totais",
        titulo: "Os totais da página",
        faz: "Somam as conciliações da página: quantas foram, quantos lançamentos processados e quantos casaram sozinhos.",
      },
    ],
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    onde: "Menu da conta › Configurações, ou Ctrl e vírgula",
    serve:
      "A sua conta, a equipe, a aparência do app e a regra da conciliação.",
    capa: {
      src: "/ajuda/configuracoes.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "abrir",
        titulo: "Abrir e procurar",
        faz: "As configurações abrem numa janela por cima da tela em que você está, com as seções à esquerda: Conta, Equipe, Aparência, Conciliação, Atalhos de teclado, Privacidade e Sobre.",
        passos: [
          "Clique no seu nome no menu lateral e em **Configurações**, ou aperte **Ctrl** e **,**.",
          "Escolha a seção, ou digite em **Procurar** o que quer mudar, por exemplo “senha”.",
        ],
      },
      {
        id: "conta",
        titulo: "Conta",
        faz: "O e-mail da conta e a senha.",
        passos: [
          "Para trocar a senha, clique em **Trocar senha**.",
          "Para trocar o e-mail, clique em **Pedir por e-mail** e fale com o suporte.",
        ],
        nota: "Quem entra só com o Google não tem senha no Ledgr, então não vê Trocar senha.",
        imagem: {
          src: "/ajuda/configuracoes--conta.webp",
          largura: 960,
          altura: 640,
        },
      },
      {
        id: "tolerancia",
        titulo: "Tolerância de data",
        faz: "Até quantos dias de diferença, para mais ou para menos, dois lançamentos de mesmo valor ainda contam como bateu. É a única regra da conciliação que você ajusta: o valor precisa bater. A mesma seção mostra a fonte da verdade (o extrato do banco) e como funcionam as explicações por IA.",
        passos: [
          "Abra **Conciliação**.",
          "Escolha os dias com − e +, de 0 até o limite da tela.",
          "Clique em **Salvar**.",
        ],
        nota: "Vale a partir da próxima conciliação. Com 0, só casam lançamentos do mesmo dia.",
        imagem: {
          src: "/ajuda/configuracoes--tolerancia.webp",
          largura: 960,
          altura: 640,
        },
      },
      {
        id: "equipe",
        titulo: "Equipe",
        faz: "As pessoas com acesso à empresa. Quem cadastrou a empresa é o administrador: convida, cancela convites e remove pessoas.",
        passos: [
          "Abra **Equipe**.",
          "Clique em **Convidar pessoa** e digite o e-mail. A pessoa recebe um link para criar o acesso.",
          "Para tirar alguém, clique em **Remover**. O acesso é cortado na hora.",
        ],
        imagem: {
          src: "/ajuda/configuracoes--equipe.webp",
          largura: 960,
          altura: 640,
        },
      },
      {
        id: "aparencia",
        titulo: "Aparência",
        faz: "O tema, a densidade das tabelas e o menu lateral.",
        passos: [
          "Em **Tema**, escolha **Claro**, **Escuro** ou **Sistema**, que segue o seu computador.",
          "Em **Densidade das tabelas**, escolha **Padrão** ou **Compacta**.",
          "Em **Menu lateral**, deixe **Aberto** ou **Recolhido**. O atalho é Ctrl e B.",
        ],
        imagem: {
          src: "/ajuda/configuracoes--aparencia.webp",
          largura: 960,
          altura: 640,
        },
      },
    ],
  },
  {
    id: "assinatura",
    titulo: "Assinatura",
    onde: "Menu lateral › Assinatura",
    serve: "O seu plano e as faturas.",
    capa: {
      src: "/ajuda/assinatura.webp",
      largura: 1360,
      altura: 850,
    },
    funcoes: [
      {
        id: "teste",
        titulo: "Período de teste",
        faz: "Os 14 primeiros dias são de teste. Enquanto durar, a barra do topo mostra quantos dias faltam.",
        passos: [
          "Escolha um plano antes do fim do teste para continuar conciliando.",
        ],
      },
      {
        id: "plano",
        titulo: "Plano atual e faturas",
        faz: "O plano em uso, quantas contas e lançamentos ele cobre, os outros planos e a lista de faturas, com competência, vencimento, valor, situação e recibo.",
        passos: [
          "Para trocar de plano, clique em **Mudar para** no plano que quer.",
        ],
        nota: "A cobrança ainda não está no ar. Planos e faturas desta tela são de demonstração, e nada é alterado por aqui.",
      },
    ],
  },
];

export function paginaDeAjuda(id: string): PaginaDeAjuda | undefined {
  return PAGINAS.find((pagina) => pagina.id === id);
}

/** A página da tela aberta, para o "Ajuda desta tela". */
const PAGINA_DA_TELA: Record<TelaDoTutorial, string> = {
  "visao-geral": "visao-geral",
  conciliacoes: "conciliacoes",
  "nova-conciliacao": "nova-conciliacao",
  comparacao: "comparacao",
  divergencia: "detalhe-da-linha",
  extratos: "extratos",
  historico: "historico",
  fechamentos: "fechamentos",
  configuracoes: "configuracoes",
};

export function ajudaDaTela(
  tela: TelaDoTutorial | null,
): PaginaDeAjuda | undefined {
  return tela ? paginaDeAjuda(PAGINA_DA_TELA[tela]) : undefined;
}
