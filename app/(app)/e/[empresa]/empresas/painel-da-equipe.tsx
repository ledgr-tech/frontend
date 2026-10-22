"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
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
    if (resposta.status === 403) recarregar();
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
    setErroDaPessoa({ id: pessoa.id, texto: resposta.erro });
    // a pessoa saiu da conta ou o papel de quem decide mudou por fora: a equipe se relê
    if (resposta.status === 403 || resposta.status === 404) recarregar();
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

  return (
    <div>
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
              // o papel de quem transferiu vem do /me: relendo a página, os controles de administrador somem
              router.refresh();
            }}
            aoFechar={() => setParaTransferir(null)}
            aoRecusar={(texto) => {
              setParaTransferir(null);
              setErroDeAcao(texto);
              recarregar();
            }}
            aoSairDaSessao={() => router.push("/login")}
          />
        </ModalDaTela>
      )}

      {avisoDaTransferencia && (
        <p className="equipe-feito" role="status">
          {avisoDaTransferencia}
        </p>
      )}

      {erroDeAcao && <MensagemErro id={erroId}>{erroDeAcao}</MensagemErro>}

      <ul className="equipe-lista" aria-label="Pessoas com acesso">
        {estado.pessoas.map((pessoa) => {
          const eu = pessoa.email.toLowerCase() === email.toLowerCase();
          const removivel = papel === "admin" && !eu && pessoa.papel !== "admin";
          // só o admin mexe no papel dos outros (o dele só muda pela transferência)
          const gerenciavel = removivel;
          return (
            <li key={pessoa.id} className="equipe-linha">
              <span className="equipe-avatar" aria-hidden="true">
                {iniciais(pessoa.nome)}
              </span>
              <span className="equipe-quem">
                <b className="equipe-nome">
                  {pessoa.nome}
                  {eu && <span className="tag tag-outline">você</span>}
                </b>
                <span>{pessoa.email}</span>
              </span>
              {removivel && confirmando === pessoa.id ? (
                <span className="equipe-confirma">
                  <span>
                    {pessoa.nome} perde o acesso na hora. As decisões que registrou continuam no histórico com o nome da pessoa.
                  </span>
                  <button
                    type="button"
                    className="btn btn-perigo"
                    disabled={emCurso === pessoa.id}
                    onClick={() =>
                      void agir(
                        pessoa.id,
                        () => removerPessoa(pessoa.id),
                        (equipe) => ({ ...equipe, pessoas: equipe.pessoas.filter((p) => p.id !== pessoa.id) }),
                      )
                    }
                  >
                    Remover
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={emCurso === pessoa.id} onClick={() => setConfirmando(null)}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <span className="equipe-acoes">
                  {gerenciavel ? (
                    <MenuDePapel
                      nome={pessoa.nome}
                      papel={pessoa.papel}
                      aberto={menuAberto === pessoa.id}
                      aoAlternar={(abrir) => setMenuAberto(abrir ? pessoa.id : null)}
                      salvando={emCurso === pessoa.id}
                      desabilitado={emCurso !== null}
                      aoEscolher={(novo) => void mudarPapel(pessoa, novo)}
                      aoTransferir={() => {
                        setMenuAberto(null);
                        setErroDeAcao("");
                        setAvisoDaTransferencia("");
                        setParaTransferir({ id: pessoa.id, nome: pessoa.nome });
                      }}
                    />
                  ) : (
                    <span className="equipe-papel">{ROTULO_DO_PAPEL[pessoa.papel]}</span>
                  )}
                  {removivel && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={emCurso !== null}
                      onClick={() => {
                        setErroDeAcao("");
                        setConfirmando(pessoa.id);
                      }}
                    >
                      Remover
                    </button>
                  )}
                </span>
              )}
              {erroDaPessoa?.id === pessoa.id && <MensagemErro id={`${erroId}-${pessoa.id}`}>{erroDaPessoa.texto}</MensagemErro>}
            </li>
          );
        })}
      </ul>

      {!gerencia && (
        <p className="empresas-nota">Só o administrador e o gestor convidam pessoas; só o administrador remove.</p>
      )}

      {gerencia && convites.length > 0 && (
        <>
          <p className="equipe-rotulo">Convites pendentes</p>
          <ul className="equipe-lista" aria-label="Convites pendentes">
            {convites.map((convite) => (
              <li key={convite.id} className="equipe-linha equipe-pendente">
                <span className="equipe-avatar" aria-hidden="true">
                  @
                </span>
                <span className="equipe-quem">
                  <b className="equipe-nome">{convite.email}</b>
                  <span>
                    {convite.papel ? `${ROTULO_DO_PAPEL[convite.papel]} · ` : ""}Enviado em {convite.enviadoEm} · vale até {convite.valeAte}
                  </span>
                </span>
                <span className="equipe-acoes">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={emCurso !== null}
                    onClick={() =>
                      void agir(
                        convite.id,
                        () => cancelarConvite(convite.id),
                        (equipe) => ({ ...equipe, convites: (equipe.convites ?? []).filter((c) => c.id !== convite.id) }),
                      )
                    }
                  >
                    Cancelar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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
