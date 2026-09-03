import Image from "next/image";
import Link from "next/link";

import { ExtratoComparacao, type LinhaExtrato } from "./comparacao";
import { InkHover, MotionRoot, PlanCard, Reveal } from "./reveal";

const PROVAS_HERO = [
  { valor: "4+", rotulo: "bancos processados num só relatório" },
  { valor: "Alto volume", rotulo: "de lançamentos conferidos por mês, sem esforço extra" },
  { valor: "4", rotulo: "categorias de divergência, sempre nomeadas" },
];

const NUMEROS = [
  { valor: "Automático", rotulo: "a maior parte dos lançamentos casa sem precisar mexer em nada" },
  { valor: "minutos", rotulo: "para ter o relatório pronto após subir os arquivos" },
  { valor: "Sem instalar nada", rotulo: "nenhuma integração bancária pra configurar" },
];

// Lançamentos que aparecem, com os mesmos valores, nos dois extratos.
// Agosto/2026: mês já fechado (hoje é setembro/2026), coerente com o rótulo do hero.
const TRANSACOES_CASADAS: LinhaExtrato[] = [
  {
    data: "03/08",
    desc: "Recebimento cliente Alfa Comércio",
    valorBanco: "R$ 3.250,00",
    valorSistema: "R$ 3.250,00",
    status: "Batido",
    explicacao: null,
  },
  {
    data: "04/08",
    desc: "Pagamento fornecedor #1082",
    valorBanco: "R$ 12.640,00",
    valorSistema: "R$ 12.604,00",
    status: "Valor divergente",
    explicacao:
      "O banco descontou R$ 36,00 de juros por atraso no boleto; o sistema ainda mostra o valor original da emissão.",
  },
  {
    data: "05/08",
    desc: "Crédito cartão D+30",
    valorBanco: "R$ 7.912,45",
    valorSistema: "R$ 7.912,40",
    status: "Valor divergente",
    explicacao: "Diferença de R$ 0,05 — taxa de arredondamento aplicada pela operadora do cartão.",
  },
];

// Mesma descrição e mesmo valor dos dois lados, só que em dias diferentes —
// por isso os dois aparecem com o status "Data divergente", não como ausência.
const ALUGUEL_EXPLICACAO =
  "O banco debitou em 11/08; o sistema lançou a mesma despesa em 12/08. Mesmo valor, datas diferentes — o Ledgr não junta as duas automaticamente.";

const ALUGUEL_BANCO: LinhaExtrato = {
  data: "11/08",
  desc: "Aluguel sede agosto",
  valorBanco: "R$ 9.800,00",
  valorSistema: "R$ 9.800,00",
  status: "Data divergente",
  explicacao: ALUGUEL_EXPLICACAO,
};

const ALUGUEL_SISTEMA: LinhaExtrato = {
  data: "12/08",
  desc: "Aluguel sede agosto",
  valorBanco: "R$ 9.800,00",
  valorSistema: "R$ 9.800,00",
  status: "Data divergente",
  explicacao: ALUGUEL_EXPLICACAO,
};

// Lançamento só do lado do banco, sem par no sistema — ilustra a categoria
// "Sem correspondente" (que não tem exemplo entre as transações casadas acima).
const TARIFA_BANCO: LinhaExtrato = {
  data: "06/08",
  desc: "Tarifa de manutenção da conta",
  valorBanco: "R$ 45,00",
  valorSistema: null,
  status: "Sem correspondente",
  explicacao: "O banco cobrou essa tarifa em 06/08; ainda não há lançamento correspondente no sistema.",
};

const EXTRATO_BANCO: LinhaExtrato[] = [...TRANSACOES_CASADAS, TARIFA_BANCO, ALUGUEL_BANCO];
const EXTRATO_SISTEMA: LinhaExtrato[] = [...TRANSACOES_CASADAS, ALUGUEL_SISTEMA];

