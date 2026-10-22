"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { Pessoa } from "@/lib/adaptadores";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import type { Resultado } from "../conciliacoes/acoes";
import { useTemSenha } from "../conta";
import { transferirAdmin } from "../equipe/acoes";

/**
 * A confirmação da transferência da administração (spec 2026-10-23-papel-e-transferencia), dentro da
 * `ModalDaTela`: o aviso do que muda e a senha atual, como na desativação da conta. A conta só do Google
 * não tem senha: o backend confere o login recente e o 409 dele aparece aqui. Um envio por vez (uma `ref`
 * trava antes do primeiro `await`).
 */
export function TransferirAdmin({
  pessoa,
  aoConcluir,
  aoFechar,
  aoRecusar,
  aoSairDaSessao,
}: {
  pessoa: Pick<Pessoa, "id" | "nome">;
  /** A lista nova da conta, com os papéis já trocados. */
  aoConcluir: (pessoas: Pessoa[]) => void;
  aoFechar: () => void;
  /** 403 ou 404: o papel ou a pessoa mudaram por fora; quem chama fecha a janela, mostra o erro e relê a equipe. */
  aoRecusar: (erro: string) => void;
  aoSairDaSessao: () => void;
}) {
  const temSenha = useTemSenha();
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const emCurso = useRef(false);
  const [erroDaSenha, setErroDaSenha] = useState("");
  const [erro, setErro] = useState("");
  const senhaId = useId();
  const erroSenhaId = useId();
  const erroId = useId();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (emCurso.current) return;
    setErro("");
    if (temSenha && !senha) {
      setErroDaSenha("Digite a sua senha atual.");
      return;
    }
    setErroDaSenha("");
    emCurso.current = true;
    setEnviando(true);
    const resposta = await transferirAdmin(pessoa.id, temSenha ? senha : null).catch(
      (): Resultado<Pessoa[]> => ({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." }),
    );
    emCurso.current = false;
    setEnviando(false);
    if (resposta.ok) {
      aoConcluir(resposta.dados);
      return;
    }
    if (resposta.status === 401) aoSairDaSessao();
    else if (resposta.status === 403 || resposta.status === 404) aoRecusar(resposta.erro);
    else if (resposta.status === 400) setErroDaSenha(resposta.erro);
    else setErro(resposta.erro);
  }

  return (
    <form className="empresas-form" onSubmit={enviar} noValidate aria-label="Transferir administração">
      <p className="dialog-body">
        {pessoa.nome} passa a ser o administrador da conta e você passa a ser Gestor. Só o novo administrador pode desfazer isso.
      </p>
      {temSenha && (
        <div className="field">
          <label htmlFor={senhaId}>Senha atual</label>
          <input
            id={senhaId}
            className="input"
            type="password"
            autoComplete="current-password"
            value={senha}
            aria-invalid={erroDaSenha ? true : undefined}
            aria-describedby={erroDaSenha ? erroSenhaId : undefined}
            onChange={(evento) => setSenha(evento.target.value)}
          />
          {erroDaSenha && <MensagemErro id={erroSenhaId}>{erroDaSenha}</MensagemErro>}
        </div>
      )}
      {erro && <MensagemErro id={erroId}>{erro}</MensagemErro>}
      <div className="empresas-form-botoes">
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? "Transferindo…" : "Transferir administração"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
