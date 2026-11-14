"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { SaldoDoExtrato } from "@/lib/adaptadores";
import { formatarMoeda, type LinhaComparacao } from "@/lib/mock-data";
import { useRoteador } from "@/lib/roteador";
import { aprovadaDepois } from "@/lib/aprovacao";
import { MensagemErro } from "@/app/(auth)/_compartilhado/mensagem-erro";
import { estaResolvida, formatarDataHora } from "../../dashboard/resumo";
import { SeloIa } from "../../selo-ia";
import { useNome } from "../../conta";
import { SEM_SALDO, data as dataDoSaldo } from "../../saldo";
import { explicarDivergencia, type Explicacao, type Indisponibilidade } from "../acoes";
import { dadosDoLancamento, type ValorDoLado } from "./cartao-lancamento";
import { acoesDoPainel, ofereceExplicacao } from "./painel-da-comparacao";
import { DetalhesDaLinha, ListaDeDetalhes, useDetalhesDaDivergencia } from "./[linha]/detalhes-da-divergencia";
import { seloDaLinha, situacaoDaLinha } from "./situacao";
import { semMovimento, useAvisoDeRolagem } from "../aviso-de-rolagem";
import { BotaoDeExplicar } from "./botao-de-explicar";
import { TextoDigitado } from "./texto-digitado";

/**
 * O painel da direita da comparação (issue #338): o lançamento em que o mouse está, grande, e embaixo os
 * dois saldos do extrato e o caminho de volta ao topo. Substitui o balão do hover onde há margem para ele
 * (a partir de 1100px, ver `.comparacao-grade` em globals.css). A altura do quadro acompanha a
 * janela; dentro da mesma janela só o conteúdo muda quando o ponteiro troca de linha.
 */

const FALHA = "Não foi possível pedir a explicação agora. Tente de novo em instantes.";

// "desabilitado" fica de fora de propósito: recurso desligado não é falha (como no detalhe da linha)
const AVISO: Partial<Record<Indisponibilidade, string>> = {
  erro_provedor: "A explicação automática não respondeu agora; este é o texto padrão do Ledgr.",
  limite_diario: "O limite diário de explicações automáticas acabou (volta às 21h); este é o texto padrão do Ledgr.",
};

type Modo = "justificar" | "rejeitar" | "desfazerAprovacao" | null;

export type PropsDoPainel = {
  /** A linha em foco (o ponteiro, ou a que foi fixada com um clique); null enquanto não houve nenhuma. */
  linha: LinhaComparacao | null;
  fixada: boolean;
  /** A rodada das linhas na tela: diz se uma conferência ainda vale. */
  rodada: number;
  /** Todas as linhas: o lado que falta numa divergência está numa delas. */
  linhas: LinhaComparacao[];
  /** `undefined` é o backend sem o saldo (#118): o painel não fala de saldo. */
  saldo: SaldoDoExtrato | null | undefined;
  /** Com dado do backend: só ele tem a explicação sob pedido. */
  real: boolean;
  /** Há onde gravar a decisão, a rodada é a que vale e o mês está aberto. */
  podeDecidir: boolean;
  /** Aprovar e rejeitar a justificativa: só o admin e o gestor. */
  podeAprovar: boolean;
  /** Devolvem o motivo de não ter gravado, ou null. */
  onJustificar: (texto: string) => Promise<string | null>;
  onAprovar: () => Promise<string | null>;
  /** O motivo é opcional: vazio vai sem texto. */
  onRejeitar: (motivo: string) => Promise<string | null>;
  onDesfazer: () => Promise<string | null>;
  /** Volta a justificativa aprovada para aguardando; só quem aprovou (backend #164). */
  onDesfazerAprovacao: () => Promise<string | null>;
  /** A explicação nasceu: quem guarda a conciliação a põe na linha. */
  onExplicada: (linha: LinhaComparacao, explicacao: Explicacao) => void;
  onAbrirDetalhe: () => void;
  /** Escrevendo ou esperando uma resposta: a tabela não troca a linha em foco por baixo da pessoa. */
  onOcupar: (ocupado: boolean) => void;
};

