"use client";

import { useEffect } from "react";
import Image from "next/image";
import { abrirTutorial } from "@/lib/eventos";
import { ModalDaTela, BotaoFecharJanela } from "../empresas/modal-da-tela";
import { useEmail, useNome, usePreferencias } from "../conta";
import { marcarTutorialVisto } from "../tutorial/tutorial";

const PASSOS = [
  "Envie o extrato do banco.",
  "Envie o extrato do sistema.",
  "Revise o que não bateu e feche o mês.",
];

/**
 * A janela da primeira entrada: leva ao tutorial da Visão geral. Aparece uma vez por pessoa;
 * Esc, o fundo e "Agora não" valem o mesmo. A conta de demonstração (`demonstracao`, que só o servidor
 * sabe) não a vê: só marca como vista, para o tutorial não esperar por ela.
 */
export function BoasVindas({ demonstracao = false }: { demonstracao?: boolean }) {
  const { carregado, boasVindasVista, marcarBoasVindasVista } = usePreferencias();
  const email = useEmail();
  const primeiroNome = useNome().trim().split(/\s+/)[0];

  useEffect(() => {
    if (demonstracao && carregado && !boasVindasVista) marcarBoasVindasVista();
  }, [demonstracao, carregado, boasVindasVista, marcarBoasVindasVista]);

  if (demonstracao || !carregado || boasVindasVista) return null;

  function fechar(comecar: boolean) {
    // antes de marcar: o tutorial acorda ao marcar e não pode abrir sozinho por cima
    marcarTutorialVisto(email, "visao-geral");
    marcarBoasVindasVista();
    if (comecar) abrirTutorial();
  }

  return (
    <ModalDaTela titulo={primeiroNome ? `Boas-vindas, ${primeiroNome}` : "Boas-vindas ao Ledgr"} aoFechar={() => fechar(false)} classe="bv">
      <div className="bv-corpo">
        <Image src="/mascotes/mascote-bandeira.webp" alt="" width={1000} height={1000} className="bv-mascote" priority />
        <p>Em poucos passos o seu mês fica conciliado:</p>
        <ol className="bv-passos">
          {PASSOS.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      </div>
      <div className="adm-botoes">
        <BotaoFecharJanela className="btn btn-ghost" aoFechar={() => fechar(false)}>
          Agora não
        </BotaoFecharJanela>
        <button type="button" className="btn btn-primary" onClick={() => fechar(true)}>
          Começar
        </button>
      </div>
    </ModalDaTela>
  );
}
