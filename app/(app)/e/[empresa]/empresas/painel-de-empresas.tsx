"use client";

import { useId, useState } from "react";
import type { EmpresaCliente } from "@/lib/adaptadores";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import LinkDoApp from "@/lib/link-do-app";
import { situacaoDoLimite, textoDoLimite } from "@/lib/limites";
import { comEmpresa } from "@/lib/rotas";
import { useRoteador } from "@/lib/roteador";
import { formatarCnpj } from "../../../../(auth)/cadastro/passos";
import { Cabecalho } from "../cabecalho";
import { useLimites, usePapel } from "../conta";
import { formatarDataHora } from "../dashboard/resumo";
import { CadastrarEmpresa } from "./cadastrar-empresa";

/**
 * A tela Empresas (spec 2026-10-22-empresas-na-configuracao): a faixa do plano, a tabela das empresas da
 * conta e o cadastro de uma nova, num painel que o botão do cabeçalho abre. Todo mundo vê a lista;
 * admin e gestor cadastram (o backend responde 403 ao analista, então o botão nem aparece).
 */

function contagem(usadas: number, maximo: number | null): string {
  const empresas = usadas === 1 ? "empresa" : "empresas";
  return maximo === null ? `${usadas} ${empresas} do plano` : `${usadas} de ${maximo} ${empresas}`;
}

export function PainelDeEmpresas({ empresas }: { empresas: EmpresaCliente[] }) {
  const router = useRoteador();
  const ativa = useEmpresaAtiva();
  const papel = usePapel();
  const limites = useLimites();
  const [aberto, setAberto] = useState(false);
  const painelId = useId();

  const podeCadastrar = papel !== "analista";
  const limite = limites?.empresas ?? null;
  const situacao = limite ? situacaoDoLimite(limite) : null;
  const noLimite = situacao === "no-limite";
  const aviso = limite ? textoDoLimite("empresas", limite) : null;

  function abrir(empresa: EmpresaCliente) {
    gravarEmpresaRecente(empresa.id);
    // daqui não há "a mesma tela" na outra empresa: vai à Visão geral dela
    router.push(comEmpresa(empresa.id, "/visao-geral"));
  }

  return (
    <div>
      <Cabecalho
        titulo="Empresas"
        contexto={[`${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`]}
        acoes={
          podeCadastrar ? (
            <button
              type="button"
              className="btn btn-primary"
              aria-expanded={aberto}
              aria-controls={aberto ? painelId : undefined}
              disabled={noLimite}
              onClick={() => setAberto((atual) => !atual)}
            >
              Adicionar empresa
            </button>
          ) : undefined
        }
      />

      {!podeCadastrar && <p className="empresas-nota">Só o admin e o gestor cadastram empresas.</p>}

      {limite && (
        <div className="empresas-plano">
          <strong>{contagem(limite.usadas, limite.maximo)}</strong>
          {aviso && <span>{aviso}</span>}
          {(situacao === "no-limite" || situacao === "acima") && (
            <LinkDoApp href="/assinatura" className="btn btn-secondary">
              Ver planos
            </LinkDoApp>
          )}
        </div>
      )}

      {aberto && podeCadastrar && !noLimite && (
        <section id={painelId} className="empresas-cadastro">
          <p className="empresas-cadastro-texto">Cadastre uma empresa cliente pelo CNPJ. Ela entra na conta e você passa a trabalhar nela.</p>
          <CadastrarEmpresa noLimite={noLimite} aoCadastrar={() => setAberto(false)} />
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
  );
}
