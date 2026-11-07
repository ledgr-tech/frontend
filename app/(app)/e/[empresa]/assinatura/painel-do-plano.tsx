"use client";

import Image from "next/image";
import { Circle, CircleCheck } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import {
  cobrancaImediata,
  diasRestantes,
  emReais,
  formatarDiaCurto,
  MESES_DO_PERIODO,
  NOME_DO_PLANO,
  textoDaFranquia,
  type Assinatura,
  type Periodo,
  type PlanoId,
  type PrecoDoPlano,
} from "@/lib/assinatura";
import { textoDoLimite, type Limite, type LimitesDaConta } from "@/lib/limites";
import { useRoteador } from "@/lib/roteador";
import { CURVA_DE_SAIDA, useTrocaSuave } from "@/lib/troca-suave";
import { iniciarCheckout } from "./acoes";

export const POR_EXTENSO: Record<Periodo, string> = { mensal: "por mês", trimestral: "por trimestre", semestral: "por semestre", anual: "por ano" };

/** "até 80 conciliações por mês", com o número em destaque. */
export function TextoDaFranquia({ texto }: { texto: string }) {
  const [, numero, resto] = /^até (\S+) (.*)$/.exec(texto) ?? [];
  if (!numero) return texto;
  return (
    <>
      até <b>{numero}</b> {resto}
    </>
  );
}

function Passo({ feito, titulo, children }: { feito: boolean; titulo: string; children: ReactNode }) {
  return (
    <li className="fech-passo" data-feito={feito}>
      <span className="fech-passo-icone" aria-hidden="true">
        {feito ? <CircleCheck size={18} /> : <Circle size={18} />}
      </span>
      <div className="fech-passo-corpo">
        <span className="fech-passo-titulo">{titulo}</span>
        {children}
      </div>
    </li>
  );
}

function LinhaDeUso({ rotulo, limite }: { rotulo: string; limite: Limite }) {
  const { usadas, maximo } = limite;
  return (
    <div className="ass-uso">
      <span className="ass-uso-linha">
        <span>{rotulo}</span>
        <b>{maximo === null ? usadas : `${usadas} de ${maximo}`}</b>
      </span>
      {maximo !== null && (
        <span className="vg-progresso">
          <span className="vg-progresso-feito" style={{ width: `${maximo === 0 ? 100 : Math.min(100, Math.round((usadas / maximo) * 100))}%` }} />
        </span>
      )}
    </div>
  );
}

function DadosDoPlano({ preco, franquia, extra }: { preco: PrecoDoPlano | undefined; franquia: string | null; extra?: ReactNode }) {
  if (!preco && !franquia && !extra) return null;
  return (
    <dl className="conc-previa-dados">
      {preco && (
        <>
          <dt>Preço</dt>
          <dd>
            <b>{preco.valor}</b> {POR_EXTENSO[preco.periodo]}
          </dd>
          {preco.porMes && (
            <>
              <dt>Por mês</dt>
              <dd>{preco.porMes}</dd>
            </>
          )}
          {preco.desconto && (
            <>
              <dt>Desconto</dt>
              <dd className="ass-desconto">{preco.desconto}% a menos que o mensal</dd>
            </>
          )}
        </>
      )}
      {franquia && (
        <>
          <dt>Franquia</dt>
          <dd>
            <TextoDaFranquia texto={franquia} />
          </dd>
        </>
      )}
      {extra}
    </dl>
  );
}

