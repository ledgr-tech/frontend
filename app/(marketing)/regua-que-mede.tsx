"use client";

import { useId, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { NumeroAnimado } from "@/app/(app)/numero-animado";
import { formatarVolume, teclarNoMedidor, useAlturaQueDesliza } from "@/app/medidor-suave";
import { planosDoTeste } from "@/lib/assinatura";
import {
  CONTATO,
  DETALHES,
  MARCAS,
  PASSO_INICIAL,
  ULTIMO_PASSO,
  lembrarPlano,
  marcaDoPlano,
  planoDoVolume,
  volumeDoPasso,
} from "@/lib/medidor-de-planos";

/**
 * Os planos do Cap. IV como a escolha guiada do /plano: a pergunta, o medidor sobre a régua (o traço
 * é o controle, a marca do plano indicado acende) e o plano numa folha de papel, como os cards de "Em
 * todo plano" no hover. "Começar com o …" guarda o plano para o /plano abrir nele depois do cadastro.
 *
 * shortcut: só o preço mensal; o período (mensal, anual, "ver outros planos") entra com o gateway e
 * os descontos dos sócios (#167).
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
          <output htmlFor={idMedidor} className="numero-destaque">
            <NumeroAnimado
              valor={lancamentos}
              duracao={350}
              formatar={formatarVolume(passo)}
            />
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
          onChange={(evento) => setPasso(Number(evento.target.value))}
          onKeyDown={teclarNoMedidor(setPasso)}
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
                <span>{plano.preco}</span> <small>/mês</small>
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
            <p className="regua-mede-rodape">{plano ? "14 dias grátis, sem cartão" : CONTATO}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

