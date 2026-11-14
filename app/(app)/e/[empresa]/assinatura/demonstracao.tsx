"use client";

import { Reveal } from "@/app/reveal";
import { NOME_DO_PLANO, planosDoTeste } from "@/lib/assinatura";
import type { Limite } from "@/lib/limites";
import { PLANOS } from "@/lib/planos";
import { useAssinatura, useLimites } from "../conta";
import { formatarInteiro } from "../dashboard/resumo";
import { CancelarAssinatura } from "./cancelar-assinatura";
import { Cabecalho } from "../cabecalho";

/**
 * A assinatura sem cobrança na Stripe: aparece sem a situação no `GET /me` (backend antigo) e para o
 * piloto ativado à mão; o resto vê `PainelDaAssinatura`. Só mostra o que é da conta (o plano e os
 * limites do `/me`) e os planos que existem; o que a conta não tem (renovação, faturas) não aparece
 * (#388). Toda ação que mexeria na cobrança nasce desligada e aponta para o aviso que diz por quê.
 *
 * ponytail: cancelar, trocar de plano ou de cartão e as faturas esperam o PR 2 do backend #166; aí
 * esta tela vira a leitura da cobrança real.
 */

const AVISO_ID = "assinatura-aviso";

/** `semMaximo`: o que dizer quando o máximo vem null. Na franquia de conciliações null é "ainda não definido", nunca ilimitado (#297). */
function uso(rotulo: string, limite: Limite | null | undefined, semMaximo = "Sem limite no plano") {
  if (!limite) return null;
  const nota = limite.maximo === null ? semMaximo : `De ${formatarInteiro(limite.maximo)} no plano`;
  return { rotulo, valor: formatarInteiro(limite.usadas), nota };
}

export function AssinaturaDeDemonstracao() {
  const assinatura = useAssinatura();
  const limites = useLimites();
  const planoAtual = assinatura?.plano ?? null;
  const nomeAtual = planoAtual ? NOME_DO_PLANO[planoAtual] : null;
  const planos = [...planosDoTeste(), PLANOS.find((p) => p.contato)!];
  const numeros = [
    nomeAtual && { rotulo: "Plano atual", valor: nomeAtual, nota: "Da sua conta" },
    uso("Empresas", limites?.empresas),
    uso("Pessoas", limites?.usuarios),
    uso("Conciliações neste mês", limites?.conciliacoes, ""),
  ].filter((n) => !!n);

  return (
    <div>
      <Cabecalho
        titulo="Assinatura"
        contexto={[nomeAtual && `plano ${nomeAtual}`]}
        acoes={
          <>
            <button type="button" className="btn btn-secondary" disabled aria-describedby={AVISO_ID}>
              Trocar forma de pagamento
            </button>
            <CancelarAssinatura />
          </>
        }
      />

      <div className="ass-corpo">
        <p id={AVISO_ID} role="note" className="aviso-demonstracao">
          <strong>A cobrança ainda não está no ar.</strong> Nada da assinatura é alterado por aqui.
        </p>

        {numeros.length > 0 && (
          <Reveal className="grade-colunas dash-resumo">
            {numeros.map((numero) => (
              <div key={numero.rotulo}>
                <span className="dash-rotulo">{numero.rotulo}</span>
                <span className="dash-valor">{numero.valor}</span>
                <span className="dash-nota">{numero.nota}</span>
              </div>
            ))}
          </Reveal>
        )}

        <Reveal delay={0.08}>
          <section className="ass-planos-caixa">
            <h3 id="assinatura-planos" className="ass-titulo">
              Planos
            </h3>
            <ul className="ass-planos" aria-labelledby="assinatura-planos">
              {planos.map((opcao) => {
                const atual = opcao.nome === nomeAtual;
                return (
                  <li key={opcao.nome} className="ass-plano" data-atual={atual ? "true" : undefined}>
                    <div className="ass-plano-topo">
                      <h4 className="ass-plano-nome">{opcao.nome}</h4>
                      {atual && <span className="ass-plano-atual">Atual</span>}
                    </div>
                    {/* sem preço da Stripe, nenhum valor, nem de demonstração (#296) */}
                    {opcao.contato && (
                      <div className="ass-plano-valor">
                        <span className="ass-plano-preco">Sob consulta</span>
                      </div>
                    )}
                    <span className="ass-plano-filete" aria-hidden="true" />
                    {opcao.descricao && <p className="ass-plano-texto">{opcao.descricao}</p>}
                    {/* o plano atual não é ação, é estado; os outros seriam troca de plano */}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled
                      aria-describedby={atual ? undefined : AVISO_ID}
                    >
                      {atual ? "Plano atual" : `Mudar para ${opcao.nome}`}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