/** O painel ao lado das folhas, que segue a folha aberta: a sua assinatura, a comparação ou o Assinar. */
export function PainelDoPlano({
  ref,
  assinatura,
  plano,
  planoAtual,
  periodo,
  precos,
  limites,
  motivoId,
  aoVoltar,
}: {
  ref: Ref<HTMLElement>;
  assinatura: Assinatura;
  plano: PlanoId;
  planoAtual: PlanoId | null;
  periodo: Periodo;
  precos: PrecoDoPlano[] | null;
  limites: LimitesDaConta | null;
  motivoId: string | null;
  aoVoltar?: () => void;
}) {
  const proprio = useRef<HTMLElement>(null);
  const assinando = assinatura.situacao === "ativo" || assinatura.situacao === "pagamento_pendente";
  const modo = !assinando ? "assinar" : plano === planoAtual ? "conta" : "comparar";
  useTrocaSuave(proprio, `${modo}-${plano}`);
  useAlturaSuave(proprio);

  const doPeriodo = (id: PlanoId, em: Periodo) => precos?.find((p) => p.plano === id && p.periodo === em);

  return (
    <section
      ref={(no) => {
        proprio.current = no;
        if (typeof ref === "function") ref(no);
        else if (ref) ref.current = no;
      }}
      className="extrato-painel fech-painel ass-painel"
      aria-label="Plano escolhido"
      aria-live="polite"
    >
      {modo === "conta" && (
        <SuaAssinatura
          assinatura={assinatura}
          plano={plano}
          preco={assinatura.cobranca ? doPeriodo(plano, assinatura.cobranca.periodo) : undefined}
          franquia={textoDaFranquia(precos, plano)}
          limites={limites}
        />
      )}
      {modo === "comparar" && (
        <Comparacao
          plano={plano}
          planoAtual={planoAtual}
          periodo={periodo}
          preco={doPeriodo(plano, periodo)}
          precoAtual={planoAtual ? doPeriodo(planoAtual, periodo) : undefined}
          franquia={textoDaFranquia(precos, plano)}
          teto={precos?.find((p) => p.plano === plano)?.conciliacoesPorMes ?? null}
          usadas={limites?.conciliacoes?.usadas ?? null}
          aoVoltar={aoVoltar}
        />
      )}
      {modo === "assinar" && (
        <ParaAssinar
          assinatura={assinatura}
          plano={plano}
          periodo={periodo}
          preco={doPeriodo(plano, periodo)}
          franquia={textoDaFranquia(precos, plano)}
          uso={limites?.conciliacoes ?? null}
          motivoId={motivoId}
        />
      )}
    </section>
  );
}

function SuaAssinatura({
  assinatura,
  plano,
  preco,
  franquia,
  limites,
}: {
  assinatura: Assinatura;
  plano: PlanoId;
  preco: PrecoDoPlano | undefined;
  franquia: string | null;
  limites: LimitesDaConta | null;
}) {
  const { situacao, cobranca } = assinatura;
  const pendente = situacao === "pagamento_pendente";
  const fim = cobranca?.periodoAtualFim ? formatarDiaCurto(cobranca.periodoAtualFim, new Date()) : null;
  const termina = cobranca?.cancelaNoFim === true;
  const conciliacoes = limites?.conciliacoes ?? null;
  const avisoDoUso = conciliacoes && textoDoLimite("conciliacoes", conciliacoes);

  return (
    <>
      <h6 style={{ margin: 0 }}>Sua assinatura · {pendente ? "pagamento pendente" : termina ? "termina no fim do período" : "em dia"}</h6>
      <div className="extrato-painel-topo">
        <h3 className="extrato-painel-nome">{NOME_DO_PLANO[plano]}</h3>
        {!pendente && !termina && <Image src="/mascotes/mascote-joinha.png" alt="" width={1073} height={1173} sizes="56px" className="ass-painel-mascote" />}
      </div>
      {(preco || franquia) && (
        <p className="fech-passo-texto ass-painel-texto">
          {preco && (
            <>
              <b>{preco.valor}</b> {POR_EXTENSO[preco.periodo]}, no cartão
            </>
          )}
          {preco && franquia && " · "}
          {franquia && <TextoDaFranquia texto={franquia} />}
        </p>
      )}
      <ol className="fech-passos ass-passos">
        <Passo feito={!pendente} titulo="Último pagamento">
          {pendente ? (
            <span role="alert" className="fech-passo-texto">
              <b>Não passou.</b> A Stripe vai tentar de novo nos próximos dias.
            </span>
          ) : (
            <span className="fech-passo-texto">
              <b>Em dia.</b>
              {fim && (
                <>
                  {" "}
                  {termina ? "Termina" : "Renova"} em <b>{fim}</b>.
                </>
              )}
            </span>
          )}
        </Passo>
        {limites && (conciliacoes || limites.empresas || limites.usuarios) && (
          <Passo feito titulo="Uso neste mês">
            <div className="ass-usos">
              {conciliacoes && <LinhaDeUso rotulo="Conciliações" limite={conciliacoes} />}
              {limites.empresas && <LinhaDeUso rotulo="Empresas" limite={limites.empresas} />}
              {limites.usuarios && <LinhaDeUso rotulo="Pessoas" limite={limites.usuarios} />}
            </div>
            {avisoDoUso && <span className="fech-passo-texto">{avisoDoUso}</span>}
          </Passo>
        )}
      </ol>
      {/* ponytail: cartão, faturas e cancelamento esperam o PR 2 do backend #166; até lá, pela equipe */}
      <p className="fech-passo-texto ass-painel-texto">Cartão, faturas e cancelamento ainda não aparecem aqui.</p>
      <div className="conc-previa-acoes">
        <a href="mailto:ledgrtech@gmail.com?subject=Trocar%20o%20cart%C3%A3o" className="btn btn-primary">
          Trocar o cartão
        </a>
        <a href="mailto:ledgrtech@gmail.com?subject=Pedir%20uma%20fatura" className="btn btn-secondary">
          Pedir uma fatura
        </a>
      </div>
      {!termina && (
        <a href="mailto:ledgrtech@gmail.com?subject=Cancelar%20a%20assinatura" className="conc-mes-link ass-painel-link">
          Cancelar a assinatura
        </a>
      )}
    </>
  );
}

