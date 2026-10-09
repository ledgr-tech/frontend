import Image from "next/image";
import Link from "next/link";

import { DIVERGENCIAS } from "@/lib/adaptadores";
import { depoimentosDaLanding } from "@/lib/depoimentos";
import { LogoBarras } from "@/app/(app)/logo-barras";
import { CabecalhoSite } from "./cabecalho-site";
import { CATEGORIAS, QUANTAS_CATEGORIAS } from "./categorias";
import { ExtratoComparacao, type LinhaExtrato } from "./comparacao";
import { Depoimentos } from "./depoimentos";
import { DicaDoMouse } from "./dica-do-mouse";
import { InkHover, MotionRoot, Reveal } from "../reveal";
import { fonteDestaque } from "./fonte-destaque";
import { PorDentro } from "./por-dentro";
import { Precos, type ResumoDoMes } from "./precos";
import { RedesSociais } from "./redes-sociais";

// O agosto da demonstração: o cartão do hero e o relatório do último card de Preços mostram o
// mesmo mês, com os mesmos números
const AGOSTO: ResumoDoMes = { periodo: "Agosto · 2026", conciliado: "96,3%", paraRevisar: "157 de 4.218 para revisar" };

// A faixa logo abaixo do hero, só com o que é quantidade, e por extenso: algarismo solto em
// tamanho grande ficava com cara de letra. Abre com o argumento central do pitch (não trocar de
// sistema); o zero de credenciais bancárias continua na FAQ e no rodapé. "Alto volume" e
// "Automático" não eram número.
const NUMEROS = [
  { valor: "Zero", rotulo: "sistemas para trocar: o Ledgr usa o que o seu sistema de gestão já exporta" },
  { valor: "Minutos", rotulo: "para o relatório ficar pronto depois que você sobe os arquivos" },
  { valor: QUANTAS_CATEGORIAS, rotulo: "categorias de divergência, sempre nomeadas" },
];

// ponytail: as `explicacao` desta demonstração são no estilo da IA, que estará
// ligada no lançamento (hoje está desligada em produção, e o produto mostra o
// motivo fixo do motor). Aparecem com o selo de IA, como no produto: decidido em
// 01/10 no DESIGN.md ("Dívidas pontuais anotadas pelo caminho"). Se o lançamento
// for sem IA, troque pelos motivos fixos.
// Lançamentos que aparecem, com os mesmos valores, nos dois extratos.
// Agosto/2026: mês já fechado (hoje é setembro/2026), coerente com o rótulo do hero.
const TRANSACOES_CASADAS: LinhaExtrato[] = [
  {
    data: "03/08",
    desc: "Recebimento cliente Alfa Comércio",
    valorBanco: "R$ 3.250,00",
    valorSistema: "R$ 3.250,00",
    status: "match_exato",
    explicacao: null,
  },
  {
    data: "04/08",
    desc: "Pagamento fornecedor #1082",
    valorBanco: "R$ 12.640,00",
    valorSistema: "R$ 12.604,00",
    status: "divergente_valor",
    explicacao:
      "O banco descontou R$ 36,00 de juros por atraso no boleto; o sistema ainda mostra o valor original da emissão.",
  },
  {
    data: "05/08",
    desc: "Crédito cartão D+30",
    valorBanco: "R$ 7.912,45",
    valorSistema: "R$ 7.912,40",
    status: "divergente_valor",
    explicacao: "Diferença de R$ 0,05: taxa de arredondamento aplicada pela operadora do cartão.",
  },
];

// Mesma descrição e mesmo valor dos dois lados, só que em dias diferentes —
// por isso os dois aparecem como "Mesmo valor em outra data", não como ausência.
const ALUGUEL_EXPLICACAO =
  "O banco debitou em 11/08; o sistema lançou a mesma despesa em 12/08. Mesmo valor, datas diferentes. O Ledgr não junta as duas automaticamente.";

