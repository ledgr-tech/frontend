"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import type { EmpresaCliente } from "@/lib/adaptadores";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import LinkDoApp from "@/lib/link-do-app";
import { situacaoDoLimite, textoDoLimite } from "@/lib/limites";
import type { Papel } from "@/lib/papel";
import { comEmpresa, destinoDaTroca } from "@/lib/rotas";
import { useRoteador } from "@/lib/roteador";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarCnpj, validarCnpj } from "../../../../(auth)/cadastro/passos";
import { useLimites } from "../conta";
import type { LinhaDaEquipe } from "../equipe/secao-equipe";
import type { Resultado } from "../conciliacoes/acoes";
import { cadastrarEmpresa, carregarEmpresas } from "./acoes";

/**
 * A seção Empresas das Configurações (spec 2026-10-22-empresas-na-configuracao). Devolve linhas no mesmo
 * formato das outras seções, para a janela desenhar e a busca achar. Todo mundo vê as empresas da conta;
 * admin e gestor cadastram (o backend responde 403 ao analista, então o botão nem aparece).
 */

type Estado = EmpresaCliente[] | "carregando" | "sem-rota" | "falhou";

/** Quem cadastra empresa: o admin e o gestor, como quem fecha o mês. */
const podeCadastrar = (papel: Papel) => papel !== "analista";

function contagem(usadas: number, maximo: number | null): string {
  const empresas = `${usadas === 1 ? "empresa" : "empresas"}`;
  return maximo === null ? `${usadas} ${empresas}` : `${usadas} de ${maximo} ${empresas}`;
}

