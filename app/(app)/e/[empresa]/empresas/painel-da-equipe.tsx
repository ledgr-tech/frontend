"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Convite, Pessoa } from "@/lib/adaptadores";
import { situacaoDoLimite, textoDoLimite } from "@/lib/limites";
import { papeisQueConvida, podeConvidar, ROTULO_DO_PAPEL, type Papel } from "@/lib/papel";
import { useRoteador } from "@/lib/roteador";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { EMAIL_VALIDO, MENSAGEM_EMAIL_INCOMPLETO } from "../../../../(auth)/_compartilhado/validacao";
import type { Resultado } from "../conciliacoes/acoes";
import { useEmail, useLimites, usePapel } from "../conta";
import { cancelarConvite, carregarEquipe, convidar, removerPessoa, trocarPapel, type Equipe } from "../equipe/acoes";
import { FaixaDoPlano } from "./faixa-do-plano";
import { DESCRICAO_DO_PAPEL, MenuDePapel } from "./menu-de-papel";
import { ModalDaTela } from "./modal-da-tela";
import { TransferirAdmin } from "./transferir-admin";

/**
 * A aba Equipe da tela Empresas (spec 2026-10-22-empresas-na-configuracao, revisão de 23/10; as regras de
 * papel são as de 2026-10-16-equipe-e-convites): o admin convida gestor ou analista, o gestor convida só
 * analista, os dois cancelam convite; remover pessoas é do admin; o analista vê a lista. O backend
 * garante cada regra; aqui só some o que ele recusaria. A troca de papel é a parte C do #169.
 */

// abaixo disso o painel sobe para antes da lista (o mesmo corte do .conc-mesa em globals.css)
const PAINEL_AO_LADO = "(min-width: 1100px)";

export type EstadoDaEquipe = Equipe | "carregando" | "sem-rota" | "falhou";