const ALUGUEL_BANCO: LinhaExtrato = {
  data: "11/08",
  desc: "Aluguel sede agosto",
  valorBanco: "R$ 9.800,00",
  valorSistema: "R$ 9.800,00",
  status: "divergente_data",
  explicacao: ALUGUEL_EXPLICACAO,
};

const ALUGUEL_SISTEMA: LinhaExtrato = {
  data: "12/08",
  desc: "Aluguel sede agosto",
  valorBanco: "R$ 9.800,00",
  valorSistema: "R$ 9.800,00",
  status: "divergente_data",
  explicacao: ALUGUEL_EXPLICACAO,
};

// Tarifa só do lado do banco: o motor a separa das outras sobras como
// "Tarifa bancária", a sobra que ele já sabe explicar.
const TARIFA_BANCO: LinhaExtrato = {
  data: "06/08",
  desc: "Tarifa de manutenção da conta",
  valorBanco: "R$ 45,00",
  valorSistema: null,
  status: "tarifa_bancaria",
  explicacao: "O banco cobrou essa tarifa em 06/08; ainda não há lançamento correspondente no sistema.",
};

const EXTRATO_BANCO: LinhaExtrato[] = [...TRANSACOES_CASADAS, TARIFA_BANCO, ALUGUEL_BANCO];
const EXTRATO_SISTEMA: LinhaExtrato[] = [...TRANSACOES_CASADAS, ALUGUEL_SISTEMA];

const PASSOS = [
  {
    num: "I",
    titulo: "Suba o extrato do banco",
    texto: "OFX ou CSV, direto do internet banking. Quando os dois lados discordam, vale o que está nesse extrato.",
  },
  {
    num: "II",
    titulo: "Suba o extrato do sistema",
    texto: "Exporte o razão do seu ERP ou sistema de gestão no mesmo período, em CSV.",
  },
  {
    num: "III",
    titulo: "Receba as divergências",
    texto: `Relatório nas ${DIVERGENCIAS.length} categorias: ${CATEGORIAS}.`,
  },
];

// "Por que o Ledgr", dentro do Cap. II: as duas saídas que a empresa tem hoje, num grupo, e o
// Ledgr no outro, cada uma respondendo às mesmas perguntas, na ordem de ASPECTOS. Por tipo de
// solução, sem nome de concorrente: a página não tem como sustentar o que cada produto faz ou deixa
// de fazer.
const ASPECTOS = ["Trocar de sistema", "Quem confere, todo mês", "Para começar", "O que custa"];

// cada resposta é [o que responde à pergunta, o resto da frase]: o primeiro trecho vai em negrito,
// e lendo só os negritos de uma linha dá para comparar as três saídas
type Resposta = [destaque: string, resto?: string];

type Saida = { nome: string; respostas: Resposta[] };

const SAIDAS_DE_HOJE: Saida[] = [
  {
    nome: "Conferir à mão",
    respostas: [
      ["Não precisa."],
      ["Alguém que entenda de contabilidade", ", linha por linha, com as duas telas abertas."],
      ["A planilha de sempre."],
      ["As horas de quem confere", ", em todo fechamento."],
    ],
  },
  {
    nome: "Migrar para um sistema com conciliação",
    respostas: [
      ["Precisa.", " A empresa inteira passa para o sistema novo."],
      ["O sistema novo", ", depois que tudo estiver nele."],
      ["Migrar cadastros, contas e histórico", ", e treinar a equipe."],
      ["A mensalidade do sistema novo", ", mais o trabalho da migração."],
    ],
  },
];

const SAIDA_LEDGR: Saida = {
  nome: "Ledgr",
  respostas: [
    ["Não precisa.", " Funciona com o sistema que você já usa."],
    ["O Ledgr, linha por linha", ": você revisa só o que não bate, já com o motivo."],
    ["Subir dois arquivos", ": o extrato do banco e o do sistema."],
    ["Pelo volume de lançamentos do mês", ", sem fidelidade nem taxa de implantação."],
  ],
};

