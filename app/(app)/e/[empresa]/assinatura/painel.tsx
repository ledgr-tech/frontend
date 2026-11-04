"use client";

import { useRef, useState } from "react";
import { Reveal } from "@/app/reveal";
import { PLANOS } from "@/lib/planos";
import { textoDoLimite } from "@/lib/limites";
import { useRoteador } from "@/lib/roteador";
import {
  cobrancaImediata,
  diasRestantes,
  formatarDiaCurto,
  fraseDoTeste,
  NOME_DO_PLANO,
  planosDoTeste,
  textoDaFranquia,
  type Assinatura,
  type Periodo,
  type PlanoId,
  type PrecoDoPlano,
} from "@/lib/assinatura";
import { useAssinatura, useLimites, usePapel } from "../conta";
import { Cabecalho } from "../cabecalho";
import { FaixaDoPlano } from "../empresas/faixa-do-plano";
import { AssinaturaDeDemonstracao } from "./demonstracao";
import { iniciarCheckout } from "./acoes";
import { SeletorDePeriodo } from "./seletor-de-periodo";
import { VoltaDaStripe } from "./volta-da-stripe";

const MOTIVO_ID = "assinatura-motivo";
const SUFIXO: Record<Periodo, string> = { mensal: "/mês", trimestral: "/trimestre", semestral: "/semestre", anual: "/ano" };

function contexto(assinatura: Assinatura): string[] {
  const { situacao, testeTerminaEm, cobranca } = assinatura;
  if (situacao === "teste") {
    return [testeTerminaEm ? fraseDoTeste(diasRestantes(testeTerminaEm, new Date())).toLowerCase() : "teste grátis"];
  }
  if (situacao === "ativo" && cobranca) {
    const fim = cobranca.periodoAtualFim && `${cobranca.cancelaNoFim ? "termina" : "renova"} em ${formatarDiaCurto(cobranca.periodoAtualFim, new Date())}`;
    return [`plano ${NOME_DO_PLANO[cobranca.plano]}`, cobranca.periodo, fim].filter((parte): parte is string => !!parte);
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
  // sem escolha, o período da assinatura (que chega depois da volta da Stripe), ou o mensal
  const [escolhido, setPeriodo] = useState<Periodo | null>(null);

  if (!assinatura || (assinatura.situacao === "ativo" && !assinatura.cobranca)) return <AssinaturaDeDemonstracao />;

  const { situacao, cobranca } = assinatura;
  const periodo = escolhido ?? cobranca?.periodo ?? "mensal";
  const assinando = situacao === "ativo" || situacao === "pagamento_pendente";
  const motivo = !precos ? "A assinatura pelo cartão ainda não está no ar." : papel !== "admin" ? "Só o administrador da conta assina." : null;
  const doPeriodo = (plano: PlanoId) => precos?.find((p) => p.plano === plano && p.periodo === periodo);
  const volume = PLANOS.find((p) => p.contato)!;

  return (
    <div>
      <Cabecalho titulo="Assinatura" contexto={contexto(assinatura)} />

      <div className="ass-corpo">
        <VoltaDaStripe />
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
          <p role="note" className="aviso-demonstracao">
            <span id={MOTIVO_ID}>{motivo}</span>
            {/* com o cartão fora do ar, assinar segue sendo pela equipe, como era na /plano */}
            {!precos && (
              <>
                {" "}
                <a href="mailto:ledgrtech@gmail.com?subject=Assinar%20um%20plano">Fale com a gente para assinar</a>
              </>
            )}
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
                const franquia = textoDaFranquia(precos, plano.id);
                const atual = assinando && cobranca?.plano === plano.id;
                const indisponivelId = `assinatura-indisponivel-${plano.id}`;
                return (
                  // o id é o destino do "Assinar o X" da tela de bloqueio (/assinatura#plano-padrao)
                  <li key={plano.id} id={`plano-${plano.id}`} className="ass-plano" data-atual={atual ? "true" : undefined}>
                    <div className="ass-plano-topo">
                      <h4 className="ass-plano-nome">{plano.nome}</h4>
                      {atual && <span className="ass-plano-atual">Plano atual</span>}
                    </div>
                    {/* sem os preços da Stripe, nenhum valor: os de lib/planos não valem (#296) */}
                    {precos && (
                      <div className="ass-plano-valor">
                        {preco ? (
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
                    )}
                    {preco?.porMes && <p className="ass-plano-texto">{preco.porMes} por mês</p>}
                    {preco?.desconto && <p className="ass-plano-desconto">{preco.desconto}% a menos que o mensal</p>}
                    {franquia && (
                      <>
                        <span className="ass-plano-filete" aria-hidden="true" />
                        <p className="ass-plano-texto">{franquia}</p>
                      </>
                    )}
                    {!assinando && (
                      <AssinarPlano
                        assinatura={assinatura}
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
                  <span className="ass-plano-preco">Sob consulta</span>
                </div>
                <span className="ass-plano-filete" aria-hidden="true" />
                <p className="ass-plano-texto">{volume.descricao}</p>
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

// os dias que sobraram só existem no teste em andamento (com menos de 48 horas)
const avisoImediato = (assinatura: Assinatura) =>
  assinatura.situacao === "teste"
    ? "A cobrança é feita agora. Os dias de teste que sobraram não ficam para depois."
    : "A cobrança é feita agora.";

/**
 * O Assinar do cartão; desligado, aponta para o motivo. Quando a cobrança é na hora (menos de 48 horas
 * de teste, ou sem teste), o primeiro clique só avisa. Uma `ref` trava antes do primeiro `await`.
 */
function AssinarPlano({
  assinatura,
  plano,
  nome,
  periodo,
  motivoId,
}: {
  assinatura: Assinatura;
  plano: PlanoId;
  nome: string;
  periodo: Periodo;
  motivoId: string | null;
}) {
  const { refresh } = useRoteador();
  const travado = useRef(false);
  const [avisado, setAvisado] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const imediata = cobrancaImediata(assinatura, new Date());

  async function assinar() {
    if (travado.current) return;
    if (imediata && !avisado) return setAvisado(true);
    travado.current = true;
    setAbrindo(true);
    setErro(null);
    const resposta = await iniciarCheckout(plano, periodo);
    // a trava fica: a página está saindo para a Stripe
    if (resposta.ok) return window.location.assign(resposta.dados.url);
    travado.current = false;
    setAbrindo(false);
    setErro(resposta.erro);
    // 409: a conta já assina (outra aba, ou o webhook chegou); relê o /me
    if (resposta.status === 409) refresh();
  }

  return (
    <>
      {motivoId === null && avisado && <p className="ass-plano-texto">{avisoImediato(assinatura)}</p>}
      {motivoId === null && !imediata && assinatura.testeTerminaEm && (
        <p className="ass-plano-texto">Você só paga em {formatarDiaCurto(assinatura.testeTerminaEm, new Date())}, quando o teste acaba.</p>
      )}
      {erro && (
        <p role="alert" className="ass-plano-erro">
          {erro}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={motivoId !== null || abrindo}
        aria-describedby={motivoId ?? undefined}
        onClick={assinar}
      >
        {abrindo ? "Abrindo a Stripe…" : avisado ? "Assinar e pagar agora" : `Assinar o ${nome}`}
      </button>
    </>
  );
}
