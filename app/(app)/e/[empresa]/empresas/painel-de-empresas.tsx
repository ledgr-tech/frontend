"use client";

import { useSearchParams } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { EmpresaCliente } from "@/lib/adaptadores";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import { situacaoDoLimite, textoDoLimite } from "@/lib/limites";
import { podeConvidar } from "@/lib/papel";
import { comEmpresa } from "@/lib/rotas";
import { useRoteador } from "@/lib/roteador";
import { formatarCnpj } from "../../../../(auth)/cadastro/passos";
import { Cabecalho } from "../cabecalho";
import { useLimites, usePapel } from "../conta";
import { formatarDataHora } from "../dashboard/resumo";
import { CadastrarEmpresa } from "./cadastrar-empresa";
import { FaixaDoPlano } from "./faixa-do-plano";
import { PainelDaEquipe, useEquipe } from "./painel-da-equipe";

/**
 * A tela Empresas (spec 2026-10-22-empresas-na-configuracao, revisão de 23/10): duas abas, Empresas e
 * Equipe. Em cada uma, a faixa do plano, a lista e o botão do cabeçalho que abre o formulário (cadastrar
 * empresa, convidar pessoa). Todo mundo vê as duas listas; admin e gestor cadastram e convidam (o
 * backend responde 403 ao analista, então os botões nem aparecem). A equipe carrega junto com a tela,
 * para o número da aba e a troca serem imediatos; a aba escolhida vai em `?aba=equipe`.
 */

export type AbaDaTela = "empresas" | "equipe";
const ABAS: AbaDaTela[] = ["empresas", "equipe"];

function contagem(usadas: number, maximo: number | null): string {
  const empresas = usadas === 1 ? "empresa" : "empresas";
  return maximo === null ? `${usadas} ${empresas}` : `${usadas} de ${maximo} ${empresas}`;
}

