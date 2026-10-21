"use client";

import { useCallback, useContext, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Convite } from "@/lib/adaptadores";
import { papeisQueConvida, podeConvidar, ROTULO_DO_PAPEL, type Papel } from "@/lib/papel";
import { MensagemErro } from "../../(auth)/_compartilhado/mensagem-erro";
import { EMAIL_VALIDO, MENSAGEM_EMAIL_INCOMPLETO } from "../../(auth)/_compartilhado/validacao";
import { EmpresaDaSessao } from "../cabecalho";
import type { Resultado } from "../conciliacoes/acoes";
import { cancelarConvite, carregarEquipe, convidar, removerPessoa, type Equipe } from "./acoes";

/**
 * A seção Equipe das Configurações (spec 2026-10-16-equipe-e-convites). Devolve
 * linhas no mesmo formato das outras seções, para a janela desenhar e a busca
 * achar. Três papéis (#133): o admin convida gestor ou analista, o gestor convida só
 * analista, os dois cancelam convite; remover pessoas é do admin; o analista vê a
 * lista. O backend garante cada regra; aqui só some o que ele recusaria.
 */

export type LinhaDaEquipe = { chave?: string; titulo: string; descricao?: string; controle?: ReactNode };

type Estado = Equipe | "carregando" | "sem-rota" | "falhou";

