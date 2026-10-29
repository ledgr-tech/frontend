"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Star } from "lucide-react";
import type { EmpresaCliente, SituacaoDaEmpresa } from "@/lib/adaptadores";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import { situacaoDoLimite, textoDoLimite } from "@/lib/limites";
import { podeConvidar } from "@/lib/papel";
import { comEmpresa } from "@/lib/rotas";
import { useRoteador } from "@/lib/roteador";
import { formatarCnpj } from "../../../../(auth)/cadastro/passos";
import { Cabecalho } from "../cabecalho";
import { useLimites, usePapel } from "../conta";
import { formatarDataHora } from "../dashboard/resumo";
import { FaixaFiltros } from "../faixa-filtros";
import { SITUACAO, combina } from "../seletor-de-empresa";
import { marcarFavorita } from "./acoes";
import { CadastrarEmpresa } from "./cadastrar-empresa";
import { ModalDaTela } from "./modal-da-tela";
import { FaixaDoPlano } from "./faixa-do-plano";
import { PainelDaEquipe, useEquipe } from "./painel-da-equipe";

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

/** As favoritas primeiro; dentro de cada grupo, pela razão social. */
function emOrdem(empresas: EmpresaCliente[]): EmpresaCliente[] {
  return [...empresas].sort(
    (a, b) =>
      Number(Boolean(b.favorita)) - Number(Boolean(a.favorita)) ||
      a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR", { sensitivity: "base" }),
  );
}

export function PainelDeEmpresas({ empresas: daPagina }: { empresas: EmpresaCliente[] }) {
  const router = useRoteador();
  const ativa = useEmpresaAtiva();
  const papel = usePapel();
  const limites = useLimites();
  const equipe = useEquipe();
  // a aba nasce da URL do navegador, não da página renderizada no servidor: trocar de aba só troca a URL
  // (`replaceState`), e o voltar do navegador devolve a tela do cache com a URL de agora
  const busca = useSearchParams();
  const [aba, setAba] = useState<AbaDaTela>(busca.get("aba") === "equipe" ? "equipe" : "empresas");
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [conviteAberto, setConviteAberto] = useState(false);
  // as favoritas mudam na hora e desfazem se o backend recusar, como no seletor
  const [empresas, setEmpresas] = useState(daPagina);
  const [erroDaFavorita, setErroDaFavorita] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDeSituacao>("todas");
  const [termo, setTermo] = useState("");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const previa = useRef<HTMLElement>(null);

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

  function trocarDeAba(nova: AbaDaTela) {
    setAba(nova);
    // a URL acompanha, sem recarregar a tela: dá para mandar o link da aba e o voltar não se perde
    window.history.replaceState(window.history.state, "", nova === "equipe" ? "?aba=equipe" : window.location.pathname);
  }

  function escolher(id: string) {
    setEscolhida(id);
    // com a prévia acima da lista, escolher sem ver o que mudou não diria nada
    if (!window.matchMedia?.(PREVIA_AO_LADO).matches) previa.current?.scrollIntoView?.({ block: "start" });
  }

  function abrir(empresa: EmpresaCliente) {
    gravarEmpresaRecente(empresa.id);
    // daqui não há "a mesma tela" na outra empresa: vai à Visão geral dela
    router.push(comEmpresa(empresa.id, "/visao-geral"));
  }

  async function alternarFavorita(empresa: EmpresaCliente) {
    const favorita = !empresa.favorita;
    const marcar = (valor: boolean) =>
      setEmpresas((atuais) => atuais.map((outra) => (outra.id === empresa.id ? { ...outra, favorita: valor } : outra)));
    marcar(favorita);
    setErroDaFavorita(null);
    const resposta = await marcarFavorita(empresa.id, favorita);
    if (!resposta.ok) {
      marcar(!favorita);
      setErroDaFavorita(resposta.erro);
    }
  }

  const acao =
    aba === "empresas" ? (
      gerencia ? (
        <button
          type="button"
          className="btn btn-primary"
          aria-haspopup="dialog"
          disabled={noLimite}
          onClick={() => setCadastroAberto(true)}
        >
          Adicionar empresa
        </button>
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
          {!gerencia && <p className="empresas-nota">Só o admin e o gestor cadastram empresas.</p>}
          {erroDaFavorita && (
            <p role="alert" className="empresas-nota">
              {erroDaFavorita}
            </p>
          )}

          {/* sem `!noLimite`: o 402 de uma aba com contador velho relê a página e leva a conta ao limite; o formulário aberto fica, com a mensagem e o foco, e só o envio se desliga */}
          {cadastroAberto && gerencia && (
            <ModalDaTela titulo="Adicionar empresa" aoFechar={() => setCadastroAberto(false)}>
              <p className="dialog-body">Cadastre uma empresa cliente pelo CNPJ. Ela entra na conta e você passa a trabalhar nela.</p>
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
                        <th scope="col">CNPJ</th>
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
                                  escolher(empresa.id);
                                }}
                              >
                                {empresa.razaoSocial}
                              </button>
                              {empresa.id === ativa?.id && <span className="tag">Ativa</span>}
                            </span>
                          </td>
                          <td className="empresas-cnpj">{formatarCnpj(empresa.cnpj)}</td>
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
                    aviso={textoDoLimite("empresas", limite)}
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
      aria-label={favorita ? `Tirar ${empresa.razaoSocial} das favoritas` : `Marcar ${empresa.razaoSocial} como favorita`}
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
}: {
  ref: React.Ref<HTMLElement>;
  empresa: EmpresaCliente;
  ativa: boolean;
  aoAbrir: () => void;
  aoAlternarFavorita: () => void;
}) {
  return (
    <aside ref={ref} className="conc-previa" aria-label="Empresa escolhida" aria-live="polite" data-tutorial="previa">
      <span className="rotulo">{ativa ? "Empresa cliente · aberta agora" : "Empresa cliente"}</span>
      <h2 className="conc-previa-titulo">{empresa.razaoSocial}</h2>
      <dl className="conc-previa-dados">
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
      <div className="conc-previa-acoes">
        <button type="button" className="btn btn-primary" onClick={aoAbrir}>
          {ativa ? "Ir para a Visão geral" : "Abrir esta empresa"}
        </button>
        {empresa.favorita !== undefined && (
          <button type="button" className="btn btn-secondary" aria-pressed={empresa.favorita} onClick={aoAlternarFavorita}>
            {empresa.favorita ? "Tirar das favoritas" : "Marcar como favorita"}
          </button>
        )}
      </div>
    </aside>
  );
}
