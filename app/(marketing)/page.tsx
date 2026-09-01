import Image from "next/image";
import Link from "next/link";

const PROVAS_HERO = [
  { valor: "4", rotulo: "bancos num só relatório" },
  { valor: "4.218", rotulo: "lançamentos conferidos no mês" },
  { valor: "27", rotulo: "linhas para revisar" },
];

const NUMEROS = [
  { valor: "96,3%", rotulo: "dos lançamentos casaram sem ninguém conferir" },
  { valor: "R$ 214.380", rotulo: "em divergência que o Ledgr apontou linha por linha" },
  { valor: "4", rotulo: "categorias de divergência, sempre nomeadas" },
];

const EXTRATO_BANCO = [
  { data: "04/09", desc: "Boleto Aço Norte Bobinas", valor: "R$ 12.640,00" },
  { data: "05/09", desc: "Repasse cartão D+30", valor: "R$ 7.912,45" },
  { data: "11/09", desc: "Aluguel galpão BR-386", valor: "R$ 9.800,00" },
];

const EXTRATO_SISTEMA = [
  { data: "04/09", desc: "Boleto Aço Norte Bobinas", valor: "R$ 12.604,00" },
  { data: "05/09", desc: "Repasse cartão D+30", valor: "R$ 7.912,40" },
  { data: "12/09", desc: "Aluguel galpão BR-386", valor: "R$ 9.800,00" },
];

