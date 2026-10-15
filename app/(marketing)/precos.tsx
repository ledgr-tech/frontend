import type { ReactNode } from "react";
import { estaResolvida, seloDoStatus } from "@/app/(app)/dashboard/resumo";
import { IconeOrigem } from "@/app/(app)/icone-origem";
import { SeloIa } from "@/app/(app)/selo-ia";
import { Reveal } from "@/app/reveal";
import { PLANOS } from "@/lib/planos";
import { QUANTAS_CATEGORIAS } from "./categorias";
import type { LinhaExtrato } from "./comparacao";
import { DicaDoMouse } from "./dica-do-mouse";
import { FioDaTrilha } from "./fio-da-trilha";

/**
 * Preços: o que vem em todo plano, em quatro cards numa trilha vertical como a de "Por dentro" (o
 * fio em onda desce conforme a página rola, e cada card entra quando a ponta do fio chega nele). A
 * trilha termina na régua dos planos, pelo volume do mês. Sem preço: a cobrança ainda não está
 * definida (o preço segue em lib/planos.ts, para a Assinatura do app).
 *
 * O card é o da referência do Mailchimp no nosso estilo: em repouso, escuro na faixa e com o fim da
 * lista de benefícios apagando; no hover, ou no foco do teclado, ele vira folha de papel, como as
 * folhas de extrato do app, e a lista aparece inteira. Só CSS (globals.css, .beneficio). A lista
 * está sempre inteira no HTML: só o desenho apaga o fim dela, e o leitor de tela lê tudo.
 */

// a mesma altura de "Por dentro": a ponta do fio desenha a 60% da tela, e um card entra quando o
// topo dele passa dessa altura, junto com o fio
const PONTA_DO_FIO = 60;
const NA_PONTA_DO_FIO = { amount: 0, margin: `0px 0px -${100 - PONTA_DO_FIO}% 0px` };

/** O mês da demonstração, o mesmo do cartão do hero. */
export type ResumoDoMes = { periodo: string; conciliado: string; paraRevisar: string };

type Demonstracao = "linhas" | "explicacao" | "arquivos" | "relatorio";

type Beneficio = { num: string; titulo: string; texto: string; itens: string[]; demonstracao: Demonstracao };

// os títulos dos cards são novos; o resto é o que a landing já diz (hero, "Na prática", passos,
// "Por dentro", Regra de ouro e FAQ), em forma de lista
const BENEFICIOS: Beneficio[] = [
  {
    num: "I",
    titulo: "Só o que não bate",
    texto: "Em minutos o Ledgr confere linha por linha e aponta só o que não bate.",
    itens: [
      "O relatório fica pronto em minutos depois que você sobe os arquivos",
      "Os dois extratos lado a lado, como na conferência à mão",
      "Cada linha já vem marcada",
      "Você revisa só o que não bate, já com o motivo",
    ],
    demonstracao: "linhas",
  },
  {
    num: "II",
    titulo: "O motivo de cada diferença",
    texto: "Cada divergência vem com o motivo mais provável, e o que corrigir fica por sua conta.",
    itens: [
      `${QUANTAS_CATEGORIAS} categorias de divergência, sempre nomeadas`,
      "Cada caso com a categoria e o motivo provável",
      "Aceitar o valor do banco ou corrigir no sistema continua sendo decisão sua",
      "O extrato do banco é sempre a fonte da verdade",
    ],
    demonstracao: "explicacao",
  },
  {
    num: "III",
    titulo: "Sem trocar de sistema",
    texto: "O Ledgr usa o que o seu sistema de gestão já exporta. Você sobe dois arquivos: o extrato do banco e o do sistema.",
    itens: [
      "Extrato do banco em OFX ou CSV, direto do internet banking",
      "Razão do ERP ou do sistema de gestão em CSV",
      "Nenhuma credencial bancária",
      "CSV em outro formato: você aponta as colunas na importação",
    ],
    demonstracao: "arquivos",
  },
  {
    num: "IV",
    titulo: "O relatório para o contador",
    texto: "O relatório de cada conciliação sai em CSV, pronto para mandar ao contador.",
    itens: [
      `As divergências nas ${QUANTAS_CATEGORIAS.toLowerCase()} categorias, cada uma com o motivo`,
      "Mais de um banco: uma conciliação para cada conta",
      "Em Fechamentos, as conciliações do mesmo mês aparecem juntas",
    ],
    demonstracao: "relatorio",
  },
];