export function PainelDoExtrato(props: PropsDoPainel) {
  const { linha, fixada, saldo } = props;
  return (
    <aside className="comp-painel conc-previa" aria-label="Detalhe da linha e saldo do extrato" data-tutorial="painel">
      {/* só avisa leitor de tela quando a linha está fixada: o ponteiro passando mudaria o texto a cada linha */}
      <div aria-live={fixada ? "polite" : "off"}>
        <QuadroDoLancamento key={linha?.id ?? "vazio"} {...props} />
      </div>
      <Saldos saldo={saldo} />
    </aside>
  );
}

function QuadroDoLancamento({
  linha,
  fixada,
  rodada,
  linhas,
  real,
  podeDecidir,
  podeAprovar,
  onJustificar,
  onAprovar,
  onRejeitar,
  onDesfazer,
  onDesfazerAprovacao,
  onExplicada,
  onAbrirDetalhe,
  onOcupar,
}: PropsDoPainel) {
  const router = useRoteador();
  const nome = useNome();
  const idCampo = useId();
  const idErro = useId();
  const idForm = useId();
  const [modoEscolhido, setModo] = useState<Modo>(null);
  const [texto, setTexto] = useState("");
  const [emBranco, setEmBranco] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [explicando, setExplicando] = useState(false);
  const [falhaDaExplicacao, setFalhaDaExplicacao] = useState<string | null>(null);
  const [avisoDaExplicacao, setAvisoDaExplicacao] = useState<string | null>(null);
  // a explicação que a pessoa acabou de pedir sobe com destaque; a que já veio na listagem só aparece
  const [recemExplicada, setRecemExplicada] = useState(false);
  // o texto que já terminou de ser digitado: outra explicação na mesma linha volta a esperar a digitação
  const [digitado, setDigitado] = useState<string | null>(null);
  const { caixa: caixaDoDetalhe, conteudo: conteudoDoDetalhe, medir, descer, acima, abaixo } = useAvisoDeRolagem();
  const cartao = useRef<HTMLDivElement>(null);

  const dados = linha ? dadosDoLancamento(linha, rodada, linhas) : null;
  const explicacaoNaTela = dados?.explicacao;
  useEffect(() => {
    const caixa = caixaDoDetalhe.current;
    if (!recemExplicada || !explicacaoNaTela || !cartao.current || !caixa) return;
    caixa.scrollTo?.({ top: cartao.current.offsetTop - 4, behavior: semMovimento() ? "auto" : "smooth" });
  }, [recemExplicada, explicacaoNaTela, caixaDoDetalhe]);
  const selo = linha ? seloDaLinha(linha, rodada) : null;
  const acoes = linha ? acoesDoPainel({ linha, rodada, podeDecidir, podeAprovar, nome }) : null;
  // a linha mudou por baixo (o mês fechou, outra pessoa desfez): a confirmação sai, e fica o motivo do backend
  const modo = modoEscolhido === "desfazerAprovacao" && !acoes?.desfazerAprovacao ? null : modoEscolhido;

  const ocupado = modo !== null || enviando || explicando;
  useEffect(() => {
    onOcupar(ocupado);
  }, [ocupado, onOcupar]);
  useEffect(() => () => onOcupar(false), [onOcupar]);
  const aprovada = linha && aprovadaDepois(linha.decisao) && linha.decisao;
  const mensagem = emBranco ? "Escreva o motivo da justificativa." : erro;

  /** Uma gravação por vez; o texto fica no campo se ela falhar. */
  async function enviar(acao: () => Promise<string | null>): Promise<string | null> {
    setEnviando(true);
    setErro(null);
    const falha = await acao();
    setEnviando(false);
    setErro(falha);
    return falha;
  }

  async function justificar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const motivo = texto.trim();
    // o motivo é o que fica no registro: sem ele, não há o que gravar
    if (!motivo) {
      setEmBranco(true);
      return;
    }
    if ((await enviar(() => onJustificar(motivo))) === null) {
      setTexto("");
      setModo(null);
    }
  }

  async function rejeitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    if ((await enviar(() => onRejeitar(texto.trim()))) === null) {
      setTexto("");
      setModo(null);
    }
  }

  function abrirCampo(proximo: Exclude<Modo, null>) {
    setTexto("");
    setEmBranco(false);
    setErro(null);
    setModo(proximo);
  }

  function voltar() {
    setModo(null);
    setEmBranco(false);
    setErro(null);
  }

  async function explicar() {
    if (!linha) return;
    setExplicando(true);
    setFalhaDaExplicacao(null);
    try {
      const resposta = await explicarDivergencia(linha.id);
      if (resposta.ok) {
        setAvisoDaExplicacao(resposta.dados.indisponibilidade ? (AVISO[resposta.dados.indisponibilidade] ?? null) : null);
        setRecemExplicada(true);
        onExplicada(linha, resposta.dados);
      } else if (resposta.status === 401) {
        router.push("/login");
      } else {
        setFalhaDaExplicacao(resposta.erro);
      }
    } catch {
      setFalhaDaExplicacao(FALHA);
    } finally {
      setExplicando(false);
    }
  }

  const abrir = (principal: boolean, rotulo = "Abrir detalhe") => (
    <button
      type="button"
      className={`btn ${principal ? "btn-primary" : "btn-secondary"}`}
      aria-label="Abrir detalhe"
      disabled={!linha}
      onClick={onAbrirDetalhe}
    >
      {rotulo} <ArrowRight size={18} aria-hidden="true" />
    </button>
  );

  return (
    <div
      className="comp-foco"
      data-tom={selo?.tom}
      data-erro={linha && situacaoDaLinha(linha, rodada) === "a_conferir" ? campoErrado(linha) : undefined}
      data-vazio={linha ? undefined : ""}
      data-explicada={recemExplicada && explicacaoNaTela ? "" : undefined}
    >
      <div className="comp-foco-topo">
        <span className="rotulo comp-ao-vivo">{!linha ? "Lançamento em foco" : fixada ? "Fixado" : "Em foco"}</span>
        {selo && <span className={`selo selo-${selo.tom}`} title={dados?.rotulo}>{selo.rotulo}</span>}
      </div>

      <h3 className="comp-foco-titulo" title={dados?.titulo}>
        {dados ? dados.titulo : "Passe o mouse sobre uma linha"}
      </h3>

      <div className="comp-lados">
        <Lado
          rotulo="Extrato do banco"
          lado={dados?.banco ?? null}
          vazio={!linha}
          falta={linha && !dados?.banco ? "sem lançamento no banco" : undefined}
        />
        <Lado
          rotulo="Extrato do sistema"
          lado={dados?.sistema ?? null}
          vazio={!linha}
          falta={linha && !dados?.sistema ? "sem lançamento no sistema" : undefined}
          descricao={dados?.descricaoSistema}
        />
      </div>

      <div className="comp-diferenca" data-zero={dados?.diferenca ? undefined : ""}>
        <span>Diferença</span>
        <strong className="font-titulo">{dados?.diferenca ?? "—"}</strong>
      </div>

      {/* sem barra de rolagem: a borda que esfuma e o "Mais abaixo" dizem que há mais */}
      <div className="comp-detalhe-caixa">
      <div
        ref={caixaDoDetalhe}
        className="comp-detalhe"
        onScroll={medir}
        data-acima={acima || undefined}
        data-abaixo={abaixo || undefined}
      >
      <div ref={conteudoDoDetalhe} className="comp-detalhe-conteudo">
        {!linha && <p className="comp-dica">O detalhe da linha aparece aqui. Clique numa linha para fixar.</p>}

        {linha && modo === "desfazerAprovacao" ? (
          <div className="comp-form" role="group" aria-label="Desfazer a aprovação">
            <p className="espia-aviso">
              A justificativa volta a aguardar aprovação, e o mês só fecha depois que ela for aprovada de novo.
            </p>
            {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
          </div>
        ) : linha && modo ? (
          <form id={idForm} className="comp-form" onSubmit={modo === "justificar" ? justificar : rejeitar} noValidate>
            <div className="field">
              <label htmlFor={idCampo}>{modo === "justificar" ? "Justificativa" : "Motivo da rejeição (opcional)"}</label>
              <textarea
                id={idCampo}
                className="input"
                rows={modo === "justificar" ? 5 : 4}
                value={texto}
                disabled={enviando}
                aria-invalid={emBranco || undefined}
                aria-describedby={mensagem ? idErro : undefined}
                onChange={(evento) => {
                  setTexto(evento.target.value);
                  if (evento.target.value.trim()) setEmBranco(false);
                }}
              />
            </div>
            {modo === "justificar" && (
              <p className="espia-aviso">Fica no registro com o seu nome e o horário. Desfazer depois gera um novo registro.</p>
            )}
            {mensagem && <MensagemErro id={idErro}>{mensagem}</MensagemErro>}
          </form>
        ) : (
          linha &&
          dados && (
            <>
              {dados.nota && (
                <div className="comp-nota">
                  <strong>{dados.nota.titulo}</strong>
                  {aprovada && (
                    <span className="espia-aviso">
                      {`Aprovada por ${aprovada.aprovadaPor}${aprovada.aprovadaEm ? ` em ${formatarDataHora(aprovada.aprovadaEm)}` : ""}`}
                    </span>
                  )}
                  {dados.nota.texto && <p>{dados.nota.texto}</p>}
                  {acoes?.avisoDeAprovacao && <span className="espia-aviso">Aguarda a aprovação do admin ou do gestor da conta.</span>}
                  {acoes?.avisoDeQuemAprovou && aprovada && (
                    <span className="espia-aviso">{`Para alterar ou retirar, ${aprovada.aprovadaPor} precisa desfazer a aprovação.`}</span>
                  )}
                </div>
              )}
              {dados.explicacao ? (
                <div ref={cartao} className="comp-explicacao" data-nova={recemExplicada || undefined}>
                  {dados.geradaPorIa && <SeloIa />}
                  {/* a que a pessoa acabou de pedir é digitada na tela; a que já veio na listagem só aparece */}
                  <p>{recemExplicada ? <TextoDigitado key={dados.explicacao} texto={dados.explicacao} aoTerminar={() => setDigitado(dados.explicacao)} /> : dados.explicacao}</p>
                  {/* os fatos calculados pelo backend (#196), abaixo do texto da IA; só divergência com dado do backend */}
                  {real && !estaResolvida(linha.status) && (
                    <div className="explicacao-depois" data-esperando={recemExplicada && digitado !== dados.explicacao ? "" : undefined}>
                      <DetalhesDaLinha key={linha.id} linhaId={linha.id} />
                    </div>
                  )}
                </div>
              ) : (
                ofereceExplicacao(linha, real) && (
                  <div className="comp-explicar">
                    <FatosOuConvite key={linha.id} linhaId={linha.id} />
                    {falhaDaExplicacao && (
                      <p role="alert" className="explicacao-erro">
                        {falhaDaExplicacao}
                      </p>
                    )}
                    {explicando && (
                      <span className="comp-esqueleto" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                    <BotaoDeExplicar explicando={explicando} falhou={!!falhaDaExplicacao} onClick={() => void explicar()} />
                    {explicando && (
                      <span role="status" className="explicacao-aviso">
                        Lendo os dois extratos. Pode levar alguns segundos.
                      </span>
                    )}
                    {/* o aviso fica no momento em que o dado sai, não só na Política */}
                    <p className="explicacao-aviso">
                      Ao conciliar, o Ledgr já explica as divergências; ao pedir aqui, dados resumidos desta linha são enviados à OpenAI.
                    </p>
                  </div>
                )
              )}
              {avisoDaExplicacao && <p className="explicacao-aviso">{avisoDaExplicacao}</p>}
            </>
          )
        )}
      </div>
      </div>
        {/* atalho do ponteiro: o conteúdo já é lido por inteiro pelo leitor de tela e rola pelo teclado */}
        <button
          type="button"
          className="comp-mais"
          aria-hidden="true"
          tabIndex={-1}
          data-visivel={abaixo || undefined}
          onClick={descer}
        >
          Mais abaixo <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      {/* as ações da linha: o que decide, e o caminho do detalhe. Só um botão é o principal */}
      <div className="comp-acoes">
        {modo === "justificar" && (
          <>
            <button type="submit" form={idForm} className="btn btn-secondary" disabled={enviando} aria-busy={enviando || undefined}>
              Justificar
            </button>
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={voltar}>
              Voltar
            </button>
          </>
        )}
        {modo === "rejeitar" && (
          <>
            <button type="submit" form={idForm} className="btn btn-secondary" disabled={enviando} aria-busy={enviando || undefined}>
              Rejeitar justificativa
            </button>
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={voltar}>
              Voltar
            </button>
          </>
        )}
        {modo === "desfazerAprovacao" && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={enviando}
              aria-busy={enviando || undefined}
              onClick={async () => {
                if ((await enviar(onDesfazerAprovacao)) === null) setModo(null);
              }}
            >
              Desfazer aprovação
            </button>
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={voltar}>
              Voltar
            </button>
          </>
        )}
        {!modo && acoes?.justificar && (
          <>
            <button type="button" className="btn btn-secondary" data-tutorial="justificar" onClick={() => abrirCampo("justificar")}>
              Justificar
            </button>
            {abrir(true)}
          </>
        )}
        {!modo && acoes?.aprovar && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={enviando}
              aria-busy={enviando || undefined}
              onClick={() => void enviar(onAprovar)}
            >
              Aprovar
            </button>
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => abrirCampo("rejeitar")}>
              Rejeitar
            </button>
            {abrir(false, "Abrir")}
          </>
        )}
        {/* desfazer, como na janela da linha (#368): a justificativa sai na hora; a aprovação pede confirmar */}
        {!modo && acoes?.desfazer && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={enviando}
            aria-busy={enviando || undefined}
            onClick={() => void enviar(onDesfazer)}
          >
            Desfazer justificativa
          </button>
        )}
        {!modo && acoes?.desfazerAprovacao && (
          <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => abrirCampo("desfazerAprovacao")}>
            Desfazer aprovação…
          </button>
        )}
        {!modo && !acoes?.justificar && !acoes?.aprovar && abrir(true)}
      </div>
      {!modo && erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
    </div>
  );
}

