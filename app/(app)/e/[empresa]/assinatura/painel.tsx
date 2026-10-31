"use client";

import { useState } from "react";
import { Reveal } from "@/app/reveal";
import { PLANOS } from "@/lib/planos";
import { textoDoLimite } from "@/lib/limites";
import {
  diasRestantes,
  formatarDiaCurto,
  fraseDoTeste,
  planosDoTeste,
  type Assinatura,
  type Periodo,
  type PlanoId,
  type PrecoDoPlano,
} from "@/lib/assinatura";
import { useAssinatura, useLimites, usePapel } from "../conta";
import { Cabecalho } from "../cabecalho";
import { FaixaDoPlano } from "../empresas/faixa-do-plano";
import { AssinaturaDeDemonstracao } from "./demonstracao";
import { SeletorDePeriodo } from "./seletor-de-periodo";

const MOTIVO_ID = "assinatura-motivo";
const SUFIXO: Record<Periodo, string> = { mensal: "/mês", trimestral: "/trimestre", semestral: "/semestre", anual: "/ano" };

function contexto(assinatura: Assinatura): string[] {
  const { situacao, testeTerminaEm, cobranca } = assinatura;
  if (situacao === "teste") {
    return [testeTerminaEm ? fraseDoTeste(diasRestantes(testeTerminaEm, new Date())).toLowerCase() : "teste grátis"];
  }
  if (situacao === "ativo" && cobranca) {
    const fim = cobranca.periodoAtualFim && `${cobranca.cancelaNoFim ? "termina" : "renova"} em ${formatarDiaCurto(cobranca.periodoAtualFim)}`;
    return [`plano ${planosDoTeste().find((p) => p.id === cobranca.plano)!.nome}`, cobranca.periodo, fim].filter((parte): parte is string => !!parte);
  }
  const textos = { sem_plano: "sem plano", teste_encerrado: "teste grátis encerrado", assinatura_encerrada: "assinatura encerrada", pagamento_pendente: "pagamento pendente" };
  return [textos[situacao as keyof typeof textos] ?? ""];
}

/**
 * A Assinatura pela situação do `GET /me` (backend #180): os planos com o preço da Stripe no período
 * escolhido e, para o administrador, o Assinar. Sem a situação, ou `ativo` sem cobrança na Stripe (o
 * piloto ativado à mão), segue a tela de demonstração.
 */
