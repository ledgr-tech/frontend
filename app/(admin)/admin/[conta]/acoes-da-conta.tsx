"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { agirNaConta, type AcaoDaConta } from "../acoes";

const ACOES: { acao: AcaoDaConta; rotulo: string; aviso: string; so?: "ativa" | "inativa" }[] = [
  {
    acao: "inativar",
    rotulo: "Inativar conta",
    aviso: "A conta passa a ser só de leitura: ninguém escreve, a API e as conexões param. Os dados ficam.",
    so: "ativa",
  },
  { acao: "reativar", rotulo: "Reativar conta", aviso: "Devolve tudo à conta.", so: "inativa" },
  { acao: "piloto-ligar", rotulo: "Marcar como piloto", aviso: "Marca a conta como piloto ativo." },
  { acao: "piloto-desligar", rotulo: "Desmarcar piloto", aviso: "Tira a marca de piloto da conta." },
];

/** Cada ação pede o motivo e uma confirmação antes de executar (#222): o motivo fica no histórico da conta. */
export function AcoesDaConta({ id, inativa }: { id: string; inativa: boolean }) {
  const roteador = useRouter();
  const [aberta, setAberta] = useState<AcaoDaConta | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const trava = useRef(false);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!aberta || trava.current) return;
    trava.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const r = await agirNaConta(id, aberta, motivo);
      if (!r.ok) return setErro(r.erro);
      setAberta(null);
      setMotivo("");
      roteador.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  const disponiveis = ACOES.filter((a) => !a.so || (a.so === "inativa") === inativa);
  const escolhida = ACOES.find((a) => a.acao === aberta);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {disponiveis.map((a) => (
          <button
            key={a.acao}
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setAberta(a.acao);
              setErro(null);
            }}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {escolhida && (
        <form onSubmit={confirmar} style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 520 }}>
          <p>{escolhida.aviso}</p>
          <label>
            Motivo (fica no histórico)
            <textarea className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} required rows={3} />
          </label>
          {erro && <p role="alert">{erro}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={enviando || !motivo.trim()}>
              {`Confirmar: ${escolhida.rotulo.toLowerCase()}`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAberta(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