function Comparacao({
  plano,
  planoAtual,
  periodo,
  preco,
  precoAtual,
  franquia,
  teto,
  usadas,
  aoVoltar,
}: {
  plano: PlanoId;
  planoAtual: PlanoId | null;
  periodo: Periodo;
  preco: PrecoDoPlano | undefined;
  precoAtual: PrecoDoPlano | undefined;
  franquia: string | null;
  teto: number | null;
  usadas: number | null;
  aoVoltar?: () => void;
}) {
  // os dois no mesmo período, pelo valor de um mês, para comparar igual com igual
  const meses = MESES_DO_PERIODO[periodo];
  const diferenca = preco && precoAtual ? Math.round((preco.centavos - precoAtual.centavos) / meses) : 0;
  const estoura = teto !== null && usadas !== null && usadas > teto;

  return (
    <>
      <h6 style={{ margin: 0 }}>{planoAtual ? "Comparando com o seu plano" : "Plano"}</h6>
      <div className="extrato-painel-topo">
        <h3 className="extrato-painel-nome">{NOME_DO_PLANO[plano]}</h3>
      </div>
      <DadosDoPlano
        preco={preco}
        franquia={franquia}
        extra={
          diferenca !== 0 && planoAtual ? (
            <>
              <dt>Diferença</dt>
              <dd>
                <b>
                  {emReais(Math.abs(diferenca))} {diferenca > 0 ? "a mais" : "a menos"}
                </b>{" "}
                por mês que o {NOME_DO_PLANO[planoAtual]}
                {periodo !== "mensal" && `, os dois no ${periodo}`}
              </dd>
            </>
          ) : undefined
        }
      />
      {estoura && (
        <p role="note" className="aviso-demonstracao ass-painel-aviso">
          Neste mês você fez <b>{usadas} conciliações</b>, e este plano inclui até <b>{teto}</b>.
        </p>
      )}
      <p className="fech-passo-texto ass-painel-texto">Para trocar de plano, fale com a gente.</p>
      <div className="conc-previa-acoes">
        <a href="mailto:ledgrtech@gmail.com?subject=Trocar%20de%20plano" className="btn btn-primary">
          Fale com a gente para trocar
        </a>
      </div>
      {aoVoltar && (
        <button type="button" className="fech-link ass-painel-voltar" onClick={aoVoltar}>
          Voltar à sua assinatura
        </button>
      )}
    </>
  );
}

