import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { listarExtratos } from "../conciliacoes/acoes";
import { formatarInteiro } from "../dashboard/resumo";
import { Reveal } from "@/app/reveal";
import { Galeria } from "./galeria";
import { Cabecalho } from "../cabecalho";
import { FalhaAoCarregar } from "../falha-ao-carregar";
import { SemNada } from "../sem-nada";

/**
 * "Extratos carregados" do design, com o que o backend sabe hoje: todos os
 * arquivos enviados (`GET /extratos`), cada um com a situação da leitura, as
 * linhas que o parser não conseguiu ler e, se já entrou numa, a conciliação.
 */

const cinza = (opacidade: number) =>
  `color-mix(in srgb, var(--color-text) ${opacidade}%, transparent)`;

export default async function ExtratosPage() {
  const resposta = await listarExtratos();
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");

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
        <FalhaAoCarregar oQue="os extratos" status={resposta.status} />
      ) : resposta.dados.arquivos.length === 0 ? (
        <SemNada titulo="Nenhum extrato enviado ainda." texto="Envie o extrato do banco e o extrato do sistema. A primeira conciliação fica pronta em poucos minutos." />
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