/** O campo que diverge fica na cor do risco, como na tabela: o valor, ou a data na "Data diverge". */
function campoErrado(linha: LinhaComparacao): "valor" | "data" | undefined {
  if (linha.status === "divergente_data") return "data";
  if (linha.status === "divergente_valor" || linha.status === "duplicado" || linha.status === "sem_correspondencia" || linha.status === "tarifa_bancaria") return "valor";
  return undefined;
}

function Lado({
  rotulo,
  lado,
  vazio,
  falta,
  descricao,
}: {
  rotulo: string;
  lado: ValorDoLado;
  vazio: boolean;
  falta?: string;
  descricao?: string | null;
}) {
  return (
    <div className="comp-lado">
      <span className="rotulo">{rotulo}</span>
      {lado && <span className="comp-data">{lado.data}</span>}
      {falta ? (
        <em className="comp-sem">{falta}</em>
      ) : (
        <strong className="comp-valor font-titulo" data-vazio={vazio || !lado ? "" : undefined}>
          {lado ? lado.valor : "—"}
        </strong>
      )}
      {descricao !== undefined && (
        <span className="comp-desc" title={descricao ?? undefined}>
          {descricao ? `Descrição no sistema: ${descricao}` : ""}
        </span>
      )}
    </div>
  );
}

