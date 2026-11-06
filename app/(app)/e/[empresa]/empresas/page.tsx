import Link from "@/lib/link-do-app";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { TelaDeAviso } from "@/app/tela-de-aviso";
import { Cabecalho } from "../cabecalho";
import { FalhaAoCarregar } from "../falha-ao-carregar";
import { carregarEmpresas } from "./acoes";
import { PainelDeEmpresas } from "./painel-de-empresas";

/**
 * As empresas clientes e a equipe da conta (backend #133, spec 2026-10-22-empresas-na-configuracao): duas
 * abas, a lista, o cadastro e o convite, e o quanto do plano a conta já usa. É uma tela do menu, como
 * Extratos: carrega as empresas no servidor e entrega ao painel, que cuida do que a pessoa faz nela
 * (a equipe ele mesmo carrega). `?aba=equipe` abre na Equipe: o painel lê a aba da URL do navegador, para o voltar não mostrar uma aba e a URL outra.
 */

export default async function EmpresasPage() {
  const resposta = await carregarEmpresas();
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");
  // o painel leva o próprio cabeçalho: o botão da aba abre o formulário que ele mostra
  if (resposta.ok) return <PainelDeEmpresas empresas={resposta.dados} />;

  return (
    <div>
      <Cabecalho titulo="Empresas" />
      {resposta.status === 404 ? (
        <TelaDeAviso
          titulo="As empresas ainda não estão disponíveis."
          texto="Esta parte do Ledgr ainda não está ligada. Nenhuma ação sua é necessária."
          nivel="h2"
        >
          <Link href="/visao-geral" className="btn btn-secondary">
            Ir para a visão geral
          </Link>
        </TelaDeAviso>
      ) : (
        <FalhaAoCarregar oQue="as empresas" status={resposta.status} />
      )}
    </div>
  );
}
