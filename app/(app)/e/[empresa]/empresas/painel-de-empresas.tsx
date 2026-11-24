"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import type { EmpresaCliente, SituacaoDaEmpresa } from "@/lib/adaptadores";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import { situacaoDoLimite, textoDoLimite } from "@/lib/limites";
import { podeConvidar } from "@/lib/papel";
import { comEmpresa } from "@/lib/rotas";
import { useRoteador } from "@/lib/roteador";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarCnpj } from "../../../../(auth)/cadastro/passos";
import { Cabecalho } from "../cabecalho";
import type { Resultado } from "../conciliacoes/acoes";
import { useCobranca, useLimites, usePapel, usePodeFechar } from "../conta";
import { formatarDataHora } from "../dashboard/resumo";
import { FaixaFiltros } from "../faixa-filtros";
import { mostrarPreviaDoEscolhido } from "../grupo";
import { SITUACAO, combina, useFavoritaOtimista } from "../seletor-de-empresa";
import { carregarEmpresas, editarNomeDeExibicao } from "./acoes";
import { ConfirmarRemocao, EmpresasRemovidas } from "./empresas-removidas";
import type { EmpresaRemovida } from "./remocao-acoes";
import { CadastrarEmpresa } from "./cadastrar-empresa";
import { ModalDaTela } from "./modal-da-tela";
import { FaixaDoPlano } from "./faixa-do-plano";
import { PainelDaEquipe, useEquipe } from "./painel-da-equipe";
import { useTrocaSuave } from "@/lib/troca-suave";

/**
 * A tela Empresas no padrão das outras (revisão de 29/10, versão A do artefato "Histórico e Empresas no
 * padrão"; as regras são as da spec 2026-10-22-empresas-na-configuracao): Empresas e Equipe são o controle
 * segmentado da faixa de filtros, como em Extratos; em Empresas, os filtros pela situação do mês e a busca
 * por nome ou CNPJ, a tabela com a estrela (as favoritas primeiro, como no seletor) e, ao lado, a prévia
 * da empresa escolhida com "Abrir esta empresa". A faixa do plano fica embaixo da lista. Admin e gestor
 * cadastram e convidam (o backend responde 403 ao analista, então os botões nem aparecem). A equipe
 * carrega junto com a tela, para o número da pílula e a troca serem imediatos; a escolhida vai em
 * `?aba=equipe`.
 */

export type AbaDaTela = "empresas" | "equipe";

type FiltroDeSituacao = "todas" | SituacaoDaEmpresa;
const FILTROS: { id: FiltroDeSituacao; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "em_aberto", rotulo: "Mês em aberto" },
  { id: "fechado", rotulo: "Mês fechado" },
  { id: "sem_conciliacao", rotulo: "Sem conciliação" },
];

// a cor do selo pela situação do mês, como os selos das outras telas
const TOM: Record<SituacaoDaEmpresa, string> = { em_aberto: "selo selo-atencao", fechado: "selo selo-ok", sem_conciliacao: "selo" };

// abaixo disso a prévia sobe para antes da lista (o mesmo corte do .conc-mesa em globals.css)
const PREVIA_AO_LADO = "(min-width: 1100px)";

function contagem(usadas: number, maximo: number | null): string {
  const empresas = usadas === 1 ? "empresa" : "empresas";
  return maximo === null ? `${usadas} ${empresas}` : `${usadas} de ${maximo} ${empresas}`;
}

/** As favoritas primeiro; dentro de cada grupo, pelo nome mostrado. */
function emOrdem(empresas: EmpresaCliente[]): EmpresaCliente[] {
  return [...empresas].sort(
    (a, b) =>
      Number(Boolean(b.favorita)) - Number(Boolean(a.favorita)) ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );
}

