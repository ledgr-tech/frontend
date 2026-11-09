"use client";

import { useId, useRef, useState } from "react";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import Link from "@/lib/link-do-app";
import { useRoteador } from "@/lib/roteador";
import { MensagemErro } from "../../../../../../../(auth)/_compartilhado/mensagem-erro";
import type { Falha } from "../../../acoes";
import { concluirNovaVersaoIa, type ContextoNovaVersaoIa } from "../acoes";

export function RetomarNovaVersao({
  contexto,
  importacaoId,
  falhaInicial,
}: {
  contexto: ContextoNovaVersaoIa & { arquivoBanco: string };
  importacaoId: string;
  falhaInicial?: Falha;
}) {
  const { banco, sistemaAnterior, arquivoBanco } = contexto;
  const roteador = useRoteador();
  const idErro = useId();
  const [falha, setFalha] = useState(falhaInicial);
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);

  async function tentar() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setFalha(undefined);
    let navegando = false;
    try {
      const r = await concluirNovaVersaoIa(contexto, importacaoId, true);
      if (r.ok) {
        roteador.replace(caminhoDaConciliacao(banco, r.dados.extratoId));
        navegando = true;
      } else if (r.status === 401) {
        roteador.push("/login");
        navegando = true;
      } else {
        setFalha(r);
      }
    } catch {
      setFalha({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    } finally {
      if (!navegando) {
        trava.current = false;
        setOcupado(false);
      }
    }
  }

  return (
    <div className="nova-corpo">
      <section className="ia-prompt">
        <h2>Extrato do sistema confirmado</h2>
        <p className="dialog-body">Você pode usar o arquivo já confirmado para concluir a conciliação com {arquivoBanco}.</p>
        {falha && <MensagemErro id={idErro}>{falha.erro}</MensagemErro>}
        <div className="dialog-actions">
          <Link href={caminhoDaConciliacao(banco, sistemaAnterior)} className="btn btn-secondary">
            Voltar à comparação
          </Link>
          {falha?.status === 402 && <Link href="/assinatura" className="btn btn-secondary">Ver os planos</Link>}
          <button type="button" className="btn btn-primary" onClick={tentar} disabled={ocupado} aria-busy={ocupado}>
            {ocupado ? "Conciliando…" : "Tentar conciliar novamente"}
          </button>
        </div>
      </section>
    </div>
  );
}