function Saldos({ saldo }: { saldo: SaldoDoExtrato | null | undefined }) {
  function voltarAoTopo() {
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reduzido ? "auto" : "smooth" });
  }
  return (
    <section className="comp-saldos" aria-label="Saldo do extrato">
      {saldo !== undefined &&
        (saldo === null ? (
          <p className="comp-saldo-data">{SEM_SALDO}</p>
        ) : (
          <>
            <dl>
              <div>
                <dt>Saldo inicial</dt>
                {/* com linhas não lidas a soma sairia incompleta: o backend não calcula, e o front também não */}
                <dd data-sem-inicial={saldo.inicial === null || undefined}>
                  {saldo.inicial === null ? "depende das linhas não lidas" : formatarMoeda(saldo.inicial)}
                </dd>
              </div>
              <div data-final="">
                <dt>Saldo final</dt>
                <dd>{formatarMoeda(saldo.final)}</dd>
              </div>
            </dl>
            <p className="comp-saldo-data">
              Data do saldo <strong>{dataDoSaldo(saldo.data)}</strong>
            </p>
          </>
        ))}
      <button type="button" className="btn btn-secondary" onClick={voltarAoTopo}>
        Voltar ao topo do extrato
      </button>
    </section>
  );
}

/**
 * Os fatos da divergência calculados pelo backend (#196); sem eles (um backend anterior, uma falha), o convite de
 * sempre. O resultado de outra linha nunca aparece nesta: o hook confere o id.
 */
function FatosOuConvite({ linhaId }: { linhaId: string }) {
  const fatos = useDetalhesDaDivergencia(linhaId);
  if (!fatos?.texto) {
    return <p>O Ledgr lê os dois lados desta linha e explica, em linguagem simples, por que ela não casou.</p>;
  }
  return (
    <>
      <p>{fatos.texto}</p>
      <ListaDeDetalhes detalhes={fatos.detalhes} />
    </>
  );
}
