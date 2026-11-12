"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { PLANOS } from "@/lib/planos";
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
import type { Limite } from "@/lib/limites";
import { useAssinatura, useLimites, usePapel } from "../conta";
import { Cabecalho } from "../cabecalho";
import { FaixaFiltros } from "../faixa-filtros";
import { AssinaturaDeDemonstracao } from "./demonstracao";
import { PainelDoPlano, POR_EXTENSO, TextoDaFranquia } from "./painel-do-plano";
import { SeletorDePeriodo } from "./seletor-de-periodo";
import { VoltaDaStripe } from "./volta-da-stripe";

const MOTIVO_ID = "assinatura-motivo";
// o mesmo corte do .fech-area em globals.css: até aí o painel desce para baixo das folhas
const PAINEL_AO_LADO = "(min-width: 1001px)";

function ouvirFragmento(avisar: () => void) {
  window.addEventListener("hashchange", avisar);
  return () => window.removeEventListener("hashchange", avisar);
}
/** O plano do fragmento do endereço; no servidor, que não o recebe, nenhum. */
function usePlanoDoLink(): PlanoId | null {
  const plano = useSyncExternalStore(ouvirFragmento, () => /^#plano-(\w+)$/.exec(window.location.hash ?? "")?.[1] ?? null, () => null);
  return plano && Object.hasOwn(NOME_DO_PLANO, plano) ? (plano as PlanoId) : null;
}

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
 * A Assinatura pela situação do `GET /me` (backend #180), no desenho da mesa de Fechamentos: os planos em
 * folhas com o preço da Stripe no período escolhido e, ao lado, o painel do plano aberto (a sua
 * assinatura, a comparação com outro plano ou o Assinar). O Volume, sem preço de tabela, é um cartão
 * abaixo das folhas. Sem a situação, ou `ativo` sem cobrança na Stripe (o piloto ativado à mão), segue a
 * tela de demonstração.
 */
export function PainelDaAssinatura({ precos }: { precos: PrecoDoPlano[] | null }) {
  const assinatura = useAssinatura();
  const papel = usePapel();
  const limites = useLimites();
  // sem escolha, o período da assinatura (que chega depois da volta da Stripe), ou o mensal
  const [escolhido, setPeriodo] = useState<Periodo | null>(null);
  const [aberto, setAberto] = useState<PlanoId | null>(null);
  // nada anima ao abrir a tela, só o que a pessoa mudou
  const [mudou, setMudou] = useState(false);
  const painel = useRef<HTMLElement>(null);

  // a tela de bloqueio manda para /assinatura#plano-padrao: abre direto o plano que a pessoa escolheu lá
  const planoDoLink = usePlanoDoLink();

  if (!assinatura || (assinatura.situacao === "ativo" && !assinatura.cobranca)) return <AssinaturaDeDemonstracao />;

  const { situacao, cobranca, plano: planoDaConta, testeTerminaEm } = assinatura;
  const periodo = escolhido ?? cobranca?.periodo ?? "mensal";
  const assinando = situacao === "ativo" || situacao === "pagamento_pendente";
  const planoAtual = assinando ? (cobranca?.plano ?? planoDaConta) : null;
  const planoAberto = aberto ?? planoDoLink ?? planoAtual ?? planoDaConta ?? "padrao";
  const motivo = !precos ? "A assinatura pelo cartão ainda não está no ar." : papel !== "admin" ? "Só o administrador da conta assina." : null;
  const doPeriodo = (plano: PlanoId) => precos?.find((p) => p.plano === plano && p.periodo === periodo);
  const volume = PLANOS.find((p) => p.contato)!;
  // "Grátis até": só no teste que ainda não cobra na hora (a Stripe exige 48 horas de antecedência)
  const gratisAte = situacao === "teste" && testeTerminaEm && !cobrancaImediata(assinatura, new Date()) ? formatarDiaCurto(testeTerminaEm, new Date()) : null;

  function abrir(plano: PlanoId) {
    setMudou(true);
    setAberto(plano);
    // com o painel abaixo das folhas, escolher sem ver o que mudou não diria nada
    if (!window.matchMedia?.(PAINEL_AO_LADO).matches) painel.current?.scrollIntoView?.({ block: "start" });
  }

  function mudarPeriodo(novo: Periodo) {
    setMudou(true);
    setPeriodo(novo);
  }

  return (
    <div>
      <Cabecalho titulo="Assinatura" contexto={contexto(assinatura)} />

      <div className="extratos-corpo ass-mesa-corpo">
        <VoltaDaStripe />
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

        {precos && (
          <FaixaFiltros>
            <SeletorDePeriodo periodo={periodo} onMudar={mudarPeriodo} />
          </FaixaFiltros>
        )}

        <div className="extratos-area fech-area ass-mesa" data-mudou={mudou || undefined}>
          <div className="grupos">
            <section className="grupo" aria-labelledby="assinatura-planos">
              <div className="grupo-topo">
                <h2 id="assinatura-planos" className="grupo-titulo">
                  Planos
                </h2>
                <span className="grupo-meta">3 planos</span>
              </div>
              <div className="grupo-corpo">
                <ul className="extratos-grade ass-folhas" data-longo={periodo !== "mensal" || undefined} aria-labelledby="assinatura-planos">
                  {planosDoTeste().map((plano) => (
                    <FolhaDoPlano
                      key={plano.id}
                      id={plano.id}
                      nome={plano.nome}
                      preco={doPeriodo(plano.id)}
                      periodo={periodo}
                      comPrecos={precos !== null}
                      franquia={textoDaFranquia(precos, plano.id)}
                      uso={plano.id === planoAtual ? (limites?.conciliacoes ?? null) : null}
                      seu={plano.id === planoAtual}
                      pendente={situacao === "pagamento_pendente"}
                      aberta={plano.id === planoAberto}
                      gratisAte={plano.id === planoAberto ? gratisAte : null}
                      aoAbrir={() => abrir(plano.id)}
                    />
                  ))}
                </ul>
              </div>
            </section>

            <section className="nova-ia-card ass-volume" aria-labelledby="assinatura-volume">
              <Image className="nova-ia-mascote ass-volume-mascote" src="/mascotes/mascote-maleta.png" alt="" width={778} height={720} sizes="160px" />
              <div className="ass-volume-texto">
                <span className="rotulo">Plano {volume.nome} · sob consulta</span>
                <h3 id="assinatura-volume" className="font-titulo">
                  Concilia em grande volume?
                </h3>
                <p>
                  Para <b>indústria e multi-banco</b>. A equipe monta o plano com você.
                </p>
              </div>
              <a href="mailto:ledgrtech@gmail.com" className="btn btn-secondary">
                Fale com a gente <ArrowRight aria-hidden="true" />
              </a>
            </section>
          </div>

          <PainelDoPlano
            ref={painel}
            assinatura={assinatura}
            plano={planoAberto}
            planoAtual={planoAtual}
            periodo={periodo}
            precos={precos}
            limites={limites}
            motivoId={motivo ? MOTIVO_ID : doPeriodo(planoAberto) ? null : `assinatura-indisponivel-${planoAberto}`}
            aoVoltar={planoAtual ? () => abrir(planoAtual) : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/** Uma folha da mesa, com o mesmo desenho nos três planos; na sua, o meio é o uso do mês. */
function FolhaDoPlano({
  id,
  nome,
  preco,
  periodo,
  comPrecos,
  franquia,
  uso,
  seu,
  pendente,
  aberta,
  gratisAte,
  aoAbrir,
}: {
  id: PlanoId;
  nome: string;
  preco: PrecoDoPlano | undefined;
  periodo: Periodo;
  comPrecos: boolean;
  franquia: string | null;
  uso: Limite | null;
  seu: boolean;
  pendente: boolean;
  aberta: boolean;
  gratisAte: string | null;
  aoAbrir: () => void;
}) {
  return (
    // o id é o destino do "Assinar o X" da tela de bloqueio (/assinatura#plano-padrao)
    <li id={`plano-${id}`}>
      <button type="button" className="extrato-cartao" data-tom={seu ? (pendente ? "risco" : "ok") : undefined} aria-pressed={aberta} onClick={aoAbrir}>
        <span className="extrato-folha mes-folha ass-folha">
          <span className="extrato-folha-titulo">{seu ? "Seu plano" : "Plano"}</span>
          <span className="mes-folha-nome">{nome}</span>
          <MeioDaFolha franquia={franquia} uso={uso} />
          {/* sem os preços da Stripe, nenhum valor: os de lib/planos não valem (#296) */}
          {comPrecos && (
            <span className="ass-folha-pe">
              {preco ? (
                <>
                  {/* a chave troca junto com o valor, e o valor novo chega com um fade */}
                  <span key={preco.valor} className="mes-folha-taxa ass-folha-preco">
                    {preco.valor}
                  </span>
                  <span className="mes-folha-rotulo">{POR_EXTENSO[periodo]}</span>
                  {preco.porMes && <span className="mes-folha-rotulo">{preco.porMes} por mês</span>}
                  {preco.desconto && <span className="ass-folha-desconto">{preco.desconto}% a menos</span>}
                </>
              ) : (
                <span id={`assinatura-indisponivel-${id}`} className="mes-folha-rotulo">
                  Indisponível neste período
                </span>
              )}
            </span>
          )}
          {gratisAte && <span className="ass-folha-selo">Grátis até {gratisAte}</span>}
        </span>
        {seu && <span className={pendente ? "selo selo-risco" : "selo selo-ok"}>{pendente ? "Pagamento pendente" : "Plano atual"}</span>}
      </button>
    </li>
  );
}

function MeioDaFolha({ franquia, uso }: { franquia: string | null; uso: Limite | null }) {
  if (uso) {
    return (
      <>
        <span className="ass-folha-meio">
          <b>{uso.maximo === null ? uso.usadas : `${uso.usadas} de ${uso.maximo}`}</b> {uso.maximo === null && uso.usadas === 1 ? "conciliação" : "conciliações"} este mês
        </span>
        {uso.maximo !== null && (
          <span className="vg-progresso">
            <span className="vg-progresso-feito" style={{ width: `${uso.maximo === 0 ? 100 : Math.min(100, Math.max(3, Math.round((uso.usadas / uso.maximo) * 100)))}%` }} />
          </span>
        )}
      </>
    );
  }
  if (franquia) {
    return (
      <span className="ass-folha-meio">
        <TextoDaFranquia texto={franquia} />
      </span>
    );
  }
  // sem número no backend: as linhas do papel, como nas folhas de Conciliações
  return (
    <span className="conc-folha-linhas ass-folha-linhas" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
