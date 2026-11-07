"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { NumeroAnimado, pediuMenosMovimento } from "@/app/(app)/e/[empresa]/numero-animado";
import { formatarVolume, teclarNoMedidor, useAlturaQueDesliza } from "@/app/medidor-suave";
import { planosDoTeste, type PlanoId } from "@/lib/assinatura";
import {
  CONTATO,
  DETALHES,
  ESCOLHER_PLANO,
  MARCAS,
  PASSO_INICIAL,
  ULTIMO_PASSO,
  lembrarPlano,
  marcaDoPlano,
  passoDoPlano,
  planoDoVolume,
  volumeDoPasso,
} from "@/lib/medidor-de-planos";

/** Quanto a régua leva para correr até o plano de um perfil ("Ver o meu plano"). */
const DURACAO_DA_CORRIDA = 900;

/**
 * Roda `acao` quando metade do número da régua está na tela: o clique de "Ver o meu plano" rola a página
 * até aqui, e a corrida só começa quando dá para vê-la. Sem IntersectionObserver, ou com o número já à
 * vista, começa na hora; o limite evita esperar para sempre se a rolagem não chegar. Devolve o cancelamento.
 */
function quandoVisivel(no: Element | null, acao: () => void): () => void {
  if (!no || typeof IntersectionObserver === "undefined") {
    acao();
    return () => {};
  }
  const limite = window.setTimeout(() => {
    observador.disconnect();
    acao();
  }, 1500);
  const observador = new IntersectionObserver(
    ([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      window.clearTimeout(limite);
      acao();
    },
    { threshold: 0.5 },
  );
  observador.observe(no);
  return () => {
    observador.disconnect();
    window.clearTimeout(limite);
  };
}

/**
 * Os planos do Cap. IV como a escolha guiada do /plano: a pergunta, o medidor sobre a régua (o traço
 * é o controle, a marca do plano indicado acende) e o plano numa folha de papel, como os cards de "Em
 * todo plano" no hover. "Começar com o …" guarda o plano para o /plano abrir nele depois do cadastro.
 *
 * ponytail: sem preço, o teste grátis no lugar. Os preços entram lendo GET /assinatura/precos quando
 * os definitivos estiverem no catálogo live da Stripe (#302); antes disso, a rota traz os provisórios.
 */
export function ReguaQueMede() {
  const idMedidor = useId();
  const [passo, setPasso] = useState(PASSO_INICIAL);
  const lancamentos = volumeDoPasso(passo);
  const indicado = planoDoVolume(lancamentos);
  const plano = planosDoTeste().find((p) => p.id === indicado) ?? null;
  const detalhes = DETALHES[indicado];
  const acesa = marcaDoPlano(indicado);
  const { caixa, conteudo } = useAlturaQueDesliza(indicado);

  // a corrida até o plano de um perfil: o passo anda quadro a quadro (traço, preenchimento e número juntos)
  const [chegando, setChegando] = useState(false);
  const corrida = useRef<number | null>(null);
  const passoVisto = useRef(passo);
  useEffect(() => {
    passoVisto.current = passo;
  });

  const parar = useCallback(() => {
    if (corrida.current !== null) cancelAnimationFrame(corrida.current);
    corrida.current = null;
    setChegando(false);
  }, []);

  const correrAte = useCallback(
    (alvo: number) => {
      parar();
      const de = passoVisto.current;
      if (de === alvo) return;
      if (pediuMenosMovimento()) {
        setPasso(alvo);
        return;
      }
      setChegando(true);
      const inicio = performance.now();
      const quadro = (agora: number) => {
        const t = Math.min(1, (agora - inicio) / DURACAO_DA_CORRIDA);
        // ease-out cúbico, como o resto: chega desacelerando
        setPasso(t < 1 ? de + (alvo - de) * (1 - Math.pow(1 - t, 3)) : alvo);
        if (t < 1) {
          corrida.current = requestAnimationFrame(quadro);
        } else {
          corrida.current = null;
          setChegando(false);
        }
      };
      corrida.current = requestAnimationFrame(quadro);
    },
    [parar],
  );

  // "Ver o meu plano", nos perfis de "Para quem é": a régua corre até o teto do plano daquele perfil
  useEffect(() => {
    let espera: (() => void) | null = null;
    const escolher = (evento: Event) => {
      const plano = (evento as CustomEvent<PlanoId>).detail;
      if (!(plano in DETALHES)) return;
      espera?.();
      espera = quandoVisivel(document.querySelector(".regua-mede-valor"), () => correrAte(passoDoPlano(plano)));
    };
    window.addEventListener(ESCOLHER_PLANO, escolher);
    return () => {
      window.removeEventListener(ESCOLHER_PLANO, escolher);
      espera?.();
      parar();
    };
  }, [correrAte, parar]);

  return (
    <div className="regua-mede">
      <div className="regua-mede-pergunta">
        <div className="preco-regua-topo">
          <p className="preco-rotulo">Os planos</p>
          <span className="preco-regua-nota">pelo volume de lançamentos do mês</span>
        </div>
        <p className="titulo-misto regua-mede-titulo">
          Quantos lançamentos você <em>confere por mês?</em>
        </p>
        <label htmlFor={idMedidor} className="regua-mede-valor">
          {/* na corrida o número vem do próprio passo, quadro a quadro; fora dela, o NumeroAnimado suaviza o arrasto */}
          <output htmlFor={idMedidor} className="numero-destaque" aria-live={chegando ? "off" : undefined}>
            {chegando ? (
              formatarVolume(passo)(lancamentos)
            ) : (
              <NumeroAnimado valor={lancamentos} duracao={350} formatar={formatarVolume(passo)} />
            )}
          </output>
          <span>lançamentos</span>
        </label>
        <input
          id={idMedidor}
          type="range"
          className="regua-mede-controle"
          min={0}
          max={ULTIMO_PASSO}
          step={0.01}
          value={passo}
          aria-valuetext={`${lancamentos.toLocaleString("pt-BR")}${passo === ULTIMO_PASSO ? " ou mais" : ""} lançamentos por mês`}
          style={{ "--cheio": `${(passo / ULTIMO_PASSO) * 100}%` } as CSSProperties}
          // quem mexe na régua assume o controle: a corrida para onde estiver
          onChange={(evento) => {
            parar();
            setPasso(Number(evento.target.value));
          }}
          onKeyDown={(evento) => {
            parar();
            teclarNoMedidor(setPasso)(evento);
          }}
        />
        <div className="regua-mede-marcas" aria-hidden="true">
          {MARCAS.map(([marca, rotulo]) => (
            <span
              key={rotulo}
              className="numero-destaque"
              data-acesa={marca === acesa || undefined}
              style={{ "--p": `${(marca / ULTIMO_PASSO) * 100}%` } as CSSProperties}
            >
              {rotulo}
            </span>
          ))}
        </div>
      </div>

      {/* a folha: o plano para o volume escolhido */}
      <section className="regua-mede-folha" aria-live="polite" aria-labelledby="regua-mede-plano">
        <p className="regua-mede-rotulo">{plano ? "O plano para o seu volume" : "Mais de 350 por mês"}</p>
        <div ref={caixa} className="regua-mede-corpo">
          <div ref={conteudo} key={indicado} className="regua-mede-indicacao">
            <h3 id="regua-mede-plano" className="titulo-misto regua-mede-nome">
              {plano ? (
                <>
                  O seu plano é o <em>{plano.nome}.</em>
                </>
              ) : (
                <>
                  Vamos combinar <em>juntos.</em>
                </>
              )}
            </h3>
            <p className="regua-mede-para">{detalhes.para}</p>
            {plano && (
              <p className="regua-mede-preco">
                {/* sem preço até os definitivos estarem no catálogo live da Stripe (#302): o teste grátis no lugar */}
                <span>14 dias grátis</span> <small>sem cartão</small>
              </p>
            )}
            <ul className="regua-mede-itens">
              {detalhes.itens.map(([item, emBreve]) => (
                <li key={item} data-depois={emBreve ? "" : undefined}>
                  <Check size={15} aria-hidden="true" />
                  <span>
                    {item}
                    {emBreve && <span className="regua-mede-em-breve">em breve</span>}
                  </span>
                </li>
              ))}
            </ul>
            {plano ? (
              <Link href="/cadastro" className="btn regua-mede-acao" onClick={() => lembrarPlano(plano.id)}>
                {`Começar com o ${plano.nome}`}
              </Link>
            ) : (
              <a className="btn regua-mede-acao" href={`mailto:${CONTATO}?subject=${encodeURIComponent("Plano Volume")}`}>
                Fale com a gente
              </a>
            )}
            {!plano && <p className="regua-mede-rodape">{CONTATO}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

