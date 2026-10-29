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
    <div>
      <Cabecalho titulo="Importar via IA" sobretitulo="Nova conciliação · relatório de lançamentos" />
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
