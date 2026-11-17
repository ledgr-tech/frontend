"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { abrirTutorial } from "@/lib/eventos";
import { ModalDaTela, BotaoFecharJanela } from "../empresas/modal-da-tela";
import { useNome, usePreferencias } from "../conta";

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
  const { carregado, boasVindasVista, marcarBoasVindasVista, dispensarTutorial } = usePreferencias();
  const primeiroNome = useNome().trim().split(/\s+/)[0];

  useEffect(() => {
    if (demonstracao && carregado && !boasVindasVista) marcarBoasVindasVista();
  }, [demonstracao, carregado, boasVindasVista, marcarBoasVindasVista]);

  if (demonstracao || !carregado || boasVindasVista) return null;

  function fechar(comecar: boolean) {
    // antes de marcar: o tutorial acorda ao marcar e não pode abrir sozinho por cima
    dispensarTutorial("visao-geral");
    marcarBoasVindasVista();
    if (comecar) abrirTutorial();
  }

  return (
    // o molde da comemoração da assinatura (#300), sem o confete: rótulo com filete até o X, título e mascote
    <ModalDaTela titulo="Boas-vindas" aoFechar={() => fechar(false)} classe="comemoracao">
      <BotaoFecharJanela aoFechar={() => fechar(false)} className="comemoracao-fechar" aria-label="Fechar">
        <X size={18} aria-hidden="true" />
      </BotaoFecharJanela>
      <div className="comemoracao-topo">
        <div className="comemoracao-chamada">
          <h2 className="comemoracao-titulo">{primeiroNome ? `Boas-vindas, ${primeiroNome}` : "Boas-vindas ao Ledgr"}</h2>
          <p className="comemoracao-texto">Em poucos passos o seu mês fica conciliado.</p>
        </div>
        <Image src="/mascotes/mascote-bandeira.webp" alt="" width={1000} height={1000} sizes="132px" className="comemoracao-medalha bv-mascote" priority />
      </div>
      <section className="comemoracao-libera" aria-labelledby="bv-passos">
        <h3 id="bv-passos" className="comemoracao-libera-titulo">
          Seus primeiros passos
        </h3>
        <ol className="bv-passos">
          {PASSOS.map((passo, i) => (
            <li key={passo}>
              <span className="bv-numero font-titulo" aria-hidden="true">
                {i + 1}
              </span>
              <span>{passo}</span>
            </li>
          ))}
        </ol>
      </section>
      {/* a principal primeiro no HTML: empilhadas no celular, a ordem do foco é a da tela (o CSS a leva à direita na linha) */}
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={() => fechar(true)}>
          Começar
        </button>
        <BotaoFecharJanela className="btn btn-secondary" aoFechar={() => fechar(false)}>
          Agora não
        </BotaoFecharJanela>
      </div>
    </ModalDaTela>
  );
}
