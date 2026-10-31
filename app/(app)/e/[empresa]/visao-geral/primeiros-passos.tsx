"use client";

import { useState, type ReactNode } from "react";
import Link from "@/lib/link-do-app";
import { ArrowRight } from "lucide-react";
import type { RegrasDaEmpresa } from "../conciliacoes/acoes";
import { ToleranciaEditavel } from "../configuracoes";
import { useAssinatura, usePreferencias } from "../conta";
import type { PassoDoRoteiro } from "./roteiro";

/**
 * Os primeiros passos sem lista (modelo G do artefato de 30/10): cada bloco da Visão geral diz o
 * passo que acontece nele, e só uma contagem no cabeçalho lembra o caminho. Tudo some com "Já sei
 * usar", que é preferência do navegador e da conta, por isso aqui e não no servidor.
 */
function usePassos(todos: PassoDoRoteiro[] | null): PassoDoRoteiro[] | null {
  const { carregado, roteiroDispensado } = usePreferencias();
  // sem a situação da conta no /me (o backend de hoje), não há teste começado para mostrar
  const assinatura = useAssinatura();
  if (!todos || !carregado || roteiroDispensado) return null;
  return assinatura ? todos : todos.filter((passo) => passo.id !== "plano");
}

/** O passo de agora, se for `id`, com o número dele na conta. */
function useProximo(todos: PassoDoRoteiro[] | null, id: PassoDoRoteiro["id"]) {
  const passos = usePassos(todos);
  const proximo = passos?.find((passo) => !passo.feito);
  return passos && proximo?.id === id ? { passo: proximo, numero: passos.indexOf(proximo) + 1, total: passos.length } : null;
}

export function ContagemDosPassos({ passos: todos }: { passos: PassoDoRoteiro[] | null }) {
  const passos = usePassos(todos);
  const { dispensarRoteiro } = usePreferencias();
  if (!passos) return null;
  const feitos = passos.filter((passo) => passo.feito).length;
  if (feitos === passos.length) return null;
  return (
    <div className="pp-contagem" data-tutorial="primeiros-passos">
      <span>{`Primeiros passos ${feitos} de ${passos.length}`}</span>
      <span
        className="pp-tracos"
        role="progressbar"
        aria-label="Primeiros passos feitos"
        aria-valuemin={0}
        aria-valuemax={passos.length}
        aria-valuenow={feitos}
      >
        {passos.map((passo) => (
          <i key={passo.id} data-feito={passo.feito || undefined} />
        ))}
      </span>
      <button type="button" className="btn btn-ghost" onClick={dispensarRoteiro}>
        Já sei usar
      </button>
    </div>
  );
}

/** "Próximo passo · 3 de 6", no topo do bloco onde o passo de agora acontece. */
export function EtiquetaDoPasso({ passos, id }: { passos: PassoDoRoteiro[] | null; id: PassoDoRoteiro["id"] }) {
  const agora = useProximo(passos, id);
  return agora && <span className="pp-proximo">{`Próximo passo · ${agora.numero} de ${agora.total}`}</span>;
}

const ROTULO: Partial<Record<PassoDoRoteiro["id"], string>> = {
  divergencias: "Resolver as divergências",
  fechar: "Fechar o mês",
};

/** O botão do passo de agora, quando ele é `id` e leva a outra tela. */
export function AcaoDoPasso({ passos, id }: { passos: PassoDoRoteiro[] | null; id: PassoDoRoteiro["id"] }) {
  const agora = useProximo(passos, id);
  if (agora?.passo.destino?.tipo !== "link") return null;
  return (
    <Link href={agora.passo.destino.href} className="btn btn-primary">
      {ROTULO[id] ?? agora.passo.titulo}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

/**
 * A coluna ao lado do estado do mês. Enquanto a tolerância nunca foi confirmada, ela pergunta ali
 * mesmo ("Usar 2 dias" grava o padrão); confirmada ou dispensada, volta a ser `children` (a
 * conexão), e sem nada a coluna some.
 */
export function LadoDaTolerancia({
  passos,
  regras: iniciais,
  children,
}: {
  passos: PassoDoRoteiro[] | null;
  regras: RegrasDaEmpresa;
  children?: ReactNode;
}) {
  const visiveis = usePassos(passos);
  // o bloco guarda o que salvou: o refresh que relê a Visão geral chega um pouco depois
  const [regras, setRegras] = useState(iniciais);
  const pergunta = visiveis?.find((passo) => passo.id === "tolerancia")?.feito === false;
  if (!pergunta) return children ? <div className="vg-blocos-lado">{children}</div> : null;
  return (
    <div className="vg-blocos-lado">
      <section className="vg-bloco pp-bloco" aria-labelledby="pp-tolerancia-titulo" data-tutorial="tolerancia">
        <EtiquetaDoPasso passos={passos} id="tolerancia" />
        <h2 id="pp-tolerancia-titulo" className="pp-bloco-titulo">
          Quantos dias de diferença ainda contam como bateu?
        </h2>
        <p className="vg-nota">
          O banco às vezes registra um pagamento um ou dois dias depois do seu sistema. Dá para mudar
          depois em Configurações.
        </p>
        <ToleranciaEditavel regras={regras} onSalvas={setRegras} />
      </section>
    </div>
  );
}
