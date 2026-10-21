import Link from "next/link";
import { redirect } from "next/navigation";
import { listarExtratos } from "../conciliacoes/acoes";
import { formatarInteiro } from "../dashboard/resumo";
import { Reveal } from "@/app/reveal";
import { Galeria } from "./galeria";
import { Cabecalho } from "../cabecalho";

/**
 * "Extratos carregados" do design, com o que o backend sabe hoje: todos os
 * arquivos enviados (`GET /extratos`), cada um com a situação da leitura, as
 * linhas que o parser não conseguiu ler e, se já entrou numa, a conciliação.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar os extratos. Recarregue a página e tente de novo.";

const cinza = (opacidade: number) =>
  `color-mix(in srgb, var(--color-text) ${opacidade}%, transparent)`;

export default async function ExtratosPage() {
  const resposta = await listarExtratos();
  if (!resposta.ok && resposta.status === 401) redirect("/login");

  return (
    <div>
      <Cabecalho
        titulo="Extratos"
        contexto={[
          resposta.ok &&
            `${formatarInteiro(resposta.dados.total)} ${resposta.dados.total === 1 ? "arquivo" : "arquivos"}`,
        ]}
      />

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : resposta.dados.arquivos.length === 0 ? (
        <div
          style={{
            padding: "76px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Nenhum extrato carregado ainda.</h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, maxWidth: "48ch", color: cinza(78) }}>
            Suba o extrato do banco e o extrato do sistema de gestão. A primeira conciliação fica
            pronta em poucos minutos.
          </p>
          <Link href="/conciliacoes/nova" className="btn btn-primary">
            Fazer o primeiro upload
          </Link>
        </div>
      ) : (
        <div style={{ padding: "28px 0 56px", display: "flex", flexDirection: "column", gap: 20 }}>
          <Reveal>
            <Galeria arquivos={resposta.dados.arquivos} />
          </Reveal>
          {/* a lista para no teto de páginas da action: diz que há mais que os da tela */}
          {resposta.dados.arquivos.length < resposta.dados.total && (
            <p style={{ margin: 0, fontSize: 13.5, color: cinza(62) }}>
              Aparecem os {formatarInteiro(resposta.dados.arquivos.length)} arquivos enviados por último, de{" "}
              {formatarInteiro(resposta.dados.total)}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
