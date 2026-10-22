"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { EmpresaCliente } from "@/lib/adaptadores";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import LinkDoApp from "@/lib/link-do-app";
import { comEmpresa } from "@/lib/rotas";
import { useRoteador } from "@/lib/roteador";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarCnpj, validarCnpj } from "../../../../(auth)/cadastro/passos";
import type { Resultado } from "../conciliacoes/acoes";
import { cadastrarEmpresa } from "./acoes";

/**
 * CNPJ e razão social, e o retorno do backend, no painel da tela Empresas. Cadastrou, abre a empresa nova
 * (quem cadastra um cliente quase sempre vai subir o extrato dele em seguida). No limite do plano o
 * botão da tela fica desligado; o 402 do backend, quando o contador da tela está velho, mostra a
 * mensagem dele e relê a página.
 */
export function CadastrarEmpresa({ noLimite, aoCadastrar }: { noLimite: boolean; aoCadastrar: () => void }) {
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
      aoCadastrar();
      gravarEmpresaRecente(resposta.dados.id);
      router.push(comEmpresa(resposta.dados.id, "/visao-geral"));
      return;
    }
    if (resposta.status === 401) {
      router.push("/login");
    } else if (resposta.status === 409 || resposta.status === 422) {
      setErroDoCnpj(resposta.erro);
    } else if (resposta.status === 402) {
      // o contador da tela estava velho (outra aba, plano trocado): relê a página para atualizá-lo
      setAviso({ texto: resposta.erro, planos: true });
      router.refresh();
    } else {
      setAviso({ texto: resposta.erro, planos: false });
      // o papel mudou por fora: a página relida deixa de oferecer o cadastro
      if (resposta.status === 403) router.refresh();
    }
  }

  return (
    <form className="empresas-form" onSubmit={enviar} noValidate aria-label="Adicionar empresa">
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
      <div className="empresas-form-botoes">
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