export function PainelDeEmpresas({ empresas }: { empresas: EmpresaCliente[] }) {
  const router = useRoteador();
  const ativa = useEmpresaAtiva();
  const papel = usePapel();
  const limites = useLimites();
  const equipe = useEquipe();
  // a aba nasce da URL do navegador, não da página renderizada no servidor: trocar de aba só troca a URL
  // (`replaceState`), e o voltar do navegador devolve a tela do cache com a URL de agora
  const busca = useSearchParams();
  const [aba, setAba] = useState<AbaDaTela>(busca.get("aba") === "equipe" ? "equipe" : "empresas");
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [conviteAberto, setConviteAberto] = useState(false);
  const base = useId();
  const refsDasAbas = useRef<Record<AbaDaTela, HTMLButtonElement | null>>({ empresas: null, equipe: null });

  const gerencia = podeConvidar(papel);
  const limite = limites?.empresas ?? null;
  const situacao = limite ? situacaoDoLimite(limite) : null;
  // acima do limite (um downgrade) também não dá para adicionar, como a frase da faixa diz
  const noLimite = situacao === "no-limite" || situacao === "acima";
  const pessoas = typeof equipe.estado === "object" ? equipe.estado.pessoas.length : null;

  function trocarDeAba(nova: AbaDaTela) {
    setAba(nova);
    // a URL acompanha, sem recarregar a tela: dá para mandar o link da aba e o voltar não se perde
    window.history.replaceState(window.history.state, "", nova === "equipe" ? "?aba=equipe" : window.location.pathname);
  }

  function aoTeclarNasAbas(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = ABAS.indexOf(aba);
    const destino =
      evento.key === "ArrowRight" ? (atual + 1) % ABAS.length : evento.key === "ArrowLeft" ? (atual - 1 + ABAS.length) % ABAS.length : evento.key === "Home" ? 0 : evento.key === "End" ? ABAS.length - 1 : null;
    if (destino === null) return;
    evento.preventDefault();
    trocarDeAba(ABAS[destino]);
    refsDasAbas.current[ABAS[destino]]?.focus();
  }

  function abrir(empresa: EmpresaCliente) {
    gravarEmpresaRecente(empresa.id);
    // daqui não há "a mesma tela" na outra empresa: vai à Visão geral dela
    router.push(comEmpresa(empresa.id, "/visao-geral"));
  }

  const idAba = (a: AbaDaTela) => `${base}-aba-${a}`;
  const idPainel = (a: AbaDaTela) => `${base}-painel-${a}`;

  const acao =
    aba === "empresas" ? (
      gerencia ? (
        <button
          type="button"
          className="btn btn-primary"
          aria-expanded={cadastroAberto}
          aria-controls={cadastroAberto ? `${base}-cadastro` : undefined}
          disabled={noLimite}
          onClick={() => setCadastroAberto((atual) => !atual)}
        >
          Adicionar empresa
        </button>
      ) : undefined
    ) : gerencia ? (
      <button
        type="button"
        className="btn btn-primary"
        aria-expanded={conviteAberto}
        onClick={() => setConviteAberto((atual) => !atual)}
      >
        Convidar pessoa
      </button>
    ) : undefined;

  return (
    <div>
      <Cabecalho titulo="Empresas" contexto={[`${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`]} acoes={acao} />

      <div className="empresas-abas" role="tablist" aria-label="Empresas e equipe" onKeyDown={aoTeclarNasAbas}>
        {ABAS.map((a) => (
          <button
            key={a}
            ref={(no) => {
              refsDasAbas.current[a] = no;
            }}
            type="button"
            role="tab"
            id={idAba(a)}
            aria-selected={aba === a}
            aria-controls={idPainel(a)}
            tabIndex={aba === a ? 0 : -1}
            className="empresas-aba"
            onClick={() => trocarDeAba(a)}
          >
            {a === "empresas" ? "Empresas" : "Equipe"}
            {(a === "empresas" ? empresas.length : pessoas) !== null && (
              <>
                {" "}
                <em>{a === "empresas" ? empresas.length : pessoas}</em>
              </>
            )}
          </button>
        ))}
      </div>

      {/* os dois painéis ficam no DOM (o aria-controls das abas aponta para um painel que existe) e o da aba inativa fica escondido: o que foi digitado numa aba sobrevive à troca */}
      <div role="tabpanel" id={idPainel("empresas")} aria-labelledby={idAba("empresas")} hidden={aba !== "empresas"}>
          {!gerencia && <p className="empresas-nota">Só o admin e o gestor cadastram empresas.</p>}

          {limite && (
            <FaixaDoPlano
              contagem={limite.maximo === null ? `${contagem(limite.usadas, null)} do plano` : contagem(limite.usadas, limite.maximo)}
              usadas={limite.usadas}
              maximo={limite.maximo}
              aviso={textoDoLimite("empresas", limite)}
              verPlanos={noLimite}
            />
          )}

          {/* sem `!noLimite`: o 402 de uma aba com contador velho relê a página e leva a conta ao limite; o formulário aberto fica, com a mensagem e o foco, e só o envio se desliga */}
          {cadastroAberto && gerencia && (
            <section id={`${base}-cadastro`} className="empresas-cadastro">
              <p className="empresas-cadastro-texto">Cadastre uma empresa cliente pelo CNPJ. Ela entra na conta e você passa a trabalhar nela.</p>
              <CadastrarEmpresa noLimite={noLimite} aoCadastrar={() => setCadastroAberto(false)} />
            </section>
          )}

          <div className="empresas-tabela">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">CNPJ</th>
                  <th scope="col">Cadastrada em</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr key={empresa.id}>
                    <td>
                      <span className="empresas-celula">
                        <span className="empresas-nome">{empresa.razaoSocial}</span>
                        {empresa.id === ativa?.id && <span className="tag">Ativa</span>}
                      </span>
                    </td>
                    <td>
                      <span className="empresas-celula">
                        <span>{formatarCnpj(empresa.cnpj)}</span>
                        {empresa.cnpjVerificado && <span className="tag tag-outline">CNPJ verificado</span>}
                      </span>
                    </td>
                    {/* só o dia: os dez primeiros caracteres de "dd/mm/aaaa hh:mm", no fuso de Brasília */}
                    <td>{formatarDataHora(empresa.criadaEm).slice(0, 10)}</td>
                    <td className="empresas-acao">
                      {empresa.id !== ativa?.id && (
                        <button type="button" className="btn btn-secondary" aria-label={`Abrir ${empresa.razaoSocial}`} onClick={() => abrir(empresa)}>
                          Abrir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      <div role="tabpanel" id={idPainel("equipe")} aria-labelledby={idAba("equipe")} hidden={aba !== "equipe"}>
          <PainelDaEquipe
            estado={equipe.estado}
            recarregar={equipe.recarregar}
            aplicar={equipe.aplicar}
            conviteAberto={conviteAberto}
            aoFecharConvite={() => setConviteAberto(false)}
          />
        </div>
    </div>
  );
}
