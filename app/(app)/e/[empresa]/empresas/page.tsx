import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { Cabecalho } from "../cabecalho";
import { carregarEmpresas } from "./acoes";
import { PainelDeEmpresas } from "./painel-de-empresas";

/**
 * As empresas clientes da conta (backend #133, spec 2026-10-22-empresas-na-configuracao): a lista, o
 * cadastro de uma nova e o quanto do plano a conta já usa. É uma tela do menu, como Extratos: carrega
 * no servidor e entrega ao painel, que cuida do que a pessoa faz nela.
 */

const FALHA_AO_CARREGAR = "Não foi possível carregar as empresas. Recarregue a página e tente de novo.";
const SEM_A_ROTA = "As empresas ainda não estão disponíveis.";

export default async function EmpresasPage() {
  const resposta = await carregarEmpresas();
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");
  // o painel leva o próprio cabeçalho: o botão de adicionar abre o formulário que ele mostra
  if (resposta.ok) return <PainelDeEmpresas empresas={resposta.dados} />;

  return (
    <div>
      <Cabecalho titulo="Empresas" />
      <p role={resposta.status === 404 ? undefined : "alert"} style={{ padding: "48px 0" }}>
        {resposta.status === 404 ? SEM_A_ROTA : FALHA_AO_CARREGAR}
      </p>
    </div>
  );
}