export function useLinhasDasEmpresas({
  aberta,
  papel,
  aoAbrir,
}: {
  aberta: boolean;
  /** O papel de quem está logado: define se a seção oferece o cadastro. */
  papel: Papel;
  /** Roda antes de ir para outra empresa: a janela de Configurações se fecha. */
  aoAbrir: () => void;
}): LinhaDaEquipe[] {
  const router = useRoteador();
  const caminho = usePathname();
  const ativa = useEmpresaAtiva();
  const limites = useLimites();
  // undefined até a janela abrir pela primeira vez, como a equipe e as regras da conciliação
  const [estado, setEstado] = useState<Estado | undefined>(undefined);

  const carregar = useCallback(() => {
    carregarEmpresas().then(
      (resposta) => {
        if (resposta.ok) setEstado(resposta.dados);
        else if (resposta.status === 401) router.push("/login");
        else setEstado(resposta.status === 404 ? "sem-rota" : "falhou");
      },
      () => setEstado("falhou"),
    );
  }, [router]);

  useEffect(() => {
    if (!aberta || estado !== undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado("carregando");
    carregar();
  }, [aberta, estado, carregar]);

  const abertura: LinhaDaEquipe = {
    titulo: "Empresas clientes",
    descricao: "As empresas da conta. Todas as pessoas da conta veem todas elas.",
    controle:
      estado === undefined || estado === "carregando" ? (
        <span className="cfg-valor">Carregando as empresas…</span>
      ) : estado === "sem-rota" ? (
        <span className="cfg-valor">As empresas ainda não estão disponíveis.</span>
      ) : estado === "falhou" ? (
        <div className="cfg-acao">
          <span className="cfg-valor">Não foi possível carregar agora.</span>
          <button type="button" className="btn btn-secondary" onClick={() => setEstado(undefined)}>
            Tentar de novo
          </button>
        </div>
      ) : undefined,
  };
  if (typeof estado !== "object") return [abertura];

  function abrir(empresa: EmpresaCliente) {
    aoAbrir();
    gravarEmpresaRecente(empresa.id);
    router.push(destinoDaTroca(caminho, empresa.id));
  }

  const empresas: LinhaDaEquipe[] = estado.map((empresa) => ({
    chave: empresa.id,
    titulo: empresa.razaoSocial,
    descricao: formatarCnpj(empresa.cnpj),
    controle: (
      <div className="cfg-acao">
        {empresa.id === ativa?.id && <span className="tag">Ativa</span>}
        {empresa.cnpjVerificado && <span className="tag tag-outline">CNPJ verificado</span>}
        {empresa.id !== ativa?.id && (
          <button type="button" className="btn btn-secondary" aria-label={`Abrir ${empresa.razaoSocial}`} onClick={() => abrir(empresa)}>
            Abrir
          </button>
        )}
      </div>
    ),
  }));

  const limite = limites?.empresas ?? null;
  const situacao = limite ? situacaoDoLimite(limite) : null;
  const plano: LinhaDaEquipe[] = limite
    ? [
        {
          titulo: "Empresas do plano",
          descricao: textoDoLimite("empresas", limite) ?? undefined,
          controle: (
            <div className="cfg-acao">
              <span className="cfg-valor">{contagem(limite.usadas, limite.maximo)}</span>
              {(situacao === "no-limite" || situacao === "acima") && (
                <LinkDoApp href="/assinatura" className="btn btn-secondary">
                  Ver planos
                </LinkDoApp>
              )}
            </div>
          ),
        },
      ]
    : [];

  const adicionar: LinhaDaEquipe = podeCadastrar(papel)
    ? {
        titulo: "Adicionar empresa",
        descricao: "Cadastre uma empresa cliente pelo CNPJ. Ela entra na conta e você passa a trabalhar nela.",
        controle: <CadastrarEmpresa noLimite={situacao === "no-limite"} aoAbrir={aoAbrir} aoRecarregar={carregar} />,
      }
    : { titulo: "Adicionar empresa", descricao: "Só o admin e o gestor cadastram empresas." };

  return [abertura, ...empresas, ...plano, adicionar];
}

/**
 * CNPJ e razão social, e o retorno do backend, na própria linha. Cadastrou, abre a empresa nova (spec:
 * quem cadastra um cliente quase sempre vai subir o extrato dele em seguida). No limite do plano o
 * botão fica desligado; o 402 do backend, quando o contador da tela está velho, mostra a mensagem dele.
 */
function CadastrarEmpresa({
  noLimite,
  aoAbrir,
  aoRecarregar,
}: {
  noLimite: boolean;
  aoAbrir: () => void;
  aoRecarregar: () => void;
}) {
  const router = useRoteador();
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [enviando, setEnviando] = useState(false);
  // o estado só vale depois do próximo render: dois envios no mesmo instante passariam os dois
  const emCurso = useRef(false);
  const [erroDoCnpj, setErroDoCnpj] = useState("");
  const [erroDaRazao, setErroDaRazao] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; planos: boolean } | null>(null);
  const cnpjId = useId();
  const razaoId = useId();
  const erroCnpjId = useId();
  const erroRazaoId = useId();
  const avisoId = useId();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (emCurso.current || noLimite) return;
    const recusaDoCnpj = validarCnpj(cnpj) ?? "";
    const recusaDaRazao = razaoSocial.trim() ? "" : "Informe a razão social.";
    setErroDoCnpj(recusaDoCnpj);
    setErroDaRazao(recusaDaRazao);
    setAviso(null);
    if (recusaDoCnpj || recusaDaRazao) return;
    emCurso.current = true;
    setEnviando(true);
    const resposta = await cadastrarEmpresa(cnpj, razaoSocial).catch(
      (): Resultado<EmpresaCliente> => ({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." }),
    );
    emCurso.current = false;
    setEnviando(false);
    if (resposta.ok) {
      setCnpj("");
      setRazaoSocial("");
      aoAbrir();
      gravarEmpresaRecente(resposta.dados.id);
      router.push(comEmpresa(resposta.dados.id, "/visao-geral"));
      return;
    }
    if (resposta.status === 401) {
      router.push("/login");
    } else if (resposta.status === 409 || resposta.status === 422) {
      setErroDoCnpj(resposta.erro);
    } else if (resposta.status === 402) {
      // o contador da tela estava velho (outra aba, plano trocado): relê o /me para atualizá-lo
      setAviso({ texto: resposta.erro, planos: true });
      router.refresh();
    } else {
      setAviso({ texto: resposta.erro, planos: false });
      // o papel mudou por fora: a lista e o que a pessoa pode fazer se releem
      if (resposta.status === 403) aoRecarregar();
    }
  }

  return (
    <form className="cfg-form" onSubmit={enviar} noValidate aria-label="Adicionar empresa">
      <div className="field">
        <label htmlFor={cnpjId}>CNPJ</label>
        <input
          id={cnpjId}
          className="input"
          autoComplete="off"
          maxLength={18}
          value={cnpj}
          aria-invalid={erroDoCnpj ? true : undefined}
          aria-describedby={erroDoCnpj ? erroCnpjId : undefined}
          onChange={(evento) => setCnpj(formatarCnpj(evento.target.value))}
        />
        {erroDoCnpj && <MensagemErro id={erroCnpjId}>{erroDoCnpj}</MensagemErro>}
      </div>
      <div className="field">
        <label htmlFor={razaoId}>Razão social</label>
        <input
          id={razaoId}
          className="input"
          autoComplete="off"
          value={razaoSocial}
          aria-invalid={erroDaRazao ? true : undefined}
          aria-describedby={erroDaRazao ? erroRazaoId : undefined}
          onChange={(evento) => setRazaoSocial(evento.target.value)}
        />
        {erroDaRazao && <MensagemErro id={erroRazaoId}>{erroDaRazao}</MensagemErro>}
      </div>
      {aviso && <MensagemErro id={avisoId}>{aviso.texto}</MensagemErro>}
      <div className="cfg-form-botoes">
        <button type="submit" className="btn btn-primary" disabled={enviando || noLimite}>
          {enviando ? "Cadastrando…" : "Cadastrar empresa"}
        </button>
        {aviso?.planos && (
          <LinkDoApp href="/assinatura" className="btn btn-secondary">
            Ver planos
          </LinkDoApp>
        )}
      </div>
    </form>
  );
}