export function PainelDaAssinatura({ precos }: { precos: PrecoDoPlano[] | null }) {
  const assinatura = useAssinatura();
  const papel = usePapel();
  const conciliacoes = useLimites()?.conciliacoes ?? null;
  const [periodo, setPeriodo] = useState<Periodo>("mensal");

  if (!assinatura || (assinatura.situacao === "ativo" && !assinatura.cobranca)) return <AssinaturaDeDemonstracao />;

  const { situacao, cobranca } = assinatura;
  const assinando = situacao === "ativo" || situacao === "pagamento_pendente";
  const motivo = !precos ? "A assinatura pelo cartão ainda não está no ar." : papel !== "admin" ? "Só o administrador da conta assina." : null;
  const doPeriodo = (plano: PlanoId) => precos?.find((p) => p.plano === plano && p.periodo === periodo);
  const volume = PLANOS.find((p) => p.contato)!;

  return (
    <div>
      <Cabecalho titulo="Assinatura" contexto={contexto(assinatura)} />

      <div className="ass-corpo">
        {situacao === "pagamento_pendente" && (
          <p role="alert" className="aviso-demonstracao">
            O último pagamento não passou. A Stripe vai tentar de novo nos próximos dias; para trocar o cartão, fale com a gente.
          </p>
        )}
        {(situacao === "teste_encerrado" || situacao === "assinatura_encerrada") && (
          <p role="note" className="aviso-demonstracao">
            <strong>O que você já fez continua aqui:</strong> extratos, conciliações e fechamentos. Assine um plano para
            conciliar de novo.
          </p>
        )}
        {!assinando && motivo && (
          <p id={MOTIVO_ID} role="note" className="aviso-demonstracao">
            {motivo}
          </p>
        )}

        <Reveal>
          <section className="ass-planos-caixa">
            <div className="ass-planos-topo">
              <h3 id="assinatura-planos" className="ass-titulo">
                Planos
              </h3>
              {precos && <SeletorDePeriodo periodo={periodo} onMudar={setPeriodo} />}
            </div>
            <ul className="ass-planos" data-quatro="true" aria-labelledby="assinatura-planos">
              {planosDoTeste().map((plano) => {
                const preco = doPeriodo(plano.id);
                const atual = assinando && cobranca?.plano === plano.id;
                const indisponivelId = `assinatura-indisponivel-${plano.id}`;
                return (
                  <li key={plano.id} className="ass-plano" data-atual={atual ? "true" : undefined}>
                    <div className="ass-plano-topo">
                      <h4 className="ass-plano-nome">{plano.nome}</h4>
                      {atual && <span className="ass-plano-atual">Plano atual</span>}
                    </div>
                    <div className="ass-plano-valor">
                      {!precos ? (
                        <>
                          <span className="ass-plano-preco">{plano.preco}</span>
                          <span className="ass-plano-sufixo">/mês</span>
                        </>
                      ) : preco ? (
                        <>
                          <span className="ass-plano-preco">{preco.valor}</span>
                          <span className="ass-plano-sufixo">{SUFIXO[periodo]}</span>
                        </>
                      ) : (
                        <span id={indisponivelId} className="ass-plano-texto">
                          Indisponível neste período
                        </span>
                      )}
                    </div>
                    {preco?.porMes && <p className="ass-plano-texto">{preco.porMes} por mês</p>}
                    {preco?.desconto && <p className="ass-plano-desconto">{preco.desconto}% a menos que o mensal</p>}
                    <span className="ass-plano-filete" aria-hidden="true" />
                    <p className="ass-plano-texto">{plano.limite}</p>
                    {!assinando && (
                      <AssinarPlano
                        plano={plano.id}
                        nome={plano.nome}
                        periodo={periodo}
                        motivoId={motivo ? MOTIVO_ID : precos && !preco ? indisponivelId : null}
                      />
                    )}
                  </li>
                );
              })}
              <li className="ass-plano">
                <div className="ass-plano-topo">
                  <h4 className="ass-plano-nome">{volume.nome}</h4>
                </div>
                <div className="ass-plano-valor">
                  <span className="ass-plano-preco">{volume.preco}</span>
                </div>
                <span className="ass-plano-filete" aria-hidden="true" />
                <p className="ass-plano-texto">{volume.limite}</p>
                <a href="mailto:ledgrtech@gmail.com" className="btn btn-secondary">
                  Fale com a gente
                </a>
              </li>
            </ul>
          </section>
        </Reveal>

        {conciliacoes && (
          <FaixaDoPlano
            contagem={
              conciliacoes.maximo === null
                ? `${conciliacoes.usadas} conciliações este mês`
                : `${conciliacoes.usadas} de ${conciliacoes.maximo} conciliações este mês`
            }
            usadas={conciliacoes.usadas}
            maximo={conciliacoes.maximo}
            aviso={textoDoLimite("conciliacoes", conciliacoes)}
            verPlanos={false}
          />
        )}
      </div>
    </div>
  );
}

/** O Assinar do cartão; desligado, aponta para o motivo. */
function AssinarPlano({
  nome,
  motivoId,
}: {
  plano: PlanoId;
  nome: string;
  periodo: Periodo;
  motivoId: string | null;
}) {
  return (
    <button type="button" className="btn btn-primary" disabled={motivoId !== null} aria-describedby={motivoId ?? undefined}>
      Assinar o {nome}
    </button>
  );
}