const PASSOS = [
  {
    num: "I",
    titulo: "Suba os extratos dos bancos",
    texto:
      "OFX ou CSV, direto do internet banking — de quantos bancos você usar. O Ledgr consolida tudo num só relatório; é ele que define a verdade da conciliação.",
  },
  {
    num: "II",
    titulo: "Suba o extrato do sistema",
    texto: "Exporte o razão do seu ERP ou sistema de gestão no mesmo período.",
  },
  {
    num: "III",
    titulo: "Receba as divergências",
    texto: "Relatório categorizado: sem correspondente, valor divergente, data divergente, duplicidade.",
  },
];

const PERGUNTAS = [
  {
    pergunta: "Preciso instalar algo no meu banco?",
    resposta:
      "Não. O Ledgr lê o arquivo que o internet banking já exporta — OFX ou CSV. Nenhuma credencial bancária é pedida.",
  },
  {
    pergunta: "E se o meu ERP não estiver na lista?",
    resposta:
      "Funciona também — é a única exceção que pede um passo a mais: na importação você aponta qual coluna é data, descrição e valor, uma única vez.",
  },
  {
    pergunta: "Quem decide o que é divergência?",
    resposta:
      "Você. O Ledgr aponta, nomeia e explica cada caso; aceitar o valor do banco ou corrigir no sistema é sempre uma decisão sua.",
  },
  {
    pergunta: "O contador consegue acessar?",
    resposta: "Sim, com o papel de leitor: abre relatório e histórico, não altera lançamento nenhum.",
  },
];

const PLANOS = [
  { nome: "Essencial", preco: "R$ 49,90", limite: "até 100 lançamentos por mês", destaque: false, contato: false },
  { nome: "Padrão", preco: "R$ 79,90", limite: "até 200 lançamentos por mês", destaque: true, contato: false },
  { nome: "Avançado", preco: "R$ 99,90", limite: "até 350 lançamentos por mês", destaque: false, contato: false },
  { nome: "Escala", preco: "R$ 149,90", limite: "até 5.000 lançamentos por mês", destaque: false, contato: false },
  {
    nome: "Volume",
    preco: "Sob consulta",
    limite: "acima de 5.000 — indústria e multi-banco",
    destaque: false,
    contato: true,
  },
];

const RODAPE_COLUNAS = [
  {
    titulo: "Produto",
    itens: [
      { rotulo: "Como funciona", href: "#como" },
      { rotulo: "Regra de ouro", href: "#regra" },
      { rotulo: "Perguntas", href: "#perguntas" },
    ],
  },
  {
    titulo: "Empresa",
    itens: [
      { rotulo: "Assinatura", href: "#preco" },
      { rotulo: "Contato", href: "mailto:ola@ledgr.com.br" },
      { rotulo: "Segurança", href: "#regra" },
    ],
  },
  {
    titulo: "Legal",
    itens: [
      { rotulo: "Termos de uso", href: "#preco" },
      { rotulo: "Privacidade", href: "#preco" },
      { rotulo: "LGPD", href: "#preco" },
    ],
  },
];

