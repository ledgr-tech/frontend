import type { LinhaComparacao } from "@/lib/mock-data";
import { estaResolvida } from "../../dashboard/resumo";

/** O lançamento do outro lado que o motor quase casou com a linha, para o cartão mostrar os dois. */
export type ParDoOutroLado = { lado: "banco" | "sistema"; data: string; descricao: string; valor: number };

/**
 * Uma divergência de valor ou de data chega do backend com um lado só: o outro lançamento é outra
 * linha da conciliação. Esta é a mesma escolha que o backend faz para montar o contexto da IA
 * (`app/services/ia/contexto.py`, issue #28): "Valor diverge" = do outro lado, mesma data e valor
 * diferente; "Data diverge" = mesmo valor, outra data; nunca um lançamento que já formou par numa
 * linha que bateu; com mais de um, o mais próximo (em valor ou em dias), desempatado pela data e
 * pela descrição.
 *
 * ponytail: o backend vai mandar o candidato em cada linha junto com a explicação (combinado em
 * 15/10). Quando mandar, o cartão usa o dele e isto sai.
 */
export function parDoOutroLado(linha: LinhaComparacao, linhas: LinhaComparacao[]): ParDoOutroLado | null {
  if (linha.status !== "divergente_valor" && linha.status !== "divergente_data") return null;
  const doBanco = linha.valorBanco !== null && linha.valorSistema === null;
  const doSistema = linha.valorSistema !== null && linha.valorBanco === null;
  if (!doBanco && !doSistema || !linha.dataISO) return null;

  const valor = (doBanco ? linha.valorBanco : linha.valorSistema) as number;
  // a linha do outro lado sozinha (sem o lado desta) e que não bateu: as que bateram já têm par
  const candidatos = linhas.filter((outra) => {
    if (outra === linha || estaResolvida(outra.status) || !outra.dataISO) return false;
    const valorOutro = doBanco ? outra.valorSistema : outra.valorBanco;
    const ladoDesta = doBanco ? outra.valorBanco : outra.valorSistema;
    if (valorOutro === null || ladoDesta !== null) return false;
    return linha.status === "divergente_valor"
      ? outra.dataISO === linha.dataISO && valorOutro !== valor
      : valorOutro === valor && outra.dataISO !== linha.dataISO;
  });
  if (candidatos.length === 0) return null;

  const distancia = (outra: LinhaComparacao) =>
    linha.status === "divergente_valor"
      ? Math.abs(((doBanco ? outra.valorSistema : outra.valorBanco) as number) - valor)
      : Math.abs(Date.parse(outra.dataISO!) - Date.parse(linha.dataISO!));
  const [melhor] = [...candidatos].sort(
    (a, b) =>
      distancia(a) - distancia(b) ||
      a.dataISO!.localeCompare(b.dataISO!) ||
      a.descricao.localeCompare(b.descricao),
  );
  return doBanco
    ? { lado: "sistema", data: melhor.dataSistema ?? melhor.data, descricao: melhor.descricaoSistema ?? melhor.descricao, valor: melhor.valorSistema as number }
    : { lado: "banco", data: melhor.data, descricao: melhor.descricao, valor: melhor.valorBanco as number };
}