export function PainelDeEmpresas({ empresas: daPagina }: { empresas: EmpresaCliente[] }) {
  const router = useRoteador();
  const ativa = useEmpresaAtiva();
  const papel = usePapel();
  const limites = useLimites();
  const cobranca = useCobranca();
  const equipe = useEquipe();
  // a aba nasce da URL do navegador, não da página renderizada no servidor: trocar de aba só troca a URL
  // (`replaceState`), e o voltar do navegador devolve a tela do cache com a URL de agora
  const busca = useSearchParams();
  const [aba, setAba] = useState<AbaDaTela>(busca.get("aba") === "equipe" ? "equipe" : "empresas");
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [conviteAberto, setConviteAberto] = useState(false);
  const [removendo, setRemovendo] = useState<EmpresaCliente | null>(null);
  const [removidasAbertas, setRemovidasAbertas] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // as favoritas mudam na hora e desfazem se o backend recusar, como no seletor
  const [empresas, setEmpresas] = useState(daPagina);
  const [paginaAnterior, setPaginaAnterior] = useState(daPagina);
  if (paginaAnterior !== daPagina) {
    setPaginaAnterior(daPagina);
    setEmpresas(daPagina);
  }
  const [erroDaFavorita, setErroDaFavorita] = useState<string | null>(null);
  const favoritaOtimista = useFavoritaOtimista();
  const [filtro, setFiltro] = useState<FiltroDeSituacao>("todas");
  const [termo, setTermo] = useState("");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const previa = useRef<HTMLElement>(null);
  const focarAposRemocao = useRef(false);

  const gerencia = podeConvidar(papel);
  const limite = limites?.empresas ?? null;
  const situacao = limite ? situacaoDoLimite(limite) : null;
  // acima do limite (um downgrade) também não dá para adicionar, como a frase da faixa diz
  const noLimite = situacao === "no-limite" || situacao === "acima";
  const pessoas = typeof equipe.estado === "object" ? equipe.estado.pessoas.length : null;
  // a estrela e a situação só existem com o backend #157; antes dele, a tabela fica sem as duas colunas
  const comFavoritas = empresas.some((empresa) => empresa.favorita !== undefined);
  const comSituacao = empresas.some((empresa) => empresa.situacao !== undefined);
  const visiveis = emOrdem(empresas).filter(
    (empresa) => (filtro === "todas" || empresa.situacao === filtro) && combina(empresa, termo),
  );
  // a escolhida que o filtro ou a busca escondeu dá lugar à primeira à vista
  const atual = visiveis.find((empresa) => empresa.id === escolhida) ?? visiveis[0] ?? null;
  useTrocaSuave(previa, atual?.id);
  useEffect(() => {
    if (focarAposRemocao.current) {
      focarAposRemocao.current = false;
      previa.current?.querySelector<HTMLElement>("h2")?.focus();
    }
  }, [atual?.id]);

  function trocarDeAba(nova: AbaDaTela) {
    setAba(nova);
    // a URL acompanha, sem recarregar a tela: dá para mandar o link da aba e o voltar não se perde
    window.history.replaceState(window.history.state, "", nova === "equipe" ? "?aba=equipe" : window.location.pathname);
  }

  function escolher(id: string, peloTeclado = false) {
    setEscolhida(id);
    // com a prévia acima da lista, escolher sem ver o que mudou não diria nada
    if (!window.matchMedia?.(PREVIA_AO_LADO).matches) mostrarPreviaDoEscolhido(previa.current, peloTeclado);
  }

  function abrir(empresa: EmpresaCliente) {
    gravarEmpresaRecente(empresa.id);
    // daqui não há "a mesma tela" na outra empresa: vai à Visão geral dela
    router.push(comEmpresa(empresa.id, "/visao-geral"));
  }

  function alternarFavorita(empresa: EmpresaCliente) {
    return favoritaOtimista.alternar(
      empresa,
      (valor) => setEmpresas((atuais) => atuais.map((outra) => (outra.id === empresa.id ? { ...outra, favorita: valor } : outra))),
      setErroDaFavorita,
    );
  }

  function atualizarEmpresa(atualizada: EmpresaCliente) {
    // fixa a escolhida: se o novo nome a tirou do primeiro lugar da ordem, o painel continua nela
    setEscolhida(atualizada.id);
    // o PATCH devolve o cadastro sem `favorita` nem `situacao`; mesclar mantém os campos da lista
    setEmpresas((atuais) => atuais.map((outra) => (outra.id === atualizada.id ? { ...outra, ...atualizada } : outra)));
  }

  async function aposRemover(removida: EmpresaRemovida) {
    const restantes = empresas.filter((empresa) => empresa.id !== removida.id);
    setRemovendo(null);
    focarAposRemocao.current = true;
    setEmpresas(restantes);
    setEscolhida(null);
    setAviso(`${removida.nome} foi removida. Você pode restaurá-la em Empresas removidas até ${formatarDataHora(removida.apagarEm)}.`);
    if (removida.id === ativa?.id) {
      // A URL antiga deixa de ser válida. Navegação completa descarta o shell e o seletor
      // em cache, sem tentar atualizar o layout da empresa que acabou de sair.
      const resposta = await carregarEmpresas().catch(() => null);
      const proxima = (resposta?.ok ? resposta.dados : restantes)[0];
      if (proxima) gravarEmpresaRecente(proxima.id);
      window.location.replace(proxima ? comEmpresa(proxima.id, "/empresas") : "/empresas");
      return;
    }
    router.refresh();
  }

  function aposRestaurar(empresa: EmpresaCliente) {
    setEmpresas((atuais) => atuais.some((outra) => outra.id === empresa.id) ? atuais : [...atuais, empresa]);
    setEscolhida(empresa.id);
    router.refresh();
  }

  const acao =
    aba === "empresas" ? (
      gerencia ? (
        <>
        <button
          type="button"
          className="btn btn-primary"
          aria-haspopup="dialog"
          disabled={noLimite}
          onClick={() => setCadastroAberto(true)}
        >
          Adicionar empresa
        </button>
        <button type="button" className="btn btn-secondary" aria-haspopup="dialog" onClick={() => setRemovidasAbertas(true)}>
          Empresas removidas
        </button>
        </>
      ) : undefined
    ) : gerencia ? (
      <button type="button" className="btn btn-primary" aria-haspopup="dialog" onClick={() => setConviteAberto(true)}>
        Convidar pessoa
      </button>
    ) : undefined;

  const contexto =
    aba === "empresas"
      ? limite && limite.maximo !== null
        ? `${contagem(limite.usadas, limite.maximo)} do plano`
        : contagem(empresas.length, null)
      : pessoas !== null
        ? `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"}`
        : null;

  return (
    <div>
      <Cabecalho titulo="Empresas" contexto={[contexto]} acoes={acao} />

      <div className="extratos-corpo empresas-corpo">
        <FaixaFiltros tutorial="filtros">
          <div className="pills segmentado" role="group" aria-label="Empresas e equipe">
            {(["empresas", "equipe"] as const).map((a) => (
              <button key={a} type="button" className="pill" aria-pressed={aba === a} onClick={() => trocarDeAba(a)}>
                {a === "empresas" ? `Empresas (${empresas.length})` : pessoas === null ? "Equipe" : `Equipe (${pessoas})`}
              </button>
            ))}
          </div>
          {aba === "empresas" && (
            <div className="empresas-filtros">
              {comSituacao && (
                <div className="pills segmentado" role="group" aria-label="Filtrar pela situação do mês">
                  {FILTROS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="pill"
                      aria-pressed={filtro === item.id}
                      onClick={() => setFiltro(item.id)}
                    >
                      {item.rotulo} ({empresas.filter((empresa) => item.id === "todas" || empresa.situacao === item.id).length})
                    </button>
                  ))}
                </div>
              )}
              <input
                type="search"
                className="input empresas-busca"
                aria-label="Buscar por razão social ou CNPJ"
                placeholder="Buscar por razão social ou CNPJ"
                autoComplete="off"
                value={termo}
                onChange={(evento) => setTermo(evento.target.value)}
              />
            </div>
          )}
        </FaixaFiltros>

        {/* as duas visões ficam no DOM e a inativa fica escondida: o que foi digitado numa sobrevive à troca */}
        <div hidden={aba !== "empresas"}>
          <p role="status" className={aviso ? "empresas-nota" : "sr-only"}>{aviso}</p>
          {removendo && gerencia && <ConfirmarRemocao empresa={removendo} aoFechar={() => setRemovendo(null)} aoRemover={(empresa) => void aposRemover(empresa)} />}
          {removidasAbertas && gerencia && <EmpresasRemovidas aoFechar={() => setRemovidasAbertas(false)} aoRestaurar={aposRestaurar} />}
          {!gerencia && <p className="empresas-nota">Só o admin e o gestor cadastram empresas.</p>}
          {erroDaFavorita && (
            <p role="alert" className="empresas-nota">
              {erroDaFavorita}
            </p>
          )}

          {/* sem `!noLimite`: o 402 de uma aba com contador velho relê a página e leva a conta ao limite; o formulário aberto fica, com a mensagem e o foco, e só o envio se desliga */}
          {cadastroAberto && gerencia && (
            <ModalDaTela titulo="Adicionar empresa" aoFechar={() => setCadastroAberto(false)}>
              <p className="dialog-body">Cadastre uma empresa cliente pelo CNPJ. Ela entra no escritório e você passa a trabalhar nela.</p>
              <CadastrarEmpresa noLimite={noLimite} aoCadastrar={() => setCadastroAberto(false)} aoFechar={() => setCadastroAberto(false)} />
            </ModalDaTela>
          )}

          {!atual ? (
            <p className="extratos-vazio">Nenhuma empresa com esse filtro ou essa busca.</p>
          ) : (
            <div className="conc-mesa">
              <div className="empresas-lista" data-tutorial="lista">
                <div className="empresas-tabela">
                  <table className="table tabela-escolha">
                    <thead>
                      <tr>
                        {comFavoritas && (
                          <th scope="col" className="empresas-col-estrela">
                            <span className="sr-only">Favorita</span>
                          </th>
                        )}
                        <th scope="col">Empresa</th>
                        <th scope="col" className="empresas-col-cnpj">CNPJ</th>
                        {comSituacao && <th scope="col">Mês</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((empresa) => (
                        <tr
                          key={empresa.id}
                          aria-selected={empresa.id === atual.id}
                          onClick={() => escolher(empresa.id)}
                          // atalho para abrir, como o duplo clique das folhas; o clique simples só escolhe
                          onDoubleClick={() => abrir(empresa)}
                        >
                          {comFavoritas && (
                            <td>
                              <Estrela empresa={empresa} aoAlternar={() => void alternarFavorita(empresa)} />
                            </td>
                          )}
                          <td>
                            <span className="empresas-celula">
                              <button
                                type="button"
                                className="tabela-escolha-botao empresas-nome"
                                aria-pressed={empresa.id === atual.id}
                                onClick={(evento) => {
                                  evento.stopPropagation();
                                  escolher(empresa.id, evento.detail === 0);
                                }}
                              >
                                {empresa.nome}
                              </button>
                              {empresa.id === ativa?.id && <span className="tag tag-accent">Ativa</span>}
                            </span>
                          </td>
                          <td className="empresas-cnpj empresas-col-cnpj">{formatarCnpj(empresa.cnpj)}</td>
                          {comSituacao && (
                            <td>
                              {empresa.situacao && <span className={TOM[empresa.situacao]}>{SITUACAO[empresa.situacao]}</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {limite && (
                  <FaixaDoPlano
                    contagem={limite.maximo === null ? `${contagem(limite.usadas, null)} do plano` : contagem(limite.usadas, limite.maximo)}
                    usadas={limite.usadas}
                    maximo={limite.maximo}
                    aviso={textoDoLimite("empresas", limite, cobranca)}
                    verPlanos={noLimite}
                  />
                )}
              </div>
              <PreviaDaEmpresa
                ref={previa}
                empresa={atual}
                ativa={atual.id === ativa?.id}
                aoAbrir={() => abrir(atual)}
                aoAlternarFavorita={() => void alternarFavorita(atual)}
                aoAtualizar={atualizarEmpresa}
                aoRemover={() => setRemovendo(atual)}
              />
            </div>
          )}
        </div>
        <div hidden={aba !== "equipe"}>
          <PainelDaEquipe
            estado={equipe.estado}
            recarregar={equipe.recarregar}
            aplicar={equipe.aplicar}
            conviteAberto={conviteAberto}
            aoFecharConvite={() => setConviteAberto(false)}
          />
        </div>
      </div>
    </div>
  );
}

function Estrela({ empresa, aoAlternar }: { empresa: EmpresaCliente; aoAlternar: () => void }) {
  const favorita = Boolean(empresa.favorita);
  return (
    <button
      type="button"
      className="empresas-estrela"
      aria-pressed={favorita}
      aria-label={favorita ? `Tirar ${empresa.nome} das favoritas` : `Marcar ${empresa.nome} como favorita`}
      onClick={(evento) => {
        // a estrela não escolhe a linha por baixo dela
        evento.stopPropagation();
        aoAlternar();
      }}
    >
      <Star size={16} aria-hidden="true" />
    </button>
  );
}

/** A empresa escolhida, ao lado da lista: os dados dela e o caminho para trabalhar nela. */
function PreviaDaEmpresa({
  ref,
  empresa,
  ativa,
  aoAbrir,
  aoAlternarFavorita,
  aoAtualizar,
  aoRemover,
}: {
  ref: React.Ref<HTMLElement>;
  empresa: EmpresaCliente;
  ativa: boolean;
  aoAbrir: () => void;
  aoAlternarFavorita: () => void;
  aoAtualizar: (empresa: EmpresaCliente) => void;
  aoRemover: () => void;
}) {
  return (
    <aside ref={ref} className="conc-previa" aria-label="Empresa escolhida" aria-live="polite" data-tutorial="previa">
      <span className="rotulo">{ativa ? "Empresa cliente · aberta agora" : "Empresa cliente"}</span>
      <h2 className="conc-previa-titulo" tabIndex={-1}>{empresa.nome}</h2>
      <dl className="conc-previa-dados">
        <dt>Razão social</dt>
        <dd>{empresa.razaoSocial}</dd>
        <dt>CNPJ</dt>
        <dd>{formatarCnpj(empresa.cnpj)}</dd>
        <dt>Na Receita</dt>
        <dd>{empresa.cnpjVerificado ? "CNPJ verificado" : "Ainda não verificado"}</dd>
        {/* só o dia: os dez primeiros caracteres de "dd/mm/aaaa hh:mm", no fuso de Brasília */}
        <dt>Cadastrada em</dt>
        <dd>{formatarDataHora(empresa.criadaEm).slice(0, 10)}</dd>
        {empresa.situacao && (
          <>
            <dt>Mês</dt>
            <dd>
              <span className={TOM[empresa.situacao]}>{SITUACAO[empresa.situacao]}</span>
            </dd>
          </>
        )}
      </dl>
      <AcoesDaPrevia
        key={empresa.id}
        empresa={empresa}
        ativa={ativa}
        aoAbrir={aoAbrir}
        aoAlternarFavorita={aoAlternarFavorita}
        aoAtualizar={aoAtualizar}
        aoRemover={aoRemover}
      />
    </aside>
  );
}

function AcoesDaPrevia({
  empresa,
  ativa,
  aoAbrir,
  aoAlternarFavorita,
  aoAtualizar,
  aoRemover,
}: {
  empresa: EmpresaCliente;
  ativa: boolean;
  aoAbrir: () => void;
  aoAlternarFavorita: () => void;
  aoAtualizar: (empresa: EmpresaCliente) => void;
  aoRemover: () => void;
}) {
  const router = useRoteador();
  // só com o backend #236 (`nomeExibicao` presente) e só para admin e gestor
  const podeEditarNome = usePodeFechar() && empresa.nomeExibicao !== undefined;
  const podeRemover = usePodeFechar();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(empresa.nome);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emCurso = useRef(false);
  // o formulário some ao salvar ou cancelar, com o foco dentro: ele volta ao "Editar nome"
  const botaoEditar = useRef<HTMLButtonElement>(null);
  const devolverFoco = useRef(false);
  useEffect(() => {
    if (!editando && devolverFoco.current) {
      devolverFoco.current = false;
      botaoEditar.current?.focus();
    }
  }, [editando]);
  const campoId = useId();
  const erroId = useId();

  function abrirEdicao() {
    setValor(empresa.nome);
    setErro(null);
    setEditando(true);
  }

  function cancelar() {
    devolverFoco.current = true;
    setEditando(false);
    setErro(null);
  }

  async function gravar(novoNome: string | null) {
    if (emCurso.current) return;
    if (novoNome !== null && novoNome.trim().length > 120) {
      setErro("O nome pode ter até 120 caracteres.");
      return;
    }
    emCurso.current = true;
    setEnviando(true);
    setErro(null);
    const resposta = await editarNomeDeExibicao(empresa.id, novoNome).catch(
      (): Resultado<EmpresaCliente> => ({ ok: false, status: 0, erro: SEM_SERVIDOR }),
    );
    emCurso.current = false;
    setEnviando(false);
    if (resposta.ok) {
      aoAtualizar(resposta.dados);
      devolverFoco.current = true;
      setEditando(false);
      router.refresh();
      return;
    }
    if (resposta.status === 401) {
      router.push("/login");
      return;
    }
    setErro(resposta.erro);
    if (resposta.status === 403) router.refresh();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void gravar(valor);
  }

  return (
    <>
      {editando && podeEditarNome && (
        <form className="empresas-form" onSubmit={enviar} noValidate aria-label="Editar nome de exibição">
          <div className="field">
            <label htmlFor={campoId}>Nome de exibição</label>
            <input
              id={campoId}
              className="input"
              autoComplete="off"
              maxLength={120}
              autoFocus
              value={valor}
              disabled={enviando}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? erroId : undefined}
              onChange={(evento) => setValor(evento.target.value)}
            />
            {erro && <MensagemErro id={erroId}>{erro}</MensagemErro>}
          </div>
          <div className="empresas-form-botoes">
            <button type="submit" className="btn btn-primary" disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={cancelar}>
              Cancelar
            </button>
            {empresa.nomeExibicao !== null && (
              <button type="button" className="btn btn-ghost" disabled={enviando} onClick={() => void gravar(null)}>
                Voltar à razão social
              </button>
            )}
          </div>
        </form>
      )}
      <div className="conc-previa-acoes">
        <button type="button" className="btn btn-primary" onClick={aoAbrir}>
          {ativa ? "Ir para a Visão geral" : "Abrir esta empresa"}
        </button>
        {podeEditarNome && !editando && (
          <button ref={botaoEditar} type="button" className="btn btn-secondary" onClick={abrirEdicao}>
            Editar nome
          </button>
        )}
        {empresa.favorita !== undefined && (
          <button type="button" className="btn btn-secondary" aria-pressed={empresa.favorita} onClick={aoAlternarFavorita}>
            {empresa.favorita ? "Tirar das favoritas" : "Marcar como favorita"}
          </button>
        )}
        {podeRemover && !editando && (
          <button type="button" className="btn btn-ghost" aria-haspopup="dialog" onClick={aoRemover}>
            Remover empresa
          </button>
        )}
      </div>
    </>
  );
}
