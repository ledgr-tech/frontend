import Link from "next/link";
import { redirect } from "next/navigation";
import { EMPRESA_MOCK } from "@/lib/mock-data";
import { listarExtratos } from "../conciliacoes/acoes";
import { formatarInteiro } from "../dashboard/resumo";
import { Galeria } from "./galeria";

/**
 * "Extratos carregados" do design, com o que o backend sabe hoje: os arquivos
 * que entraram em alguma conciliação, cada um com a situação da leitura e as
 * linhas que o parser não conseguiu ler.
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
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Extratos carregados</h1>
          {resposta.ok && (
            <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: cinza(55) }}>
              {formatarInteiro(resposta.dados.length)}{" "}
              {resposta.dados.length === 1 ? "arquivo" : "arquivos"} · {EMPRESA_MOCK}
            </span>
          )}
        </div>
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Carregar arquivo
        </Link>
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : resposta.dados.length === 0 ? (
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
          <Galeria arquivos={resposta.dados} />
          {/* ponytail: o backend não lista extratos, então a lista sai das
              conciliações (ver `extratosDasExecucoes`). Some com `GET /extratos`. */}
          <p style={{ margin: 0, fontSize: 13.5, color: cinza(62) }}>
            Aparecem aqui os arquivos que já entraram numa conciliação.
          </p>
        </div>
      )}
    </div>
  );
}
