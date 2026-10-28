"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ModalDaTela } from "../../../(app)/e/[empresa]/empresas/modal-da-tela";
import { agirNaConta, type AcaoDaConta } from "../acoes";

type Acao = { acao: AcaoDaConta; botao: string; titulo: (nome: string) => string; aviso: string };

const ACOES: Record<AcaoDaConta, Acao> = {
  inativar: {
    acao: "inativar",
    botao: "Inativar conta",
    titulo: (nome) => `Inativar ${nome}?`,
    aviso: "A conta passa a ser só de leitura: ninguém escreve, a API e as conexões param. Os dados ficam, e você reativa quando quiser.",
  },
  reativar: {
    acao: "reativar",
    botao: "Reativar conta",
    titulo: (nome) => `Reativar ${nome}?`,
    aviso: "Devolve tudo à conta: escrita, API e conexões voltam a funcionar.",
  },
  "piloto-ligar": {
    acao: "piloto-ligar",
    botao: "Marcar como piloto",
    titulo: (nome) => `Marcar ${nome} como piloto?`,
    aviso: "A conta passa a contar como piloto ativo.",
  },
  "piloto-desligar": {
    acao: "piloto-desligar",
    botao: "Desmarcar piloto",
    titulo: (nome) => `Desmarcar o piloto de ${nome}?`,
    aviso: "A conta deixa de contar como piloto.",
  },
};

/**
 * As ações do cabeçalho da conta (#222, opção B): cada uma abre uma janela que explica o efeito e pede o motivo,
 * que fica no histórico da conta. Sem o estado do piloto (`piloto` null), oferece "Marcar": se já estiver
 * ligado, o backend responde 409 e a janela mostra o texto dele.
 */
export function AcoesDaConta({ id, nome, inativa, piloto }: { id: string; nome: string; inativa: boolean; piloto: boolean | null }) {
  const roteador = useRouter();
  const [aberta, setAberta] = useState<AcaoDaConta | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const trava = useRef(false);

  function fechar() {
    setAberta(null);
    setMotivo("");
    setErro(null);
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!aberta || trava.current) return;
    trava.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const r = await agirNaConta(id, aberta, motivo);
      if (!r.ok) return setErro(r.erro);
      fechar();
      roteador.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  const botoes: Acao[] = [piloto ? ACOES["piloto-desligar"] : ACOES["piloto-ligar"], inativa ? ACOES.reativar : ACOES.inativar];
  const escolhida = aberta ? ACOES[aberta] : null;

  return (
    <>
      {botoes.map((a) => (
        <button
          key={a.acao}
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setAberta(a.acao);
            setErro(null);
          }}
        >
          {a.botao}
        </button>
      ))}
      {escolhida && (
        <ModalDaTela titulo={escolhida.titulo(nome)} aoFechar={fechar}>
          <form onSubmit={confirmar}>
            <p style={{ margin: "0 0 12px" }}>{escolhida.aviso}</p>
            <label style={{ display: "grid", gap: 4, fontSize: 13.5 }}>
              Motivo (fica no histórico da conta)
              <textarea className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} required rows={3} />
            </label>
            {erro && (
              <p role="alert" style={{ margin: "10px 0 0" }}>
                {erro}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={fechar}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={enviando || !motivo.trim()}>
                {escolhida.botao}
              </button>
            </div>
          </form>
        </ModalDaTela>
      )}
    </>
  );
}
