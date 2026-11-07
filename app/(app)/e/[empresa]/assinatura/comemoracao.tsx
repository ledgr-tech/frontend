"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Check, X } from "lucide-react";
import Link from "@/lib/link-do-app";
import { formatarDiaCurto, NOME_DO_PLANO, type Cobranca } from "@/lib/assinatura";
import { DETALHES } from "@/lib/medidor-de-planos";
import { useLimites } from "../conta";
import { ModalDaTela } from "../empresas/modal-da-tela";

type Peca = { tipo: "papel" | "folha" | "tinta" | "ouro"; estilo: CSSProperties };

// O confete de papel da medalha, caindo pela tela até a janela fechar. As posições saem de um gerador
// fixo, não de Math.random: o servidor e o cliente desenham o mesmo, e cada abertura é igual.
const CONFETE: Peca[] = (() => {
  let semente = 7;
  const sortear = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const tipos: Peca["tipo"][] = ["papel", "papel", "papel", "papel", "folha", "folha", "folha", "tinta", "ouro", "ouro"];
  return Array.from({ length: 40 }, () => {
    const tipo = tipos[Math.floor(sortear() * tipos.length)];
    const largura = tipo === "tinta" ? 6 : Math.round(6 + sortear() * 10);
    const altura = tipo === "tinta" ? 6 : largura < 10 ? Math.round(14 + sortear() * 6) : 6;
    const giro = Math.round(sortear() * 360 - 180);
    const duracao = 5 + sortear() * 5;
    return {
      tipo,
      estilo: {
        "--x": `${(sortear() * 98).toFixed(1)}%`,
        "--y": `${(sortear() * 100).toFixed(1)}vh`,
        "--l": `${largura}px`,
        "--a": `${altura}px`,
        "--r": `${giro}deg`,
        "--giro": `${giro + Math.round(360 + sortear() * 360)}deg`,
        "--deriva": `${Math.round(sortear() * 80 - 40)}px`,
        "--dur": `${duracao.toFixed(2)}s`,
        // atraso negativo: a tela já abre com confete no ar, em vez de esperar o primeiro cair
        "--atraso": `${(-sortear() * duracao).toFixed(2)}s`,
      } as CSSProperties,
    };
  });
})();

const PERIODO: Record<Cobranca["periodo"], string> = { mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };

/**
 * A comemoração de quando o webhook confirma a assinatura (#300, versão D do artefato "Comemoração da
 * assinatura"): o plano, o período, a data da cobrança e o que o plano libera, num livro-razão. Assinando
 * no teste (`trialing` na Stripe), a primeira cobrança é no fim dele; fora do teste, ela já foi feita.
 */
export function ComemoracaoDaAssinatura({ cobranca, aoFechar }: { cobranca: Cobranca; aoFechar: () => void }) {
  const franquia = useLimites()?.conciliacoes?.maximo ?? null;
  const nome = NOME_DO_PLANO[cobranca.plano];
  const noTeste = cobranca.status === "trialing";
  const dia = cobranca.periodoAtualFim && formatarDiaCurto(cobranca.periodoAtualFim, new Date());

  return (
    <ModalDaTela
      titulo="Assinatura confirmada"
      aoFechar={aoFechar}
      classe="comemoracao"
      fundo={
        <div className="comemoracao-chuva" aria-hidden="true">
          {CONFETE.map((peca, i) => (
            <span key={i} className={`confete confete-${peca.tipo}`} style={peca.estilo} />
          ))}
        </div>
      }
    >
      <button type="button" className="comemoracao-fechar" aria-label="Fechar" onClick={aoFechar}>
        <X size={18} aria-hidden="true" />
      </button>
      <div className="comemoracao-topo">
        <div className="comemoracao-chamada">
          <h2 className="comemoracao-titulo">O plano {nome} é seu.</h2>
          <p className="comemoracao-texto">
            {noTeste && dia
              ? `Você só paga em ${dia}, quando o teste acaba. Até lá, nada muda: siga conciliando como antes.`
              : "A primeira cobrança foi feita agora. O que você já fez continua aqui."}
          </p>
        </div>
        <Image src="/mascotes/medalha-comemorando.png" alt="" width={132} height={132} className="comemoracao-medalha" />
      </div>
      <dl className="comemoracao-razao">
        <Linha rotulo="Plano" valor={nome} />
        <Linha rotulo="Período" valor={PERIODO[cobranca.periodo]} />
        {dia && <Linha rotulo={noTeste ? "Primeira cobrança" : "Próxima cobrança"} valor={dia} />}
      </dl>
      <section className="comemoracao-libera" aria-labelledby="comemoracao-libera">
        <h3 id="comemoracao-libera" className="comemoracao-libera-titulo">
          O que o seu plano libera
        </h3>
        <ul>
          {DETALHES[cobranca.plano].itens.map(([item, emBreve]) => (
            <li key={item}>
              <Check size={16} aria-hidden="true" />
              <span>
                {item}
                {emBreve && <span className="comemoracao-em-breve">em breve</span>}
              </span>
            </li>
          ))}
          {franquia !== null && (
            <li>
              <Check size={16} aria-hidden="true" />
              <span>{franquia.toLocaleString("pt-BR")} conciliações por mês</span>
            </li>
          )}
        </ul>
      </section>
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={aoFechar}>
          Ver a assinatura
        </button>
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Começar uma conciliação
        </Link>
      </div>
    </ModalDaTela>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <span className="comemoracao-pontilhado" aria-hidden="true" />
      <dd className="font-titulo">{valor}</dd>
    </div>
  );
}