export function useLinhasDaEquipe({
  aberta,
  papel,
  email,
}: {
  aberta: boolean;
  /** O papel de quem está logado: define o que a seção mostra e oferece. */
  papel: Papel;
  /** O e-mail da sessão, para marcar a própria linha. */
  email: string;
}): LinhaDaEquipe[] {
  const router = useRouter();
  const empresa = useContext(EmpresaDaSessao);
  // undefined até a janela abrir pela primeira vez, como as regras da conciliação
  const [estado, setEstado] = useState<Estado | undefined>(undefined);
  /** A ação em curso: o id da pessoa ou do convite. Trava os botões dela. */
  const [emCurso, setEmCurso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erroDeAcao, setErroDeAcao] = useState("");
  const erroId = useId();

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
    if (!aberta || estado !== undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado("carregando");
    carregar();
  }, [aberta, estado, carregar]);

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
      setEstado((atual) => (typeof atual === "object" ? depois(atual) : atual));
      return;
    }
    if (resposta.status === 401) {
      router.push("/login");
      return;
    }
    setErroDeAcao(resposta.erro);
    if (resposta.status === 403) carregar();
  }

  const abertura: LinhaDaEquipe = {
    titulo: "Quem tem acesso",
    descricao: `Quem tem acesso à ${empresa || "empresa"}. Cada pessoa entra com o próprio e-mail.`,
    controle:
      estado === undefined || estado === "carregando" ? (
        <span className="cfg-valor">Carregando a equipe…</span>
      ) : estado === "sem-rota" ? (
        <span className="cfg-valor">A equipe ainda não está disponível.</span>
      ) : estado === "falhou" ? (
        <div className="cfg-acao">
          <span className="cfg-valor">Não foi possível carregar agora.</span>
          <button type="button" className="btn btn-secondary" onClick={() => setEstado(undefined)}>
            Tentar de novo
          </button>
        </div>
      ) : erroDeAcao ? (
        <MensagemErro id={erroId}>{erroDeAcao}</MensagemErro>
      ) : undefined,
  };
  if (typeof estado !== "object") return [abertura];

  const pessoas: LinhaDaEquipe[] = estado.pessoas.map((pessoa) => {
    const eu = pessoa.email.toLowerCase() === email.toLowerCase();
    const removivel = papel === "admin" && !eu && pessoa.papel !== "admin";
    const marcas = (
      <>
        <span className="tag">{ROTULO_DO_PAPEL[pessoa.papel]}</span>
        {eu && <span className="tag tag-outline">você</span>}
      </>
    );
    if (removivel && confirmando === pessoa.id) {
      return {
        chave: pessoa.id,
        titulo: pessoa.nome,
        descricao: pessoa.email,
        controle: (
          <div className="cfg-form">
            <p className="cfg-form-aviso">
              {pessoa.nome} perde o acesso na hora. As decisões que registrou continuam no histórico com o nome dela.
            </p>
            <div className="cfg-form-botoes">
              <button
                type="button"
                className="btn btn-perigo"
                disabled={emCurso === pessoa.id}
                onClick={() =>
                  void agir(
                    pessoa.id,
                    () => removerPessoa(pessoa.id),
                    (equipe) => ({ ...equipe, pessoas: equipe.pessoas.filter((outra) => outra.id !== pessoa.id) }),
                  )
                }
              >
                Remover
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={emCurso === pessoa.id}
                onClick={() => setConfirmando(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ),
      };
    }
    return {
      chave: pessoa.id,
      titulo: pessoa.nome,
      descricao: pessoa.email,
      controle: (
        <div className="cfg-acao">
          {marcas}
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
        </div>
      ),
    };
  });

  if (!podeConvidar(papel)) {
    return [
      abertura,
      ...pessoas,
      { titulo: "Convidar pessoa", descricao: "Só o administrador e o gestor convidam pessoas; só o administrador remove." },
    ];
  }

  const convites = estado.convites ?? [];
  const convidarLinha: LinhaDaEquipe = {
    titulo: "Convidar pessoa",
    descricao: "O convite chega por e-mail, com um link que vale por 7 dias.",
    controle: (
      <ConvidarPessoa
        papeis={papeisQueConvida(papel)}
        aoConvidar={(convite) =>
          setEstado((atual) =>
            typeof atual === "object"
              ? { ...atual, convites: [convite, ...(atual.convites ?? []).filter((c) => c.id !== convite.id)] }
              : atual,
          )
        }
        aoSairDaSessao={() => router.push("/login")}
      />
    ),
  };
  const pendentes: LinhaDaEquipe[] = convites.length
    ? [
        { titulo: "Convites pendentes" },
        ...convites.map((convite) => ({
          chave: `convite-${convite.id}`,
          titulo: convite.email,
          descricao: `${convite.papel ? `${ROTULO_DO_PAPEL[convite.papel]} · ` : ""}Enviado em ${convite.enviadoEm} · vale até ${convite.valeAte}`,
          controle: (
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
          ),
        })),
      ]
    : [];
  return [abertura, ...pessoas, convidarLinha, ...pendentes];
}

/** O e-mail de quem convidar, o papel que terá e o retorno do backend, na própria linha. */
function ConvidarPessoa({
  papeis,
  aoConvidar,
  aoSairDaSessao,
}: {
  /** Os papéis que quem convida pode dar; o primeiro é o sugerido. */
  papeis: Papel[];
  aoConvidar: (convite: Convite) => void;
  aoSairDaSessao: () => void;
}) {
  const [email, setEmail] = useState("");
  const [papelEscolhido, setPapelEscolhido] = useState<Papel>(papeis[0]);
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);
  const campoId = useId();
  const papelId = useId();
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
    const resposta = await convidar(email, papelEscolhido).catch(
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
    <form className="cfg-form" onSubmit={enviar} noValidate aria-label="Convidar pessoa">
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
      <div className="field">
        <label htmlFor={papelId}>Papel</label>
        <select
          id={papelId}
          className="input"
          value={papelEscolhido}
          disabled={papeis.length === 1}
          onChange={(evento) => setPapelEscolhido(evento.target.value as Papel)}
        >
          {papeis.map((papel) => (
            <option key={papel} value={papel}>
              {ROTULO_DO_PAPEL[papel]}
            </option>
          ))}
        </select>
      </div>
      {retorno &&
        (retorno.ok ? (
          <p id={retornoId} className="cfg-feito" role="status">
            {retorno.texto}
          </p>
        ) : (
          <MensagemErro id={retornoId}>{retorno.texto}</MensagemErro>
        ))}
      <div className="cfg-form-botoes">
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar convite"}
        </button>
      </div>
    </form>
  );
}
