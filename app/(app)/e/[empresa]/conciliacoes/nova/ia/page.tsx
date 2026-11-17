import LinkDoApp from "@/lib/link-do-app";
import { TransicaoEntrePaginas } from "../../../../../../transicao-de-tela";
import { Cabecalho } from "../../../cabecalho";
import { carregarPromptIa } from "./acoes";
import { ImportarViaIa } from "./importar-via-ia";

/**
 * Importar o relatório de lançamentos via IA (#224): o PDF do sistema de gestão cada hora vem num layout,
 * então o Ledgr dá o prompt e quem importa usa a IA que já tem (ChatGPT, Claude…). O Ledgr só recebe o JSON.
 * Extrato do banco continua em OFX ou CSV.
 */
export default async function ImportarViaIaPage() {
  const prompt = await carregarPromptIa();
  return (
    <div className="nova-tela">
      {/* chega aqui por página inteira (#260): a transição do navegador também precisa ser pedida deste lado */}
      <TransicaoEntrePaginas />
      <Cabecalho
        titulo="Importar via IA"
        contexto={["relatório de lançamentos"]}
        acoes={
          <LinkDoApp href="/conciliacoes/nova" className="nova-link nova-voltar">
            Voltar para Nova conciliação
          </LinkDoApp>
        }
      />
      {prompt.ok ? (
        <ImportarViaIa prompt={prompt.dados} />
      ) : (
        <p role={prompt.status === 404 ? undefined : "alert"} style={{ padding: "48px 0" }}>
          {prompt.status === 404 ? "A importação via IA ainda não está disponível." : prompt.erro}
        </p>
      )}
    </div>
  );
}