/** Carrega a equipe ao montar; `recarregar` volta a "carregando" e busca de novo. */
export function useEquipe(): {
  estado: EstadoDaEquipe;
  recarregar: () => void;
  aplicar: (depois: (equipe: Equipe) => Equipe) => void;
} {
  const papel = usePapel();
  const router = useRoteador();
  // undefined até a primeira busca (e de novo no "Tentar de novo")
  const [estado, setEstado] = useState<EstadoDaEquipe | undefined>(undefined);

  const carregar = useCallback(() => {
    carregarEquipe(papel).then(
      (resposta) => {
        if (resposta.ok) setEstado(resposta.dados);
        else if (resposta.status === 401) router.push("/login");
        else setEstado(resposta.status === 404 ? "sem-rota" : "falhou");
      },
      () => setEstado("falhou"),
    );
  }, [papel, router]);

  useEffect(() => {
    if (estado !== undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado("carregando");
    carregar();
  }, [estado, carregar]);

  return {
    estado: estado ?? "carregando",
    recarregar: () => setEstado(undefined),
    aplicar: (depois) => setEstado((atual) => (typeof atual === "object" ? depois(atual) : atual)),
  };
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export function PainelDaEquipe({
  estado,
  recarregar,
  aplicar,
  conviteAberto,
  aoFecharConvite,
}: {
  estado: EstadoDaEquipe;
  recarregar: () => void;
  aplicar: (depois: (equipe: Equipe) => Equipe) => void;
  /** O botão "Convidar pessoa" do cabeçalho da tela abre o painel do convite. */
  conviteAberto: boolean;
  aoFecharConvite: () => void;
}) {
  const papel = usePapel();
  const email = useEmail();
  const limites = useLimites();
  const router = useRoteador();
  /** A ação em curso: o id da pessoa ou do convite. Trava os botões dela. */
  const [emCurso, setEmCurso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erroDeAcao, setErroDeAcao] = useState("");
  // o menu de papel aberto (um por vez) e o erro da troca de papel, que fica na linha da pessoa
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [erroDaPessoa, setErroDaPessoa] = useState<{ id: string; texto: string } | null>(null);
  // a pessoa que vai receber a administração (a janela de confirmação) e o aviso de que ela já a tem
  const [paraTransferir, setParaTransferir] = useState<{ id: string; nome: string } | null>(null);
  const [avisoDaTransferencia, setAvisoDaTransferencia] = useState("");
  // a pessoa ou o convite escolhido na lista, que o painel ao lado mostra
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const painel = useRef<HTMLElement>(null);
  const erroId = useId();

  /** O que toda ação faz com a resposta: 401 vai ao login, 403 avisa e relê a equipe. */
  async function agir(id: string, acao: () => Promise<Resultado<null>>, depois: (equipe: Equipe) => Equipe) {
    if (emCurso) return;
    setEmCurso(id);
    setErroDeAcao("");
    const resposta = await acao().catch(
      (): Resultado<null> => ({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." }),
    );
    setEmCurso(null);
    setConfirmando(null);
    if (resposta.ok) {
      aplicar(depois);
      // os limites vêm do /me, lido uma vez por carregamento: a faixa e a barra se atualizam relendo a página
      router.refresh();
      return;
    }
    if (resposta.status === 401) {
      router.push("/login");
      return;
    }
    setErroDeAcao(resposta.erro);
    if (resposta.status === 403) {
      recarregar();
      router.refresh();
    }
  }

  /** Escolher outro papel troca na hora; o mesmo papel só fecha o menu. O erro fica na linha da pessoa. */
  async function mudarPapel(pessoa: { id: string; papel: Papel }, novo: "gestor" | "analista") {
    setMenuAberto(null);
    if (novo === pessoa.papel || emCurso) return;
    setEmCurso(pessoa.id);
    setErroDaPessoa(null);
    const resposta = await trocarPapel(pessoa.id, novo).catch(
      (): Resultado<Pessoa> => ({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." }),
    );
    setEmCurso(null);
    if (resposta.ok) {
      aplicar((equipe) => ({ ...equipe, pessoas: equipe.pessoas.map((p) => (p.id === pessoa.id ? resposta.dados : p)) }));
      router.refresh();
      return;
    }
    if (resposta.status === 401) {
      router.push("/login");
      return;
    }
    // a pessoa saiu da conta ou o papel de quem decide mudou por fora: a equipe e o papel se relêem,
    // e o aviso sobe ao topo porque a linha da pessoa pode deixar de existir
    if (resposta.status === 403 || resposta.status === 404) {
      setErroDeAcao(resposta.erro);
      recarregar();
      if (resposta.status === 403) router.refresh();
      return;
    }
    setErroDaPessoa({ id: pessoa.id, texto: resposta.erro });
  }

  if (typeof estado !== "object") {
    return (
      <div className="equipe-estado">
        {estado === "carregando" ? (
          <p className="empresas-nota">Carregando a equipe…</p>
        ) : estado === "sem-rota" ? (
          <p className="empresas-nota">A equipe ainda não está disponível.</p>
        ) : (
          <div className="equipe-falha">
            <p className="empresas-nota">Não foi possível carregar agora.</p>
            <button type="button" className="btn btn-secondary" onClick={recarregar}>
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    );
  }

  const gerencia = podeConvidar(papel);
  const limite = limites?.usuarios ?? null;
  const situacao = limite ? situacaoDoLimite(limite) : null;
  const convites = estado.convites ?? [];
  const visiveis = gerencia ? convites : [];
  // a escolhida que saiu da lista (removida, convite cancelado) dá lugar à primeira pessoa
  const atual =
    estado.pessoas.find((pessoa) => pessoa.id === escolhida) ?? visiveis.find((convite) => convite.id === escolhida) ?? estado.pessoas[0] ?? null;

  function escolher(id: string) {
    if (id !== escolhida) {
      setConfirmando(null);
      setMenuAberto(null);
    }
    setEscolhida(id);
    // com o painel acima da lista, escolher sem ver o que mudou não diria nada
    if (!window.matchMedia?.(PAINEL_AO_LADO).matches) painel.current?.scrollIntoView?.({ block: "start" });
  }

  return (
    <div>
      {gerencia && conviteAberto && (
        <ModalDaTela titulo="Convidar pessoa" aoFechar={aoFecharConvite}>
          <ConvidarPessoa
            papeis={papeisQueConvida(papel)}
            aoConvidar={(convite) => {
              aplicar((atual) => ({ ...atual, convites: [convite, ...(atual.convites ?? []).filter((c) => c.id !== convite.id)] }));
              router.refresh();
            }}
            aoFechar={aoFecharConvite}
            aoSairDaSessao={() => router.push("/login")}
          />
        </ModalDaTela>
      )}

      {paraTransferir && (
        <ModalDaTela titulo="Transferir administração" aoFechar={() => setParaTransferir(null)}>
          <TransferirAdmin
            pessoa={paraTransferir}
            aoConcluir={(pessoas) => {
              aplicar((equipe) => ({ ...equipe, pessoas }));
              setAvisoDaTransferencia(`${paraTransferir.nome} agora é o administrador da conta. Você é Gestor.`);
              setParaTransferir(null);
              router.refresh();
            }}
            aoFechar={() => setParaTransferir(null)}
            aoRecusar={(texto) => {
              setParaTransferir(null);
              setErroDeAcao(texto);
              recarregar();
              router.refresh();
            }}
            aoSairDaSessao={() => router.push("/login")}
            aoDivergir={() => router.refresh()}
          />
        </ModalDaTela>
      )}

      {avisoDaTransferencia && (
        <p className="equipe-feito" role="status">
          {avisoDaTransferencia}
        </p>
      )}

      {erroDeAcao && <MensagemErro id={erroId}>{erroDeAcao}</MensagemErro>}

      <div className="conc-mesa">
        <div className="empresas-lista" data-tutorial="equipe">
          <section aria-labelledby={`${erroId}-pessoas`}>
            <div className="conc-mes">
              <h2 id={`${erroId}-pessoas`} className="conc-mes-titulo">
                Com acesso
              </h2>
              <span className="conc-mes-meta">{`${estado.pessoas.length} ${estado.pessoas.length === 1 ? "pessoa" : "pessoas"}`}</span>
            </div>
            <div className="empresas-tabela">
              <table className="table tabela-escolha" aria-label="Pessoas com acesso">
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.pessoas.map((pessoa) => {
                    const eu = pessoa.email.toLowerCase() === email.toLowerCase();
                    return (
                      <tr key={pessoa.id} aria-selected={pessoa.id === atual?.id} onClick={() => escolher(pessoa.id)}>
                        <td>
                          <span className="equipe-quem-linha">
                            <span className="equipe-avatar" aria-hidden="true">
                              {iniciais(pessoa.nome)}
                            </span>
                            <span className="equipe-quem">
                              <span className="equipe-nome-linha">
                                <button
                                  type="button"
                                  className="tabela-escolha-botao equipe-nome"
                                  aria-pressed={pessoa.id === atual?.id}
                                  onClick={(evento) => {
                                    evento.stopPropagation();
                                    escolher(pessoa.id);
                                  }}
                                >
                                  {pessoa.nome}
                                </button>
                                {eu && <span className="tag tag-outline">você</span>}
                              </span>
                              <span>{pessoa.email}</span>
                            </span>
                          </span>
                        </td>
                        <td>
                          {emCurso === pessoa.id ? "Salvando…" : ROTULO_DO_PAPEL[pessoa.papel]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {visiveis.length > 0 && (
            <section aria-labelledby={`${erroId}-convites`}>
              <div className="conc-mes">
                <h2 id={`${erroId}-convites`} className="conc-mes-titulo">
                  Convites pendentes
                </h2>
                <span className="conc-mes-meta">{`${visiveis.length} ${visiveis.length === 1 ? "convite" : "convites"}`}</span>
              </div>
              <div className="empresas-tabela">
                <table className="table tabela-escolha" aria-label="Convites pendentes">
                  <thead>
                    <tr>
                      <th scope="col">Convite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((convite) => (
                      <tr key={convite.id} className="equipe-pendente" aria-selected={convite.id === atual?.id} onClick={() => escolher(convite.id)}>
                        <td>
                          <span className="equipe-quem-linha">
                            <span className="equipe-avatar" aria-hidden="true">
                              @
                            </span>
                            <span className="equipe-quem">
                              <span className="equipe-nome-linha">
                                <button
                                  type="button"
                                  className="tabela-escolha-botao equipe-nome"
                                  aria-pressed={convite.id === atual?.id}
                                  onClick={(evento) => {
                                    evento.stopPropagation();
                                    escolher(convite.id);
                                  }}
                                >
                                  {convite.email}
                                </button>
                              </span>
                              <span>{`${convite.papel ? `${ROTULO_DO_PAPEL[convite.papel]} · ` : ""}Enviado em ${convite.enviadoEm} · vale até ${convite.valeAte}`}</span>
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!gerencia && (
            <p className="empresas-nota">Só o administrador e o gestor convidam pessoas; só o administrador remove.</p>
          )}

          {gerencia && limite && (
            <FaixaDoPlano
              contagem={
                limite.maximo === null
                  ? `${limite.usadas} ${limite.usadas === 1 ? "pessoa" : "pessoas"}`
                  : `${limite.usadas} de ${limite.maximo} pessoas`
              }
              usadas={limite.usadas}
              maximo={limite.maximo}
              aviso={textoDoLimite("usuarios", limite) ?? (limite.maximo === null ? null : "Os convites pendentes contam.")}
              verPlanos={situacao === "no-limite" || situacao === "acima"}
            />
          )}
        </div>

        {atual && "nome" in atual ? (
          <PainelDaPessoa
            ref={painel}
            pessoa={atual}
            eu={atual.email.toLowerCase() === email.toLowerCase()}
            papelDeQuemVe={papel}
            emCurso={emCurso}
            confirmando={confirmando === atual.id}
            menuAberto={menuAberto === atual.id}
            erro={erroDaPessoa?.id === atual.id ? erroDaPessoa.texto : null}
            erroId={`${erroId}-${atual.id}`}
            aoAlternarMenu={(abrir) => setMenuAberto(abrir ? atual.id : null)}
            aoEscolherPapel={(novo) => void mudarPapel(atual, novo)}
            aoTransferir={() => {
              setMenuAberto(null);
              setErroDeAcao("");
              setAvisoDaTransferencia("");
              setParaTransferir({ id: atual.id, nome: atual.nome });
            }}
            aoPedirRemocao={() => {
              setErroDeAcao("");
              setConfirmando(atual.id);
            }}
            aoDesistir={() => setConfirmando(null)}
            aoRemover={() =>
              void agir(
                atual.id,
                () => removerPessoa(atual.id),
                (equipe) => ({ ...equipe, pessoas: equipe.pessoas.filter((p) => p.id !== atual.id) }),
              )
            }
          />
        ) : atual ? (
          <aside ref={painel} className="conc-previa" aria-label="Convite escolhido" aria-live="polite">
            <span className="rotulo">Convite pendente</span>
            <h2 className="conc-previa-titulo">{atual.email}</h2>
            {atual.papel && DESCRICAO_DO_PAPEL[atual.papel] && (
              <div className="extrato-resultado">
                <p className="equipe-papel-texto">
                  <b>{`${ROTULO_DO_PAPEL[atual.papel]}.`}</b> {DESCRICAO_DO_PAPEL[atual.papel]}
                </p>
              </div>
            )}
            <dl className="conc-previa-dados">
              <dt>Enviado em</dt>
              <dd>{atual.enviadoEm}</dd>
              <dt>Vale até</dt>
              <dd>{atual.valeAte}</dd>
            </dl>
            <div className="conc-previa-acoes">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={emCurso !== null}
                onClick={() =>
                  void agir(
                    atual.id,
                    () => cancelarConvite(atual.id),
                    (equipe) => ({ ...equipe, convites: (equipe.convites ?? []).filter((c) => c.id !== atual.id) }),
                  )
                }
              >
                Cancelar convite
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** A pessoa escolhida, ao lado da lista: o papel explicado e o que o admin pode fazer com ela. */
function PainelDaPessoa({
  ref,
  pessoa,
  eu,
  papelDeQuemVe,
  emCurso,
  confirmando,
  menuAberto,
  erro,
  erroId,
  aoAlternarMenu,
  aoEscolherPapel,
  aoTransferir,
  aoPedirRemocao,
  aoDesistir,
  aoRemover,
}: {
  ref: React.Ref<HTMLElement>;
  pessoa: Pessoa;
  eu: boolean;
  papelDeQuemVe: Papel;
  emCurso: string | null;
  confirmando: boolean;
  menuAberto: boolean;
  erro: string | null;
  erroId: string;
  aoAlternarMenu: (abrir: boolean) => void;
  aoEscolherPapel: (novo: "gestor" | "analista") => void;
  aoTransferir: () => void;
  aoPedirRemocao: () => void;
  aoDesistir: () => void;
  aoRemover: () => void;
}) {
  // só o admin troca papel e remove, e nunca a si mesmo nem outro admin
  const gerenciavel = papelDeQuemVe === "admin" && !eu && pessoa.papel !== "admin";
  const descricao = DESCRICAO_DO_PAPEL[pessoa.papel];
  return (
    <aside ref={ref} className="conc-previa" aria-label="Pessoa escolhida" aria-live="polite" data-tutorial="pessoa">
      <span className="rotulo">{ROTULO_DO_PAPEL[pessoa.papel]}</span>
      <h2 className="conc-previa-titulo equipe-previa-titulo">
        {pessoa.nome}
        {eu && <span className="tag tag-outline">você</span>}
      </h2>
      {descricao && (
        <div className="extrato-resultado">
          <p className="equipe-papel-texto">{descricao}</p>
        </div>
      )}
      <dl className="conc-previa-dados">
        <dt>E-mail</dt>
        <dd>{pessoa.email}</dd>
      </dl>
      {gerenciavel && confirmando ? (
        <div className="equipe-confirma">
          <span>
            {pessoa.nome} perde o acesso na hora. As decisões que registrou continuam no histórico com o nome da pessoa.
          </span>
          <button type="button" className="btn btn-perigo" disabled={emCurso === pessoa.id} onClick={aoRemover}>
            Remover
          </button>
          <button type="button" className="btn btn-secondary" disabled={emCurso === pessoa.id} onClick={aoDesistir}>
            Cancelar
          </button>
        </div>
      ) : (
        gerenciavel && (
          <div className="conc-previa-acoes equipe-previa-acoes">
            <MenuDePapel
              nome={pessoa.nome}
              papel={pessoa.papel}
              aberto={menuAberto}
              aoAlternar={aoAlternarMenu}
              salvando={emCurso === pessoa.id}
              desabilitado={emCurso !== null}
              aoEscolher={aoEscolherPapel}
              aoTransferir={aoTransferir}
            />
            <button type="button" className="btn btn-secondary" disabled={emCurso !== null} onClick={aoPedirRemocao}>
              Remover
            </button>
          </div>
        )
      )}
      {erro && <MensagemErro id={erroId}>{erro}</MensagemErro>}
    </aside>
  );
}

/** O e-mail de quem convidar, o papel que terá (cada um explicado) e o retorno do backend, na janela do convite. */
function ConvidarPessoa({
  papeis,
  aoConvidar,
  aoFechar,
  aoSairDaSessao,
}: {
  /** Os papéis que quem convida pode dar. */
  papeis: Papel[];
  aoConvidar: (convite: Convite) => void;
  aoFechar: () => void;
  aoSairDaSessao: () => void;
}) {
  const [email, setEmail] = useState("");
  // o padrão é o papel de menos poder: o último da lista (analista)
  const [escolhido, setEscolhido] = useState<Papel>(papeis[papeis.length - 1]);
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);
  const campoId = useId();
  const retornoId = useId();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    if (!EMAIL_VALIDO.test(email.trim())) {
      setRetorno({ ok: false, texto: MENSAGEM_EMAIL_INCOMPLETO });
      return;
    }
    setEnviando(true);
    setRetorno(null);
    const resposta = await convidar(email, escolhido).catch(
      (): Resultado<Convite> => ({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." }),
    );
    setEnviando(false);
    if (resposta.ok) {
      setEmail("");
      setRetorno({ ok: true, texto: `Convite enviado para ${resposta.dados.email}. O link vale até ${resposta.dados.valeAte}.` });
      aoConvidar(resposta.dados);
      return;
    }
    if (resposta.status === 401) {
      aoSairDaSessao();
      return;
    }
    setRetorno({ ok: false, texto: resposta.erro });
  }

  return (
    <form className="equipe-convite" onSubmit={enviar} noValidate aria-label="Convidar pessoa">
      <div className="field">
        <label htmlFor={campoId}>E-mail da pessoa</label>
        <input
          id={campoId}
          className="input"
          type="email"
          autoComplete="off"
          value={email}
          aria-describedby={retorno ? retornoId : undefined}
          onChange={(evento) => setEmail(evento.target.value)}
        />
      </div>
      <div className="equipe-papeis">
        {papeis.map((papel) => (
          <button
            key={papel}
            type="button"
            className="equipe-papel-opcao"
            aria-pressed={escolhido === papel}
            disabled={papeis.length === 1}
            onClick={() => setEscolhido(papel)}
          >
            <b>{ROTULO_DO_PAPEL[papel]}</b>
            <span>{DESCRICAO_DO_PAPEL[papel]}</span>
          </button>
        ))}
      </div>
      {retorno &&
        (retorno.ok ? (
          <p id={retornoId} className="equipe-feito" role="status">
            {retorno.texto}
          </p>
        ) : (
          <MensagemErro id={retornoId}>{retorno.texto}</MensagemErro>
        ))}
      <div className="equipe-convite-botoes">
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar convite"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={aoFechar}>
          Fechar
        </button>
        <span className="equipe-nota">O link vale por 7 dias.</span>
      </div>
    </form>
  );
}
