"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useInView } from "motion/react";
import { Reveal, useMovimentoReduzido } from "../reveal";
import { JanelaDoChatGpt, JanelaDoClaude, type EstadoDoChat } from "../chat-de-ia";

/**
 * Cap. IV da landing: a conexão com o ChatGPT e o Claude. À direita, o Claude consulta o Ledgr, a janela se
 * divide e o ChatGPT faz o mesmo ao lado, numa volta de ~39 s que só roda com a janela na tela. Tempos, textos e
 * medidas do canvas aprovado em 11/11 (docs/superpowers/plans/anexos/2026-11-11-conexao-ia/landing.dc.html).
 */
export const TECLA = 85;
export const PALAVRA = 160;

const P1 = "Como está a conciliação de agosto?";
const R1 = "Agosto está 96,3% conciliado. Dos 4.218 lançamentos do extrato do banco, 157 ainda pedem revisão no Ledgr.".split(" ");
const P2 = "Agosto já foi fechado?";
const R2 = "Sim. Agosto está fechado, com 96,3% conciliado. O relatório do fechamento fica em Fechamentos, no Ledgr.".split(" ");

/** Os instantes de uma volta, em ms. */
export function linhaDaConversa() {
  const menuIn = 2400, toggle = 3900, menuOut = 5100, dig1 = 6000;
  const dig1Fim = dig1 + P1.length * TECLA;
  const env1 = dig1Fim + 900;
  const cons1 = env1 + 900;
  const resp1 = cons1 + 2300;
  const resp1Fim = resp1 + R1.length * PALAVRA;
  const num1 = resp1Fim + 500;
  const divide = num1 + 2600;
  const arroba = divide + 2600;
  const mencaoOk = arroba + 1800;
  const dig2 = mencaoOk + 600;
  const dig2Fim = dig2 + P2.length * TECLA;
  const env2 = dig2Fim + 900;
  const cons2 = env2 + 900;
  const resp2 = cons2 + 2300;
  const resp2Fim = resp2 + R2.length * PALAVRA;
  const some = resp2Fim + 4800;
  const fim = some + 2000;
  return { menuIn, toggle, menuOut, dig1, dig1Fim, env1, cons1, resp1, resp1Fim, num1, divide, arroba, mencaoOk, dig2, dig2Fim, env2, cons2, resp2, resp2Fim, some, fim };
}

const L = linhaDaConversa();
// com menos movimento, a volta para aqui: as duas respostas inteiras, lado a lado
const PARADO = L.resp2Fim + 1200;

const digitar = (texto: string, desde: number, agora: number) =>
  agora < desde ? "" : texto.slice(0, Math.floor((agora - desde) / TECLA));
const falar = (palavras: string[], desde: number, agora: number) =>
  palavras.map((texto, i) => ({ texto, visivel: agora >= desde + i * PALAVRA }));

// o cursor: [a partir de, x em % da janela, y em px]
const ROTA = [
  [0, 52, 230], [900, 15, 572], [3000, 34, 402], [4700, 22, 527], [L.dig1Fim, 95, 572], [L.env1 + 600, 66, 260],
  [L.divide + 1600, 58, 308], [L.arroba + 400, 61, 258], [L.mencaoOk + 300, 60, 308], [L.dig2Fim, 95, 308], [L.env2 + 700, 82, 200],
];

/** O que está na tela no instante t de uma volta. Pura, sem relógio. */
export function quadroDaLanding(t: number): {
  claude: EstadoDoChat;
  gpt: EstadoDoChat;
  dividida: boolean;
  numeros: boolean;
  some: boolean;
  cursor: { x: number; y: number };
} {
  const env1 = t >= L.env1;
  const env2 = t >= L.env2;
  const claude: EstadoDoChat = {
    digitado: env1 ? "" : digitar(P1, L.dig1, t),
    digitando: t >= L.dig1 - 600 && !env1,
    enviada: env1 ? P1 : null,
    ferramenta: t < L.cons1 ? "nada" : t < L.resp1 - 300 ? "consultando" : "feito",
    resposta: falar(R1, L.resp1, t),
    numeros: t >= L.num1,
    menuAberto: t >= L.menuIn && t < L.menuOut,
    ledgrLigado: t >= L.toggle,
  };
  const gpt: EstadoDoChat = {
    digitado: env2 ? "" : t >= L.mencaoOk ? digitar(P2, L.dig2, t) : t >= L.arroba ? "@" : "",
    digitando: t >= L.arroba && !env2,
    enviada: env2 ? P2 : null,
    ferramenta: t < L.cons2 ? "nada" : t < L.resp2 - 300 ? "consultando" : "feito",
    resposta: falar(R2, L.resp2, t),
    numeros: false,
    menuAberto: t >= L.arroba + 300 && t < L.mencaoOk,
    ledgrLigado: t >= L.mencaoOk,
  };
  let ponto = ROTA[0];
  for (const passo of ROTA) if (t >= passo[0]) ponto = passo;
  return { claude, gpt, dividida: t >= L.divide, numeros: claude.numeros, some: t >= L.some, cursor: { x: ponto[1], y: ponto[2] } };
}