function ColunaSaida({ saida, destaque = false, delay }: { saida: Saida; destaque?: boolean; delay: number }) {
  return (
    <Reveal delay={delay} className={destaque ? "por-que-coluna por-que-destaque" : "por-que-coluna"}>
      <h3 className="por-que-nome">
        {destaque && <LogoBarras className="por-que-logo" />}
        {saida.nome}
      </h3>
      <dl className="por-que-itens">
        {ASPECTOS.map((aspecto, i) => (
          <div key={aspecto}>
            <dt>{aspecto}</dt>
            <dd>
              <strong>{saida.respostas[i][0]}</strong>
              {saida.respostas[i][1]}
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}

const PERGUNTAS = [
  {
    pergunta: "Preciso instalar algo no meu banco?",
    resposta:
      "Não. O Ledgr lê o arquivo que o internet banking já exporta, em OFX ou CSV, e não pede nenhuma credencial bancária.",
  },
  {
    // só o que a política de privacidade (seção Segurança e "Por quanto tempo") já afirma
    pergunta: "É seguro subir os meus extratos?",
    resposta: (
      <>
        O Ledgr não pede nenhuma credencial bancária, e o arquivo que você sobe não fica guardado: ficam os
        lançamentos lidos dele, que só a sua empresa vê. Os registros do servidor não guardam o valor nem a
        descrição completa dos lançamentos. Os detalhes estão na{" "}
        <Link href="/privacidade#seguranca">política de privacidade</Link>.
      </>
    ),
  },
  {
    pergunta: "E se o CSV do meu sistema vier em outro formato?",
    resposta:
      "Funciona também: na importação você aponta qual coluna é data, descrição e valor, e o Ledgr ajusta o arquivo. Por enquanto, esse passo se repete a cada importação.",
  },
  {
    pergunta: "Quem decide o que é divergência?",
    resposta:
      "Você. O Ledgr mostra cada caso com a categoria e o motivo provável, mas aceitar o valor do banco ou corrigir no sistema é decisão sua.",
  },
  {
    pergunta: "O contador consegue acessar?",
    resposta:
      "Ainda não tem acesso próprio: hoje cada empresa tem um login só. Mas o relatório de cada conciliação sai em CSV, pronto para mandar ao contador.",
  },
  {
    pergunta: "Consigo conciliar mais de um banco ao mesmo tempo?",
    resposta:
      "Sim, uma conta por vez: cada conciliação cruza o extrato de uma conta com o do sistema no mesmo período, então exporte do sistema só os lançamentos daquela conta. Em Fechamentos, as conciliações do mesmo mês aparecem juntas.",
  },
  {
    pergunta: "Existe fidelidade ou taxa de implantação?",
    resposta:
      "Não. Você paga só pelo volume de lançamentos conferidos no mês, sem contrato de fidelidade, taxa de implantação ou cobrança por usuário adicional.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta:
      "Sim, sem multa nem aviso prévio: é só pedir por e-mail. E por enquanto ninguém paga nada, porque a cobrança ainda não está no ar.",
  },
];

const RODAPE_COLUNAS = [
  {
    titulo: "Produto",
    itens: [
      { rotulo: "Por que o Ledgr", href: "#por-que" },
      { rotulo: "Como funciona", href: "#como" },
      { rotulo: "Regra de ouro", href: "#regra" },
      { rotulo: "Perguntas", href: "#perguntas" },
    ],
  },
  {
    titulo: "Empresa",
    itens: [
      { rotulo: "Assinatura", href: "#preco" },
      { rotulo: "Contato", href: "mailto:ledgrtech@gmail.com" },
      { rotulo: "Segurança", href: "/privacidade#seguranca" },
    ],
  },
  {
    titulo: "Legal",
    itens: [
      { rotulo: "Termos de uso", href: "/termos" },
      { rotulo: "Privacidade", href: "/privacidade" },
      { rotulo: "LGPD", href: "/privacidade#direitos" },
    ],
  },
];

export default function LandingPage() {
  const depoimentos = depoimentosDaLanding();
  return (
    <main className={fonteDestaque.variable}>
      <MotionRoot>
      <CabecalhoSite />

      {/* hero */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        {/* SVG em linha, não <img>: a marca d'água quase invisível era a maior imagem do topo e
            virava o LCP no celular, esperando o JavaScript para pintar */}
        <LogoBarras className="hero-marca" />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(to right, var(--color-divider) 1px, transparent 1px)",
            backgroundSize: "25% 100%",
            opacity: 0.55,
          }}
        />
        <div
          className="hero-grid"
          style={{
            position: "relative",
            maxWidth: 1600,
            margin: "0 auto",
            padding: "clamp(56px, 9vw, 108px) clamp(20px, 4.2vw, 56px) clamp(56px, 8vw, 96px)",
            display: "grid",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
              <span
                className="eyebrow"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-accent-700)",
                }}
              >
                Cap. I · O fechamento do mês
              </span>
              <span style={{ flex: 1, maxWidth: 120, height: 1, background: "var(--color-divider)" }} />
            </div>
            <h1 className="titulo-misto" style={{ margin: "0 0 24px", fontSize: "clamp(40px, 4.4vw, 72px)" }}>
              Pare de conciliar extrato <em>à mão.</em>
            </h1>
            <div style={{ width: 84, height: 1, background: "var(--color-accent)", marginBottom: 26 }} />
            <p
              style={{
                margin: "0 0 34px",
                fontSize: "clamp(16px, 1.2vw, 19px)",
                lineHeight: 1.72,
                maxWidth: "44ch",
              }}
            >
              Continue no sistema de gestão que você já usa. Suba o extrato do banco e o do sistema:
              em minutos o Ledgr confere linha por linha e aponta só o que não bate, com o motivo de
              cada diferença.
            </p>
            <Link href="/cadastro" className="btn btn-primary" style={{ fontSize: 15.5, padding: "13px 24px" }}>
              Começar agora
            </Link>
          </div>
          <InkHover
            clip={false}
            className="hero-illustration"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Image
              src="/mascotes/mascote-apresenta.png"
              alt="Mascote Ledgr com prancheta de conciliação e dinheiro"
              width={824}
              height={720}
              sizes="(max-width: 680px) 90vw, 440px"
              preload
              style={{ position: "relative", zIndex: 1, width: "96%", maxWidth: 440, height: "auto" }}
            />
            <div
              className="hero-stat-card"
              style={{
                alignSelf: "flex-start",
                marginTop: 28,
                width: "min(246px, 100%)",
                padding: "16px 18px",
                border: "1px solid var(--color-accent)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
                  marginBottom: 8,
                }}
              >
                {AGOSTO.periodo}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span className="numero-destaque" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1 }}>
                  {AGOSTO.conciliado}
                </span>
                <span style={{ fontSize: 13.5, color: "color-mix(in srgb, var(--color-text) 68%, transparent)" }}>
                  conciliado
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  border: "1px solid var(--color-divider)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                <div style={{ width: AGOSTO.conciliado.replace(",", "."), background: "var(--color-neutral-300)" }} />
                <div style={{ flex: 1, background: "var(--color-accent)" }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 68%, transparent)" }}>
                {AGOSTO.paraRevisar}
              </div>
            </div>
          </InkHover>
        </div>
      </section>

      {/* em números */}
      <section
        className="onda onda-papel grao"
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: "var(--faixa-escura)",
        }}
      >
        {/* marca em traço fino, cortada na borda esquerda */}
        <svg
          aria-hidden="true"
          className="numeros-marca"
          viewBox="0 0 2000 1627"
          fill="none"
          style={{
            position: "absolute",
            top: -50,
            left: -80,
            width: "clamp(220px, 22vw, 380px)",
            height: "auto",
            color: "var(--color-accent-700)",
            opacity: 0.15,
            pointerEvents: "none",
          }}
        >
          <g stroke="currentColor" strokeWidth={3}>
            <rect x="60" y="43" width="1162" height="463" rx="231.5" vectorEffect="non-scaling-stroke" />
            <rect x="76" y="560" width="1896" height="463" rx="231.5" vectorEffect="non-scaling-stroke" />
            <rect x="43" y="1060" width="1629" height="463" rx="231.5" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        <div style={{ position: "relative", maxWidth: 1600, margin: "0 auto", padding: "clamp(52px, 7vw, 72px) clamp(20px, 4.2vw, 56px)" }}>
          <div className="grade-colunas numeros-grade">
            {NUMEROS.map((numero, i) => (
              <Reveal
                key={numero.rotulo}
                delay={i * 0.08}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span
                  className="numero-destaque"
                  style={{
                    fontSize: "clamp(36px, 3.4vw, 46px)",
                    fontWeight: 400,
                    lineHeight: 1,
                    color: "var(--color-neutral-100)",
                  }}
                >
                  {numero.valor}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-neutral-400)" }}>{numero.rotulo}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* o problema, numa seção só: como é feito hoje (a dor, e as duas saídas de sempre), onde o
          Ledgr entra (a terceira coluna) e, na prática, as mesmas duas telas conferidas por ele */}
      <section id="problema" className="onda onda-escura">
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "clamp(64px, 9vw, 96px) clamp(20px, 4.2vw, 56px)" }}>
          <Reveal>
            {/* título e texto empilhados: um recado só, lido de cima para baixo */}
            <InkHover style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 42 }}>
              <div>
                <p className="eyebrow" style={{ margin: "0 0 12px", color: "var(--color-accent-700)" }}>Cap. II · O jeito de hoje</p>
                <h2 className="titulo-misto" style={{ margin: 0, fontSize: "clamp(30px, 2.8vw, 46px)" }}>
                  Duas telas abertas, um dedo em <em>cada linha.</em>
                </h2>
              </div>
              <p
                style={{
                  margin: 0,
                  maxWidth: "62ch",
                  fontSize: 15.5,
                  lineHeight: 1.75,
                }}
              >
                Conferir o extrato do banco contra o extrato do sistema de gestão linha a linha é lento,
                cansa e deixa passar erro. Quanto maior o volume de lançamentos, pior fica. E o mês
                fecha sempre no aperto.
              </p>
            </InkHover>
          </Reveal>
          {/* como é feito hoje, e onde o Ledgr entra. Os rótulos de grupo dão nome às colunas para o
              leitor de tela (role="group"), e a grade alinha as respostas pela pergunta (globals.css) */}
          <div id="por-que" className="por-que-grade">
            <div className="por-que-grupo" role="group" aria-labelledby="por-que-hoje">
              <Reveal className="problema-rotulo">
                <span id="por-que-hoje">Hoje</span>
              </Reveal>
              {SAIDAS_DE_HOJE.map((saida, i) => (
                <ColunaSaida key={saida.nome} saida={saida} delay={0.06 + i * 0.06} />
              ))}
            </div>
            <div className="por-que-grupo por-que-grupo-ledgr" role="group" aria-labelledby="por-que-com-ledgr">
              <Reveal delay={0.12} className="problema-rotulo problema-rotulo-ledgr">
                <span id="por-que-com-ledgr">Com o Ledgr</span>
              </Reveal>
              <ColunaSaida saida={SAIDA_LEDGR} destaque delay={0.18} />
            </div>
          </div>
          {/* na prática: a demonstração é o resultado do Ledgr (os selos e os motivos são dele), sobre
              as mesmas duas telas da conferência à mão */}
          <Reveal className="problema-pratica">
            <p className="problema-rotulo problema-rotulo-ledgr">Na prática</p>
            <h3 className="problema-pratica-titulo">As mesmas duas telas, conferidas pelo Ledgr.</h3>
            <p className="problema-pratica-texto">
              Os dois extratos de agosto lado a lado, como na conferência à mão. A diferença é que cada
              linha já vem marcada, e as que não batem vêm com o motivo.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ExtratoComparacao banco={EXTRATO_BANCO} sistema={EXTRATO_SISTEMA} />
          </Reveal>
          <Reveal delay={0.15}>
            {/* dica de hover: as linhas divergentes do comparativo abrem detalhes */}
            <DicaDoMouse style={{ justifyContent: "center", margin: "22px 0 0" }}>
              <span className="so-mouse">Passe o mouse sobre as linhas</span>
              <span className="so-toque">Toque nas linhas</span> para ver os detalhes
            </DicaDoMouse>
          </Reveal>
        </div>
      </section>

      {/* como funciona */}
      <section id="como" className="onda onda-papel" style={{ position: "relative", overflow: "hidden", background: "var(--color-surface)" }}>
        {/* marca d'água no canto de baixo à esquerda, oposto ao mascote visível (como na FAQ),
            saindo pelas bordas: atrás do título ela competia com ele */}
        <Image
          src="/mascotes/mascote-explicando.png"
          alt=""
          aria-hidden="true"
          width={1000}
          height={1000}
          sizes="480px"
          className="como-marca"
          style={{ position: "absolute", bottom: -170, left: -70, width: 480, height: "auto", opacity: 0.04, pointerEvents: "none" }}
        />
        <div style={{ position: "relative", maxWidth: 1600, margin: "0 auto", padding: "clamp(64px, 9vw, 96px) clamp(20px, 4.2vw, 56px)" }}>
          <Reveal>
            <InkHover
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "24px 48px",
                marginBottom: 42,
              }}
            >
              <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                <p className="eyebrow" style={{ margin: "0 0 12px", color: "var(--color-accent-700)" }}>Cap. III · Como funciona</p>
                <h2 className="titulo-misto" style={{ margin: 0, fontSize: "clamp(30px, 2.8vw, 46px)" }}>
                  Três passos. A conferência linha por linha fica <em>com o Ledgr.</em>
                </h2>
              </div>
              <Image
                src="/mascotes/mascote-explicando.png"
                alt="Mascote Ledgr explicando"
                width={1000}
                height={1000}
                // o mesmo sizes da marca d'água desta seção: as duas pegam a mesma largura do srcset,
                // e a imagem baixa uma vez só
                sizes="480px"
                className="como-mascote"
                style={{ flex: "none", width: 240, height: "auto" }}
              />
            </InkHover>
          </Reveal>
          <div className="grade-colunas passos-grade" style={{ borderTop: "1px solid var(--color-divider)" }}>
            {PASSOS.map((passo, i) => (
              <Reveal
                key={passo.num}
                delay={i * 0.06}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 40,
                      fontWeight: 400,
                      lineHeight: 1,
                      color: "var(--color-accent)",
                    }}
                  >
                    {passo.num}
                  </span>
                  <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
                </div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
                  {passo.titulo}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.72 }}>
                  {passo.texto}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* por dentro do ledgr: o que chega depois do terceiro passo, contado pela vida de uma
          linha, a #1082 de "O problema", até o sistema de gestão, e a tela inteira do app embaixo.
          overflow: clip, e não hidden: hidden faria da seção o contêiner de rolagem do título
          parado (sticky), e ele deixaria de grudar */}
      <section
        id="por-dentro"
        className="onda onda-superficie grao-claro"
        style={{ position: "relative", overflow: "clip", backgroundColor: "var(--faixa-clara)" }}
      >
        <div style={{ position: "relative", maxWidth: 1600, margin: "0 auto", padding: "clamp(64px, 9vw, 96px) clamp(20px, 4.2vw, 56px)" }}>
          <div className="por-dentro">
            <PorDentro banco={EXTRATO_BANCO} sistema={EXTRATO_SISTEMA}>
              <h2 className="titulo-misto por-dentro-intro">
                Cada lançamento, do extrato <em>ao seu sistema.</em>
              </h2>
            </PorDentro>
          </div>
        </div>
      </section>

      {/* regra de ouro */}
      <section id="regra" className="onda onda-faixa-clara">
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "clamp(64px, 9vw, 96px) clamp(20px, 4.2vw, 56px)" }}>
          <Reveal>
            <InkHover
              className="regra-card"
              style={{
                border: "1px solid var(--color-accent)",
                borderRadius: "var(--radius-md)",
                padding: "42px 46px",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "start",
                textAlign: "center",
                columnGap: 24,
              }}
            >
              <div
                className="font-display regra-icon"
                style={{
                  fontSize: 82,
                  fontWeight: 400,
                  lineHeight: 1,
                  color: "var(--color-accent)",
                }}
              >
                §
              </div>
              <div>
                <h2 className="titulo-misto" style={{ margin: "0 0 12px", fontSize: "clamp(26px, 2.4vw, 42px)" }}>
                  O extrato do banco é sempre <em>a fonte da verdade.</em>
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15.5,
                    lineHeight: 1.75,
                  }}
                >
                  O Ledgr aponta toda divergência do mesmo lado: é o sistema que difere do banco.
                  Assim ninguém discute qual número vale, e fica claro o que corrigir no seu
                  sistema de gestão.
                </p>
              </div>
              <div className="font-display regra-icon regra-icon-mirror" aria-hidden style={{ fontSize: 82, lineHeight: 1, visibility: "hidden" }}>
                §
              </div>
            </InkHover>
          </Reveal>
        </div>
      </section>

      {/* depoimentos, onde o export do Claude Design os punha: no site publicado só aparece quando há
          depoimento real; os de exemplo, só no preview e no local (lib/depoimentos.ts) */}
      <Depoimentos depoimentos={depoimentos} />

      {/* perguntas, com o mascote que lia o panfleto no antigo convite: o convite repetia o que os
          passos, os números e a FAQ já diziam, e saiu. O fundo de superfície também veio dele, para
          as faixas continuarem alternando (a onda de cima é a cor da seção anterior: a faixa escura
          dos depoimentos, ou a Regra de ouro, papel, enquanto não há depoimento) */}
      <section
        id="perguntas"
        className={depoimentos.length > 0 ? "onda onda-escura" : "onda onda-papel"}
        style={{ position: "relative", overflow: "hidden", background: "var(--color-surface)" }}
      >
        <Image
          src="/mascotes/mascote-sentado.png"
          alt=""
          aria-hidden="true"
          width={1000}
          height={1000}
          sizes="480px"
          className="perguntas-marca"
          style={{ position: "absolute", bottom: 20, right: 24, width: 480, height: "auto", opacity: 0.04, pointerEvents: "none" }}
        />
        <div style={{ position: "relative", maxWidth: 1600, margin: "0 auto", padding: "clamp(64px, 9vw, 96px) clamp(20px, 4.2vw, 56px)" }}>
          <div className="perguntas-topo" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px 40px", marginBottom: 34 }}>
            <InkHover style={{ flex: "none" }}>
              <Image
                src="/mascotes/mascote-sentado.png"
                alt="Mascote Ledgr sentado lendo um panfleto"
                width={1000}
                height={1000}
                // o mesmo sizes da marca d'água desta seção, para a imagem baixar uma vez só
                sizes="480px"
                className="perguntas-mascote"
                style={{ width: 180, height: "auto", display: "block" }}
              />
            </InkHover>
            <Reveal
              className="perguntas-titulo"
              style={{ flex: "1 1 320px", minWidth: 0, paddingLeft: 32, borderLeft: "1px solid var(--color-accent)" }}
            >
              <h2 className="titulo-misto" style={{ margin: 0, fontSize: "clamp(26px, 2.4vw, 40px)" }}>
                Perguntas que <em>sempre aparecem</em>
              </h2>
              <span
                style={{
                  display: "block",
                  marginTop: 12,
                  fontSize: 14,
                  color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
                }}
              >
                Qualquer outra dúvida: ledgrtech@gmail.com
              </span>
            </Reveal>
          </div>
          <div style={{ maxWidth: "72ch", margin: "0 auto", borderTop: "1px solid var(--color-divider)" }}>
            {PERGUNTAS.map((item, i) => (
              <Reveal key={item.pergunta} delay={i * 0.05}>
                <details className="faq-item">
                  <summary className="faq-question">{item.pergunta}</summary>
                  <p className="faq-answer">{item.resposta}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* preço: o que vem em todo plano, numa trilha vertical como a de "Por dentro", até a régua dos
          planos, e o convite embaixo. overflow: clip, e não hidden: hidden faria da seção o contêiner
          de rolagem do título parado (sticky), e ele deixaria de grudar */}
      <section
        id="preco"
        className="onda onda-superficie grao"
        style={{ position: "relative", overflow: "clip", backgroundColor: "var(--faixa-escura)" }}
      >
        {/* marca d'água atrás dos botões, saindo pela borda de baixo: no meio da seção ela ficaria
            atrás dos cards */}
        <Image
          src="/mascotes/mascote-comemorando.png"
          alt=""
          aria-hidden="true"
          width={1000}
          height={1000}
          sizes="480px"
          className="preco-mascote"
        />
        <div className="preco-conteudo">
          <Precos banco={EXTRATO_BANCO} destaque="Pagamento fornecedor #1082" resumo={AGOSTO}>
            <span className="eyebrow preco-capitulo">Cap. IV · Começar</span>
            <h2 className="titulo-misto preco-titulo">
              Preço fechado, <em>por volume.</em>
            </h2>
            <div className="preco-filete" aria-hidden="true" />
            <p className="preco-texto">
              Você paga pelo número de lançamentos que conferir no mês. Não tem fidelidade, taxa de
              implantação nem cobrança por usuário.
            </p>
          </Precos>
          <div className="preco-acoes">
            <Link
              href="/cadastro"
              className="btn btn-primary"
              style={{
                fontSize: 15.5,
                padding: "13px 24px",
                borderColor: "var(--color-accent-400)",
                color: "var(--color-accent-300)",
              }}
            >
              Começar agora
            </Link>
            <Link href="/login" className="btn btn-ghost" style={{ fontSize: 15, color: "var(--color-neutral-300)" }}>
              Ver o sistema por dentro
            </Link>
          </div>
        </div>
      </section>

      {/* rodapé */}
      <footer className="onda onda-escura" style={{ background: "var(--color-surface)" }}>
        <div
          style={{
            maxWidth: 1600,
            margin: "0 auto",
            padding: "56px clamp(20px, 4.2vw, 56px) 28px",
            display: "flex",
            flexWrap: "wrap",
            gap: "32px 56px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Image src="/mascotes/logo-barras.png" alt="Ledgr" width={1237} height={998} sizes="30px" style={{ height: 24, width: "auto" }} />
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600 }}>Ledgr</span>
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.7, maxWidth: "40ch", color: "color-mix(in srgb, var(--color-text) 68%, transparent)" }}>
              Conciliação bancária sem planilha, para quem fecha o mês com o extrato na mão. Passo
              Fundo, RS.
            </span>
            <RedesSociais />
          </div>
          {RODAPE_COLUNAS.map((coluna) => (
            <div key={coluna.titulo} style={{ flex: "0 1 170px", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 68%, transparent)" }}>
                {coluna.titulo}
              </span>
              {coluna.itens.map((link) => (
                <a key={link.rotulo} href={link.href} style={{ fontSize: 14.5, paddingBlock: 3 }}>
                  {link.rotulo}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "24px clamp(20px, 4.2vw, 56px) 48px" }}>
          <div
            style={{
              borderTop: "1px solid var(--color-divider)",
              paddingTop: 16,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "8px 24px",
              fontSize: 13,
              color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
            }}
          >
            <span>© 2026 Ledgr · Passo Fundo, RS</span>
            <span>Lemos apenas os arquivos que você envia · nenhuma credencial bancária</span>
          </div>
        </div>
      </footer>
      </MotionRoot>
    </main>
  );
}