function SeloDaLinha({ linha }: { linha: LinhaExtrato }) {
  const selo = seloDoStatus(linha.status);
  return <span className={`selo selo-${selo.tom}`}>{selo.rotulo}</span>;
}

/** I: as linhas do mês, uma de cada veredito (duas com o mesmo selo diriam a mesma coisa). */
function LinhasMarcadas({ banco, periodo }: { banco: LinhaExtrato[]; periodo: string }) {
  const linhas = banco.filter((linha, i) => banco.findIndex((outra) => outra.status === linha.status) === i);
  return (
    <div className="amostra">
      <div className="amostra-topo">
        <span className="amostra-rotulo">{periodo}</span>
        <span className="amostra-rotulo">Extrato do banco</span>
      </div>
      <ul className="amostra-linhas">
        {linhas.map((linha) => (
          // a que bate fica apagada: o que o card promete é o resto
          <li key={linha.desc} data-bate={estaResolvida(linha.status) || undefined}>
            <span className="amostra-data">{linha.data}</span>
            <span className="amostra-desc">{linha.desc}</span>
            <SeloDaLinha linha={linha} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** II: a linha em destaque com o motivo, como no cartão do hover do app, com o selo da IA. */
function Explicacao({ linha }: { linha: LinhaExtrato | undefined }) {
  if (!linha) return null;
  return (
    <div className="amostra">
      <div className="amostra-topo">
        <span className="amostra-data">{linha.data}</span>
        <SeloDaLinha linha={linha} />
      </div>
      <div className="amostra-titulo">{linha.desc}</div>
      <div className="amostra-valores">
        <div>
          <span className="amostra-rotulo">Banco</span>
          <span className="amostra-valor">{linha.valorBanco}</span>
        </div>
        <div>
          <span className="amostra-rotulo">Sistema</span>
          <span className="amostra-valor">{linha.valorSistema}</span>
        </div>
      </div>
      {linha.explicacao && (
        <div className="amostra-explicacao">
          <SeloIa />
          <p>{linha.explicacao}</p>
        </div>
      )}
    </div>
  );
}

/** III: os dois arquivos de uma conciliação, nas duas folhas do app; no hover elas se afastam. */
function DoisArquivos() {
  return (
    <div className="amostra-folhas">
      <div className="amostra-folha amostra-folha-sistema">
        <span className="amostra-folha-cab">
          <IconeOrigem origem="sistema" tamanho={16} />
          Extrato do sistema
        </span>
        <span className="amostra-folha-formato">CSV</span>
        <span className="amostra-folha-linhas" />
      </div>
      <div className="amostra-folha amostra-folha-banco">
        <span className="amostra-folha-cab">
          <IconeOrigem origem="banco" tamanho={16} />
          Extrato do banco
        </span>
        <span className="amostra-folha-formato">OFX ou CSV</span>
        <span className="amostra-folha-linhas" />
      </div>
    </div>
  );
}

/** IV: o resumo do mês, o mesmo do cartão do hero, como o relatório que vai para o contador. */
function Relatorio({ resumo }: { resumo: ResumoDoMes }) {
  return (
    <div className="amostra">
      <div className="amostra-topo">
        <span className="amostra-rotulo">{resumo.periodo}</span>
        <span className="amostra-formato">CSV</span>
      </div>
      <div className="amostra-numero">
        <strong className="numero-destaque">{resumo.conciliado}</strong>
        <span>conciliado</span>
      </div>
      <div className="amostra-barra">
        <span style={{ width: resumo.conciliado.replace(",", ".") }} />
        <span />
      </div>
      <div className="amostra-nota">{resumo.paraRevisar}</div>
    </div>
  );
}

function CartaoBeneficio({ beneficio, children }: { beneficio: Beneficio; children: ReactNode }) {
  const idTitulo = `beneficio-${beneficio.num}`;
  return (
    // tabIndex: quem navega pelo teclado também abre o card (o :focus-within do globals.css)
    <article className="beneficio" tabIndex={0} aria-labelledby={idTitulo}>
      <div className="beneficio-texto">
        <h3 id={idTitulo} className="beneficio-titulo">
          {beneficio.titulo}
        </h3>
        <span className="beneficio-filete" aria-hidden="true" />
        <p className="beneficio-desc">{beneficio.texto}</p>
        <ul className="beneficio-lista">
          {beneficio.itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {/* a demonstração é desenho do produto, com valores soltos: o leitor de tela fica com o texto */}
      <div className="beneficio-visual" aria-hidden="true">
        {children}
      </div>
    </article>
  );
}

/** Onde o fio termina: os planos pelo volume do mês, lado a lado (de pé no celular). */
function ReguaDePlanos() {
  return (
    <Reveal viewport={NA_PONTA_DO_FIO} className="preco-regua">
      <div className="preco-regua-topo">
        <p id="preco-regua-titulo" className="preco-rotulo">
          Os planos
        </p>
        <span className="preco-regua-nota">pelo volume de lançamentos do mês</span>
      </div>
      <ol className="preco-regua-planos" aria-labelledby="preco-regua-titulo">
        {PLANOS.map((plano, i) => (
          <li
            key={plano.nome}
            className="preco-regua-plano"
            data-destaque={plano.destaque || undefined}
            data-contato={plano.contato || undefined}
          >
            {/* o traço da régua já está lá; os planos entram nele da esquerda para a direita */}
            <Reveal viewport={NA_PONTA_DO_FIO} delay={0.08 + i * 0.07}>
              <span className="numero-destaque preco-regua-num">{plano.volume}</span>
              <span className="preco-regua-nome">{plano.nome}</span>
              <span className="preco-regua-limite">{plano.limite}</span>
            </Reveal>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

/** `children` é o título da seção, que fica parado ao lado dos cards no desktop. */
export function Precos({
  banco,
  destaque,
  resumo,
  children,
}: {
  banco: LinhaExtrato[];
  /** A descrição da linha que o card II explica (a #1082 que a página inteira acompanha). */
  destaque: string;
  resumo: ResumoDoMes;
  children: ReactNode;
}) {
  const demonstracoes: Record<Demonstracao, ReactNode> = {
    linhas: <LinhasMarcadas banco={banco} periodo={resumo.periodo} />,
    explicacao: <Explicacao linha={banco.find((linha) => linha.desc === destaque)} />,
    arquivos: <DoisArquivos />,
    relatorio: <Relatorio resumo={resumo} />,
  };

  return (
    <div className="preco">
      {/* título e cards num bloco só, sem a régua: o sticky anda dentro do pai, então o título para
          quando os cards acabam, em vez de descer por cima da régua */}
      <div className="preco-passagem">
        <Reveal className="preco-topo">
          {children}
          {/* no toque não existe hover, e o card já vem aberto: a dica não tem o que pedir */}
          <DicaDoMouse className="so-mouse preco-dica">Passe o mouse sobre um card para ver tudo o que vem nele</DicaDoMouse>
        </Reveal>
        <div>
          <p className="preco-rotulo preco-rotulo-trilha">Em todo plano</p>
          <div className="preco-percurso">
            <FioDaTrilha ponta={PONTA_DO_FIO} className="preco-fio" />
            <ol className="preco-trilha">
              {BENEFICIOS.map((beneficio) => (
                <li key={beneficio.num} className="preco-etapa">
                  <Reveal viewport={NA_PONTA_DO_FIO} className="preco-etapa-corpo">
                    <span className="preco-num" aria-hidden="true">
                      {beneficio.num}
                    </span>
                    <CartaoBeneficio beneficio={beneficio}>{demonstracoes[beneficio.demonstracao]}</CartaoBeneficio>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <ReguaDePlanos />
    </div>
  );
}
