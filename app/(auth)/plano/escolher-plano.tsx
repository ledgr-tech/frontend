"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { planosDoTeste, type PlanoId } from "@/lib/assinatura";
import { escolherPlano } from "../acoes";

const PARA: Record<PlanoId, { para: string; itens: string[]; tag?: string }> = {
  essencial: { para: "Para a empresa que concilia o próprio banco.", itens: ["Conciliação banco × sistema", "Fechamento do mês com relatório em PDF", "Histórico das conciliações"] },
  padrao: { para: "Para o escritório que concilia os clientes.", itens: ["Tudo do Essencial", "Pastas de extratos, uma por cliente"], tag: "Para escritórios" },
  avancado: { para: "Para o escritório com equipe.", itens: ["Tudo do Padrão", "Convites para a equipe"] },
};

export function EscolherPlano() {
  const router = useRouter();
  const [escolhendo, setEscolhendo] = useState<PlanoId | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(plano: PlanoId) {
    setErro(null);
    setEscolhendo(plano);
    const resposta = await escolherPlano(plano).catch(() => ({ ok: false as const, erro: "Não foi possível falar com o servidor." }));
    if (resposta.ok) {
      router.push("/visao-geral");
      return;
    }
    setEscolhendo(null);
    setErro(resposta.erro);
  }

  return (
    <div className="plano-tela">
      <div className="plano-cabeca">
        <span className="eyebrow plano-eyebrow">Último passo</span>
        <h1 className="plano-titulo">Escolha seu plano.</h1>
        <p className="plano-texto">14 dias grátis, sem cartão. No fim do teste você escolhe se continua, e pode trocar de plano quando quiser.</p>
      </div>
      <div className="plano-grade">
        {planosDoTeste().map((plano) => {
          const { para, itens, tag } = PARA[plano.id];
          return (
            <article key={plano.id} className="card plano-cartao" data-destaque={tag ? "" : undefined}>
              <div className="plano-cartao-topo">
                <h2 className="plano-nome">{plano.nome}</h2>
                {tag && <span className="selo">{tag}</span>}
              </div>
              <p className="plano-para">{para}</p>
              <p className="plano-preco"><span>{plano.preco}</span> <small>/mês</small></p>
              <p className="plano-limite">{plano.limite}</p>
              <ul className="plano-itens">
                {itens.map((item) => (
                  <li key={item}><Check size={15} aria-hidden="true" />{item}</li>
                ))}
              </ul>
              <button
                type="button"
                className={tag ? "btn btn-primary" : "btn btn-secondary"}
                disabled={escolhendo !== null}
                onClick={() => void escolher(plano.id)}
              >
                {escolhendo === plano.id ? "Começando…" : `Começar com o ${plano.nome}`}
              </button>
            </article>
          );
        })}
      </div>
      {erro && <p role="alert" className="plano-erro">{erro}</p>}
      <p className="plano-volume">Mais volume? O plano Volume é sob consulta. <a className="link-animado" href="mailto:ledgrtech@gmail.com">Fale com a gente</a></p>
    </div>
  );
}