function ParaAssinar({
  assinatura,
  plano,
  periodo,
  preco,
  franquia,
  uso,
  motivoId,
}: {
  assinatura: Assinatura;
  plano: PlanoId;
  periodo: Periodo;
  preco: PrecoDoPlano | undefined;
  franquia: string | null;
  uso: Limite | null;
  motivoId: string | null;
}) {
  const { situacao, testeTerminaEm } = assinatura;
  const emTeste = situacao === "teste";
  const agora = new Date();
  const imediata = cobrancaImediata(assinatura, agora);
  const dias = emTeste && testeTerminaEm ? diasRestantes(testeTerminaEm, agora) : null;
  const avisoDoUso = uso && textoDoLimite("conciliacoes", uso);

  return (
    <>
      <h6 style={{ margin: 0 }}>{emTeste ? "Para assinar" : "Para conciliar de novo"}</h6>
      <div className="extrato-painel-topo">
        <h3 className="extrato-painel-nome">{NOME_DO_PLANO[plano]}</h3>
        {emTeste && <Image src="/mascotes/mascote-explicando.png" alt="" width={1000} height={1000} sizes="56px" className="ass-painel-mascote" />}
      </div>
      <DadosDoPlano preco={preco} franquia={franquia} />
      <ol className="fech-passos ass-passos">
        {emTeste
          ? dias !== null && (
              <Passo feito titulo="Teste grátis">
                <span className="fech-passo-texto">
                  {dias === 0 ? (
                    <>
                      É o <b>último dia</b>.
                    </>
                  ) : (
                    <>
                      {dias === 1 ? "Falta" : "Faltam"} <b>{dias === 1 ? "1 dia" : `${dias} dias`}</b>.
                    </>
                  )}
                </span>
              </Passo>
            )
          : situacao !== "sem_plano" && (
              <Passo feito titulo="O que você já fez continua aqui">
                <span className="fech-passo-texto">Extratos, conciliações e fechamentos.</span>
              </Passo>
            )}
        <Passo feito={false} titulo="Primeira cobrança">
          <span className="fech-passo-texto">
            {imediata || !testeTerminaEm ? (
              <b>É feita agora.</b>
            ) : (
              <>
                Em <b>{formatarDiaCurto(testeTerminaEm, agora)}</b>, quando o teste acaba.
              </>
            )}
          </span>
        </Passo>
        {uso && (
          <Passo feito titulo="Uso neste mês">
            <span className="fech-passo-texto">{uso.maximo === null ? `${uso.usadas} conciliações este mês` : `${uso.usadas} de ${uso.maximo} conciliações este mês`}</span>
            {avisoDoUso && <span className="fech-passo-texto">{avisoDoUso}</span>}
          </Passo>
        )}
      </ol>
      <AssinarPlano assinatura={assinatura} plano={plano} periodo={periodo} motivoId={motivoId} />
    </>
  );
}

// os dias que sobraram só existem no teste em andamento (com menos de 48 horas)
const avisoImediato = (assinatura: Assinatura) =>
  assinatura.situacao === "teste"
    ? "A cobrança é feita agora. Os dias de teste que sobraram não ficam para depois."
    : "A cobrança é feita agora.";

/**
 * O Assinar do plano aberto; desligado, aponta para o motivo. Quando a cobrança é na hora (menos de 48
 * horas de teste, ou sem teste), o primeiro clique só avisa. Uma `ref` trava antes do primeiro `await`, e
 * segue valendo se a pessoa abrir outra folha enquanto a Stripe carrega.
 */
function AssinarPlano({
  assinatura,
  plano,
  periodo,
  motivoId,
}: {
  assinatura: Assinatura;
  plano: PlanoId;
  periodo: Periodo;
  motivoId: string | null;
}) {
  const { refresh } = useRoteador();
  const travado = useRef(false);
  const [avisado, setAvisado] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // o aviso e o erro são do plano em que aconteceram: abrir outra folha começa de novo
  const [doPlano, setDoPlano] = useState(plano);
  if (doPlano !== plano) {
    setDoPlano(plano);
    setAvisado(false);
    setErro(null);
  }
  const imediata = cobrancaImediata(assinatura, new Date());
  const nome = NOME_DO_PLANO[plano];

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
      {motivoId === null && avisado && <p className="fech-passo-texto ass-painel-texto">{avisoImediato(assinatura)}</p>}
      {erro && (
        <p role="alert" className="ass-plano-erro">
          {erro}
        </p>
      )}
      <div className="conc-previa-acoes">
        <button
          type="button"
          className="btn btn-primary"
          disabled={motivoId !== null || abrindo}
          aria-describedby={motivoId ?? undefined}
          onClick={assinar}
        >
          {abrindo ? "Abrindo a Stripe…" : avisado ? "Assinar e pagar agora" : `Assinar o ${nome}`}
        </button>
      </div>
    </>
  );
}

/** A altura do painel acompanha o conteúdo, em vez de pular; a troca de conteúdo fica com `useTrocaSuave`. */
function useAlturaSuave(ref: RefObject<HTMLElement | null>) {
  const anterior = useRef<number | null>(null);
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const altura = elemento.offsetHeight;
    const antes = anterior.current;
    anterior.current = altura;
    if (antes === null || antes === altura || typeof elemento.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    elemento.animate(
      [
        { height: `${antes}px`, overflow: "hidden" },
        { height: `${altura}px`, overflow: "hidden" },
      ],
      { duration: 240, easing: CURVA_DE_SAIDA },
    );
  });
}