const PASSOS = [
  {
    num: "I",
    titulo: "Suba o extrato do banco",
    texto: "OFX ou CSV, direto do internet banking. É ele que define a verdade da conciliação.",
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
  { nome: "Essencial", preco: "R$ 49,90", limite: "até 100 lançamentos por mês", destaque: false },
  { nome: "Padrão", preco: "R$ 79,90", limite: "até 200 lançamentos por mês", destaque: true },
  { nome: "Avançado", preco: "R$ 99,90", limite: "até 350 lançamentos por mês", destaque: false },
  { nome: "Volume", preco: "Sob consulta", limite: "acima de 350 — indústria e multi-banco", destaque: false },
];

const RODAPE_LINKS = [
  { rotulo: "Como funciona", href: "#como" },
  { rotulo: "Regra de ouro", href: "#regra" },
  { rotulo: "Assinatura", href: "#preco" },
];

export default function LandingPage() {
  return (
    <main>
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
            maxWidth: 1180,
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
            <Image src="/mascotes/logo-barras.png" alt="Ledgr" width={2400} height={1952} style={{ height: 26, width: "auto" }} />
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
          style={{
            position: "relative",
            maxWidth: 1180,
            margin: "0 auto",
            padding: "84px clamp(16px, 3.5vw, 40px) 72px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.06fr) minmax(0, 0.94fr)",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
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
            <h1 style={{ margin: "24px 0", fontSize: 56, fontWeight: 400, lineHeight: 1.05 }}>
              Pare de conciliar extrato à mão.
            </h1>
            <p style={{ margin: "0 0 34px", fontSize: 17.5, lineHeight: 1.72, maxWidth: "44ch" }}>
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
                OFX ou CSV · sem cartão de crédito
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0,
                borderTop: "1px solid var(--color-divider)",
              }}
            >
              {PROVAS_HERO.map((prova, i) => (
                <div
                  key={prova.rotulo}
                  style={{
                    padding: `18px 22px 0 ${i === 0 ? 0 : 22}px`,
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
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              paddingLeft: 30,
              borderLeft: "1px solid var(--color-divider)",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                zIndex: 0,
                top: -30,
                right: -10,
                width: 210,
                height: 90,
                borderRadius: 45,
                background: "var(--color-neutral-200)",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                zIndex: 0,
                top: 70,
                right: 30,
                width: 170,
                height: 80,
                borderRadius: 40,
                background: "var(--color-neutral-200)",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                zIndex: 0,
                top: 220,
                right: -30,
                width: 190,
                height: 110,
                borderRadius: 55,
                background: "var(--color-neutral-200)",
              }}
            />
            <Image
              src="/mascotes/mascote-apresentando.png"
              alt="Mascote Ledgr com prancheta de conciliação e dinheiro"
              width={824}
              height={720}
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
                Setembro · Telha Certa
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 38, fontWeight: 600, lineHeight: 1 }}>
                  96,3%
                </span>
                <span style={{ fontSize: 13.5, color: "color-mix(in srgb, var(--color-text) 62%, transparent)" }}>
                  conciliado
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                157 de 4.218 para revisar
              </div>
            </div>
          </div>
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
        <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "54px clamp(16px, 3.5vw, 40px)" }}>
          <div
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
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "28px 0" }}>
            {NUMEROS.map((numero, i) => (
              <div
                key={numero.rotulo}
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* o problema */}
      <section id="problema" style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px 48px",
              marginBottom: 42,
            }}
          >
            <div>
              <h6 style={{ margin: "0 0 12px", color: "var(--color-accent-700)" }}>Cap. II · O jeito de hoje</h6>
              <h2 style={{ margin: 0, fontSize: 38, fontWeight: 400, lineHeight: 1.08 }}>
                Duas telas abertas, um dedo em cada linha.
              </h2>
            </div>
            <p style={{ margin: 0, alignSelf: "end", fontSize: 15.5, lineHeight: 1.75 }}>
              Conferir o extrato do banco contra o extrato do sistema de gestão linha a linha é lento,
              cansa e deixa passar erro. Quanto maior o volume de lançamentos, pior fica — e o mês
              fecha sempre no aperto.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", gap: 28, alignItems: "stretch" }}>
            <div style={{ border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", background: "var(--color-surface)", overflow: "hidden" }}>
              <div
                style={{
                  padding: "13px 18px",
                  borderBottom: "1px solid var(--color-divider)",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 600 }}>Extrato do banco</span>
                <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>extrato-09.ofx</span>
              </div>
              {EXTRATO_BANCO.map((linha) => (
                <div
                  key={linha.desc}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: "1px solid var(--color-divider)" }}
                >
                  <span style={{ flex: "none", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>{linha.data}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {linha.desc}
                  </span>
                  <span style={{ flex: "none", fontFamily: "var(--font-heading)", fontSize: 16.5, fontWeight: 600 }}>{linha.valor}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ width: 1, flex: 1, background: "var(--color-divider)" }} />
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, color: "var(--color-accent)" }}>≠</div>
              <div style={{ width: 1, flex: 1, background: "var(--color-divider)" }} />
            </div>
            <div style={{ border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", background: "var(--color-surface)", overflow: "hidden" }}>
              <div
                style={{
                  padding: "13px 18px",
                  borderBottom: "1px solid var(--color-divider)",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 600 }}>Extrato do sistema</span>
                <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>razao-09.csv</span>
              </div>
              {EXTRATO_SISTEMA.map((linha) => (
                <div
                  key={linha.desc}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: "1px solid var(--color-divider)" }}
                >
                  <span style={{ flex: "none", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>{linha.data}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {linha.desc}
                  </span>
                  <span style={{ flex: "none", fontFamily: "var(--font-heading)", fontSize: 16.5, fontWeight: 600 }}>{linha.valor}</span>
                </div>
              ))}
            </div>
          </div>
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
          style={{ position: "absolute", top: 30, right: -40, width: 420, height: "auto", opacity: 0.07, pointerEvents: "none" }}
        />
        <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
          <div
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
              <h2 style={{ margin: 0, fontSize: 38, fontWeight: 400, lineHeight: 1.08 }}>
                Três passos, nenhum deles manual.
              </h2>
            </div>
            <Image
              src="/mascotes/mascote-explicando.png"
              alt="Mascote Ledgr explicando"
              width={1920}
              height={1920}
              style={{ flex: "none", width: 210, height: "auto" }}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              borderTop: "1px solid var(--color-divider)",
            }}
          >
            {PASSOS.map((passo, i) => (
              <div
                key={passo.num}
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
                <div style={{ fontSize: 15, lineHeight: 1.72 }}>{passo.texto}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* regra de ouro */}
      <section id="regra" style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
          <div
            style={{
              border: "1px solid var(--color-accent)",
              borderRadius: "var(--radius-md)",
              padding: "42px 46px",
              display: "flex",
              flexWrap: "wrap",
              gap: "28px 40px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                flex: "none",
                fontFamily: "var(--font-heading)",
                fontSize: 82,
                fontWeight: 400,
                lineHeight: 1,
                color: "var(--color-accent)",
              }}
            >
              §
            </div>
            <div style={{ flex: "1 1 360px", minWidth: 0 }}>
              <h6 style={{ margin: "0 0 10px", color: "var(--color-accent-700)" }}>
                Regra de ouro
              </h6>
              <h2 style={{ margin: "0 0 12px", fontSize: 34, fontWeight: 400 }}>
                O extrato do banco é sempre a fonte da verdade.
              </h2>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75, maxWidth: "68ch" }}>
                Toda divergência é reportada na mesma direção: o sistema diverge do banco, nunca o
                contrário. Isso encerra a discussão sobre qual número vale e deixa claro o que
                precisa ser corrigido no seu sistema de gestão.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* convite */}
      <section style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "72px clamp(16px, 3.5vw, 40px)",
            display: "flex",
            flexWrap: "wrap",
            gap: "32px 48px",
            alignItems: "center",
          }}
        >
          <Image
            src="/mascotes/mascote-sentado.png"
            alt="Mascote Ledgr sentado lendo um panfleto"
            width={1920}
            height={1920}
            style={{ flex: "none", width: 196, height: "auto" }}
          />
          <div style={{ flex: "1 1 420px", minWidth: 0, paddingLeft: 32, borderLeft: "1px solid var(--color-accent)" }}>
            <h6 style={{ margin: "0 0 12px", color: "var(--color-accent-700)" }}>Primeiras empresas</h6>
            <h2 style={{ margin: "0 0 16px", fontSize: 32, fontWeight: 400, lineHeight: 1.12 }}>
              Estamos abrindo o Ledgr para um grupo pequeno de empresas.
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 15.5, lineHeight: 1.75, maxWidth: "66ch" }}>
              Construímos o Ledgr em cima de um problema específico: indústrias e comércios que
              movimentam vários bancos e fecham o mês conferindo linha por linha. O motor de
              conciliação já roda sobre volumes reais desse porte — quatro bancos, milhares de
              lançamentos, um único relatório no fim.
            </p>
            <p style={{ margin: "0 0 22px", fontSize: 15.5, lineHeight: 1.75, maxWidth: "66ch" }}>
              Nesta primeira turma, o primeiro fechamento é por nossa conta e a implantação é feita
              com a gente do lado — mapeamos as colunas do seu ERP, rodamos o seu mês e você compara
              com o que sua equipe fez à mão.
            </p>
            <Link href="/login" className="btn btn-primary">
              Quero conciliar meu mês
            </Link>
          </div>
        </div>
      </section>

      {/* perguntas */}
      <section style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px clamp(16px, 3.5vw, 40px)" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "12px 32px",
              marginBottom: 34,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400, lineHeight: 1.1 }}>
              Perguntas que sempre aparecem
            </h2>
            <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 58%, transparent)" }}>
              Qualquer outra dúvida: ola@ledgr.com.br
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "0 48px",
              borderTop: "1px solid var(--color-divider)",
            }}
          >
            {PERGUNTAS.map((item) => (
              <div
                key={item.pergunta}
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
              </div>
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
        <div
          style={{
            position: "relative",
            maxWidth: 1180,
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
              fontSize: 42,
              fontWeight: 400,
              maxWidth: "26ch",
              color: "var(--ledgr-tinta)",
            }}
          >
            Preço fechado, por volume.
          </h2>
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.72, maxWidth: "52ch", color: "var(--color-neutral-300)" }}>
            Você paga pelo tanto de lançamento que conferir no mês. Sem fidelidade, sem taxa de
            implantação, sem cobrar por usuário.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
              width: "100%",
              maxWidth: 860,
              marginTop: 14,
              textAlign: "left",
            }}
          >
            {PLANOS.map((plano) => (
              <div
                key={plano.nome}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "22px 20px",
                  border: `1px solid ${plano.destaque ? "var(--color-accent)" : "var(--color-accent-800)"}`,
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
              </div>
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
              Subir meus extratos
            </Link>
            <Link href="/login" className="btn btn-ghost" style={{ fontSize: 15, color: "var(--color-neutral-300)" }}>
              Ver o sistema por dentro
            </Link>
          </div>
        </div>
      </section>

      {/* rodapé */}
      <footer style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-surface)" }}>
        <div
          style={{
            maxWidth: 1180,
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
          <div style={{ flex: "0 1 170px", display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
              Nesta página
            </span>
            {RODAPE_LINKS.map((link) => (
              <a key={link.href} href={link.href} style={{ fontSize: 14.5 }}>
                {link.rotulo}
              </a>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px clamp(16px, 3.5vw, 40px) 40px" }}>
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
    </main>
  );
}