export default function LandingPage() {
  return (
    <main>
      <MotionRoot>
      {/* header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "16px clamp(16px, 3.5vw, 40px)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px 32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Image
              src="/mascotes/logo-barras.png"
              alt="Ledgr"
              width={2400}
              height={1952}
              priority
              style={{ height: 26, width: "auto" }}
            />
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 23, fontWeight: 600 }}>Ledgr</span>
            <span
              style={{
                paddingLeft: 12,
                borderLeft: "1px solid var(--color-divider)",
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
              }}
            >
              Conciliação bancária
            </span>
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 28px" }}>
            <a href="#problema" style={{ fontSize: 15, color: "var(--color-text)", textDecoration: "none" }}>
              O problema
            </a>
            <a href="#como" style={{ fontSize: 15, color: "var(--color-text)", textDecoration: "none" }}>
              Como funciona
            </a>
            <a href="#preco" style={{ fontSize: 15, color: "var(--color-text)", textDecoration: "none" }}>
              Assinatura
            </a>
            <Link href="/login" className="btn btn-ghost">
              Entrar
            </Link>
            <Link href="/login" className="btn btn-primary">
              Começar
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <Image
          src="/mascotes/logo-barras.png"
          alt=""
          aria-hidden="true"
          width={2400}
          height={1952}
          style={{
            position: "absolute",
            top: -70,
            right: -110,
            width: 640,
            height: "auto",
            opacity: 0.05,
            pointerEvents: "none",
          }}
        />
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
            maxWidth: 1440,
            margin: "0 auto",
            padding: "84px clamp(16px, 3.5vw, 40px) 72px",
            display: "grid",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
              <span
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
            <h1
              style={{
                margin: "0 0 24px",
                fontSize: "clamp(52px, 4.8vw, 88px)",
                fontWeight: 400,
                lineHeight: 1.02,
                letterSpacing: "-0.022em",
                textWrap: "balance",
              }}
            >
              Pare de conciliar extrato à mão.
            </h1>
            <div style={{ width: 84, height: 1, background: "var(--color-accent)", marginBottom: 26 }} />
            <p
              style={{
                margin: "0 0 34px",
                fontSize: "clamp(16px, 1.2vw, 19px)",
                lineHeight: 1.72,
                maxWidth: "44ch",
                textAlign: "justify",
                hyphens: "auto",
              }}
            >
              Suba o extrato do banco e o extrato do seu sistema de gestão. Em minutos você recebe o
              relatório do que bate e do que não bate — lançamento por lançamento, sem planilha no
              meio.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 34 }}>
              <Link
                href="/login"
                className="btn btn-primary"
                style={{ fontSize: 15.5, padding: "13px 24px" }}
              >
                Conciliar meu primeiro extrato
              </Link>
              <span
                style={{
                  fontSize: 14,
                  color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
                }}
              >
                OFX ou CSV, direto do internet banking
              </span>
            </div>
            <div
              className="hero-provas-grid"
              style={{
                display: "grid",
                borderTop: "1px solid var(--color-divider)",
              }}
            >
              {PROVAS_HERO.map((prova, i) => (
                <div
                  key={prova.rotulo}
                  style={{
                    padding: `18px 16px 0 ${i === 0 ? 0 : 16}px`,
                    borderLeft: i === 0 ? "none" : "1px solid var(--color-divider)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: 30,
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    {prova.valor}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                    }}
                  >
                    {prova.rotulo}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <InkHover
            clip={false}
            className="hero-illustration"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
            }}
          >
            <Image
              src="/mascotes/mascote-apresenta.png"
              alt="Mascote Ledgr com prancheta de conciliação e dinheiro"
              width={824}
              height={720}
              priority
              style={{ position: "relative", zIndex: 1, width: "96%", maxWidth: 440, height: "auto" }}
            />
            <div
              style={{
                position: "absolute",
                zIndex: 2,
                bottom: 4,
                left: 8,
                maxWidth: 246,
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
                  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                  marginBottom: 8,
                }}
              >
                Agosto · 2026
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 38, fontWeight: 600, lineHeight: 1 }}>
                  96,3%
                </span>
                <span style={{ fontSize: 13.5, color: "color-mix(in srgb, var(--color-text) 62%, transparent)" }}>
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
                <div style={{ width: "96.3%", background: "var(--color-neutral-300)" }} />
                <div style={{ flex: 1, background: "var(--color-accent)" }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                157 de 4.218 para revisar
              </div>
            </div>
          </InkHover>
        </div>
      </section>

      {/* em números */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderTop: "1px solid var(--color-divider)",
          background: "var(--color-neutral-900)",
        }}
      >
        <Image
          src="/mascotes/logo-barras.png"
          alt=""
          aria-hidden="true"
          width={2400}
          height={1952}
          style={{ position: "absolute", bottom: -90, left: 40, width: 300, height: "auto", opacity: 0.08, pointerEvents: "none" }}
        />
        <div style={{ position: "relative", maxWidth: 1440, margin: "0 auto", padding: "54px clamp(16px, 3.5vw, 40px)" }}>
          <Reveal>
            <InkHover
              tone="light"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "12px 28px",
                marginBottom: 30,
              }}
            >
              <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent-300)" }}>
                Em números
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.6, maxWidth: "46ch", color: "var(--color-neutral-400)" }}>
                O Ledgr cruza extrato do banco com o razão do ERP e entrega um relatório categorizado
                — sem planilha, sem conferência manual linha por linha.
              </span>
            </InkHover>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "28px 0" }}>
            {NUMEROS.map((numero, i) => (
              <Reveal
                key={numero.rotulo}
                delay={i * 0.08}
                style={{
                  padding: `0 28px 0 ${i === 0 ? 0 : 28}px`,
                  borderLeft: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--color-neutral-100) 22%, transparent)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 46,
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

      {/* o problema */}
      <section id="problema" style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
          <Reveal>
            <InkHover
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "24px 48px",
                marginBottom: 42,
              }}
            >
              <div>
                <h6 style={{ margin: "0 0 12px", color: "var(--color-accent-700)" }}>Cap. II · O jeito de hoje</h6>
                <h2 style={{ margin: 0, fontSize: "clamp(30px, 2.8vw, 46px)", fontWeight: 400, lineHeight: 1.08 }}>
                  Duas telas abertas, um dedo em cada linha.
                </h2>
              </div>
              <p
                style={{
                  margin: 0,
                  alignSelf: "end",
                  fontSize: 15.5,
                  lineHeight: 1.75,
                  textAlign: "justify",
                  hyphens: "auto",
                }}
              >
                Conferir o extrato do banco contra o extrato do sistema de gestão linha a linha é lento,
                cansa e deixa passar erro. Quanto maior o volume de lançamentos, pior fica — e o mês
                fecha sempre no aperto.
              </p>
            </InkHover>
          </Reveal>
          <Reveal delay={0.1}>
            <ExtratoComparacao banco={EXTRATO_BANCO} sistema={EXTRATO_SISTEMA} />
          </Reveal>
        </div>
      </section>

      {/* como funciona */}
      <section id="como" style={{ position: "relative", overflow: "hidden", borderTop: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
        <Image
          src="/mascotes/mascote-explicando.png"
          alt=""
          aria-hidden="true"
          width={1920}
          height={1920}
          style={{ position: "absolute", top: 30, right: -40, width: 470, height: "auto", opacity: 0.07, pointerEvents: "none" }}
        />
        <div style={{ position: "relative", maxWidth: 1440, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
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
                <h6 style={{ margin: "0 0 12px", color: "var(--color-accent-700)" }}>Cap. III · Como funciona</h6>
                <h2 style={{ margin: 0, fontSize: "clamp(30px, 2.8vw, 46px)", fontWeight: 400, lineHeight: 1.08 }}>
                  Três passos, sem cruzar linha por linha.
                </h2>
              </div>
              <Image
                src="/mascotes/mascote-explicando.png"
                alt="Mascote Ledgr explicando"
                width={1920}
                height={1920}
                style={{ flex: "none", width: 240, height: "auto" }}
              />
            </InkHover>
          </Reveal>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              borderTop: "1px solid var(--color-divider)",
            }}
          >
            {PASSOS.map((passo, i) => (
              <Reveal
                key={passo.num}
                delay={i * 0.1}
                style={{
                  padding: `30px 30px 30px ${i === 0 ? 0 : 30}px`,
                  borderLeft: i === 0 ? "none" : "1px solid var(--color-divider)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
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
                <div style={{ fontSize: 15, lineHeight: 1.72, textAlign: "justify", hyphens: "auto" }}>
                  {passo.texto}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* regra de ouro */}
      <section id="regra" style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
          <Reveal>
            <InkHover
              style={{
                border: "1px solid var(--color-accent)",
                borderRadius: "var(--radius-md)",
                padding: "42px 46px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 82,
                  fontWeight: 400,
                  lineHeight: 1,
                  color: "var(--color-accent)",
                }}
              >
                §
              </div>
              <div style={{ maxWidth: "68ch" }}>
                <h6 style={{ margin: "0 0 10px", color: "var(--color-accent-700)" }}>
                  Regra de ouro
                </h6>
                <h2 style={{ margin: "0 0 12px", fontSize: "clamp(26px, 2.4vw, 42px)", fontWeight: 400 }}>
                  O extrato do banco é sempre a fonte da verdade.
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15.5,
                    lineHeight: 1.75,
                  }}
                >
                  Toda divergência é reportada na mesma direção: o sistema diverge do banco, nunca o
                  contrário. Isso encerra a discussão sobre qual número vale e deixa claro o que
                  precisa ser corrigido no seu sistema de gestão.
                </p>
              </div>
            </InkHover>
          </Reveal>
        </div>
      </section>

      {/* convite */}
      <section style={{ position: "relative", overflow: "hidden", borderTop: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
        <Image
          src="/mascotes/mascote-sentado.png"
          alt=""
          aria-hidden="true"
          width={1920}
          height={1920}
          style={{ position: "absolute", bottom: -70, right: -30, width: 360, height: "auto", opacity: 0.07, pointerEvents: "none" }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 1440,
            margin: "0 auto",
            padding: "72px clamp(16px, 3.5vw, 40px)",
            display: "flex",
            flexWrap: "wrap",
            gap: "32px 48px",
            alignItems: "center",
          }}
        >
          <InkHover style={{ flex: "none" }}>
            <Image
              src="/mascotes/mascote-sentado.png"
              alt="Mascote Ledgr sentado lendo um panfleto"
              width={1920}
              height={1920}
              style={{ width: 220, height: "auto", display: "block" }}
            />
          </InkHover>
          <Reveal delay={0.1} style={{ flex: "1 1 420px", minWidth: 0, paddingLeft: 32, borderLeft: "1px solid var(--color-accent)" }}>
            <h6 style={{ margin: "0 0 12px", color: "var(--color-accent-700)" }}>Sem configuração</h6>
            <h2 style={{ margin: "0 0 16px", fontSize: "clamp(26px, 2.4vw, 40px)", fontWeight: 400, lineHeight: 1.12 }}>
              Suba os arquivos e veja as divergências em minutos.
            </h2>
            <p
              style={{
                margin: "0 0 18px",
                fontSize: 15.5,
                lineHeight: 1.75,
                maxWidth: "66ch",
                textAlign: "justify",
                hyphens: "auto",
              }}
            >
              O Ledgr aceita OFX e CSV de qualquer banco. Suba o extrato do banco, suba o razão do
              seu ERP ou sistema de gestão no mesmo período e receba o relatório categorizado —
              sem integração pra configurar, sem instalar nada.
            </p>
            <p
              style={{
                margin: "0 0 22px",
                fontSize: 15.5,
                lineHeight: 1.75,
                maxWidth: "66ch",
                textAlign: "justify",
                hyphens: "auto",
              }}
            >
              Cada divergência vem nomeada: sem correspondente, valor divergente, data divergente,
              duplicidade. Você vê o problema, decide o que corrigir no sistema e fecha o mês com
              segurança.
            </p>
            <Link href="/login" className="btn btn-primary">
              Testar agora, gratuito
            </Link>
          </Reveal>
        </div>
      </section>

      {/* perguntas */}
      <section id="perguntas" style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
          <Reveal
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "12px 32px",
              marginBottom: 34,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "clamp(26px, 2.4vw, 40px)", fontWeight: 400, lineHeight: 1.1 }}>
              Perguntas que sempre aparecem
            </h2>
            <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 58%, transparent)" }}>
              Qualquer outra dúvida: ola@ledgr.com.br
            </span>
          </Reveal>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "0 48px",
              borderTop: "1px solid var(--color-divider)",
            }}
          >
            {PERGUNTAS.map((item, i) => (
              <Reveal key={item.pergunta} delay={i * 0.08}>
                <InkHover
                  style={{
                    padding: "22px 0",
                    borderBottom: "1px solid var(--color-divider)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600, lineHeight: 1.26 }}>
                    {item.pergunta}
                  </span>
                  <span style={{ fontSize: 15, lineHeight: 1.72 }}>{item.resposta}</span>
                </InkHover>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* preço / cta */}
      <section
        id="preco"
        style={{
          position: "relative",
          overflow: "hidden",
          borderTop: "1px solid var(--color-divider)",
          background: "var(--color-neutral-900)",
        }}
      >
        <Image
          src="/mascotes/mascote-comemorando.png"
          alt=""
          aria-hidden="true"
          width={1920}
          height={1920}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -46%)",
            width: 520,
            height: "auto",
            opacity: 0.1,
            pointerEvents: "none",
          }}
        />
        <Reveal
          style={{
            position: "relative",
            maxWidth: 1440,
            margin: "0 auto",
            padding: "84px clamp(16px, 3.5vw, 40px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent-300)" }}>
            Cap. IV · Começar
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(36px, 3.5vw, 60px)",
              fontWeight: 400,
              lineHeight: 1.06,
              maxWidth: "26ch",
              textWrap: "balance",
              color: "var(--ledgr-tinta)",
            }}
          >
            Preço fechado, por volume.
          </h2>
          <div style={{ width: 84, height: 1, background: "var(--color-accent)" }} />
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.72, maxWidth: "52ch", color: "var(--color-neutral-300)" }}>
            Você paga pelo tanto de lançamento que conferir no mês. Sem fidelidade, sem taxa de
            implantação, sem cobrar por usuário.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              width: "100%",
              maxWidth: 1180,
              marginTop: 14,
              textAlign: "left",
            }}
          >
            {PLANOS.map((plano, i) => (
              <PlanCard
                key={plano.nome}
                delay={0.1 + i * 0.07}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "22px 20px",
                  border: plano.destaque
                    ? "1px solid var(--color-accent)"
                    : plano.contato
                      ? "1px dashed var(--color-accent-800)"
                      : "1px solid var(--color-accent-800)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600, color: "var(--ledgr-tinta)" }}>
                  {plano.nome}
                </span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 30, fontWeight: 600, lineHeight: 1, color: "var(--ledgr-tinta)" }}>
                  {plano.preco}
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-neutral-400)" }}>{plano.limite}</span>
              </PlanCard>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 6 }}>
            <Link
              href="/login"
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
        </Reveal>
      </section>

      {/* rodapé */}
      <footer style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "44px clamp(16px, 3.5vw, 40px) 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "32px 56px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Image src="/mascotes/logo-barras.png" alt="Ledgr" width={2400} height={1952} style={{ height: 24, width: "auto" }} />
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600 }}>Ledgr</span>
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.7, maxWidth: "40ch", color: "color-mix(in srgb, var(--color-text) 62%, transparent)" }}>
              Conciliação bancária sem planilha, para quem fecha o mês com o extrato na mão. Passo
              Fundo, RS.
            </span>
          </div>
          {RODAPE_COLUNAS.map((coluna) => (
            <div key={coluna.titulo} style={{ flex: "0 1 170px", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                {coluna.titulo}
              </span>
              {coluna.itens.map((link) => (
                <a key={link.rotulo} href={link.href} style={{ fontSize: 14.5 }}>
                  {link.rotulo}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "18px clamp(16px, 3.5vw, 40px) 40px" }}>
          <div
            style={{
              borderTop: "1px solid var(--color-divider)",
              paddingTop: 16,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "8px 24px",
              fontSize: 13,
              color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
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