const PROMESSAS = [
  ["I", "Só leitura.", "A IA não confere, não justifica e não fecha mês."],
  ["II", "A descrição dos lançamentos nunca sai.", "Nem as justificativas, nem o nome de quem usa."],
  ["III", "Você autoriza e você revoga.", "Uma empresa por conexão, desligada num clique."],
];

export function ConexaoIa() {
  return (
    <section id="conexao-ia" className="onda onda-superficie grao cia-secao" aria-labelledby="conexao-ia-titulo">
      <div className="cia-conteudo">
        <Reveal className="cia-texto">
          <p className="eyebrow cia-capitulo">Cap. IV · Conexão com IA</p>
          <h2 id="conexao-ia-titulo" className="titulo-misto cia-titulo">
            Pergunte à sua IA como está <em>o seu mês.</em>
          </h2>
          <p className="cia-abertura">
            Ligue o Ledgr ao ChatGPT ou ao Claude e pergunte em português: quanto está conciliado, quantas divergências faltam, se o mês já
            fechou. A resposta vem dos números do Ledgr.
          </p>
          <ol className="cia-promessas">
            {PROMESSAS.map(([numeral, titulo, texto]) => (
              <li key={numeral}>
                <span className="cia-numeral" aria-hidden="true">{numeral}</span>
                <span>
                  <strong>{titulo}</strong> <span>{texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="cia-acao">
            {/* a Central só abre com a conta, então o visitante vai ao cadastro, com o rótulo de todo link
                de cadastro da landing; a seta vem do CSS para o nome do link ser só "Começar agora" */}
            <Link href="/cadastro" className="cia-cta">
              Começar agora<span className="cia-seta" aria-hidden="true" />
            </Link>
            <span>Com a conta criada, o passo a passo no ChatGPT, no Claude e no Claude Code fica na Central de ajuda.</span>
          </div>
        </Reveal>
        <ConversaDasIas />
      </div>
    </section>
  );
}

function ConversaDasIas() {
  const reduzido = useMovimentoReduzido(false);
  const quadro = useRef<HTMLDivElement>(null);
  const naTela = useInView(quadro, { amount: 0.4 });
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduzido || !naTela) return;
    const relogio = setInterval(() => setT((agora) => (agora + 40 >= L.fim ? 0 : agora + 40)), 40);
    return () => clearInterval(relogio);
  }, [reduzido, naTela]);

  const q = quadroDaLanding(reduzido ? PARADO : t);
  return (
    <div className="cia-palco">
      <div className="cia-mascote" aria-hidden="true">
        <span className="cia-ia">
          <Image src="/mascotes/logo-chatgpt.png" alt="" width={76} height={76} />
          ChatGPT
        </span>
        <Image src="/mascotes/mascote-tomadas.webp" alt="" width={440} height={277} className="cia-mascote-img" />
        <span className="cia-ia">
          <Image src="/mascotes/logo-claude.png" alt="" width={76} height={76} />
          Claude
        </span>
      </div>
      <p className="sr-only">
        Simulação: no Claude, alguém pergunta como está a conciliação de agosto e o Claude consulta o Ledgr e responde que agosto está 96,3%
        conciliado, com 157 de 4.218 lançamentos para revisar. No ChatGPT, pergunta se agosto já foi fechado, e ele responde pelo Ledgr que sim.
      </p>
      <div ref={quadro} className="cia-janela" data-dividida={q.dividida ? "true" : "false"} data-some={q.some ? "true" : "false"}>
        <div className="cia-lado cia-lado-claude">
          <JanelaDoClaude estado={q.claude} compacta={q.dividida} />
        </div>
        <div className="cia-lado cia-lado-gpt">
          <JanelaDoChatGpt estado={q.gpt} />
        </div>
        <svg
          className="cia-cursor"
          data-ligado={reduzido || q.some ? "false" : "true"}
          style={{ left: `${q.cursor.x}%`, top: q.cursor.y }}
          width="22"
          height="26"
          viewBox="0 0 22 26"
          aria-hidden="true"
        >
          <path d="M2 2l17 11-7.5 1.4L8 23z" fill="#0d0d0d" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="cia-nota">Simulação no Claude e no ChatGPT com os números do agosto da demonstração.</p>
    </div>
  );
}
