import type { LinhaComparacao } from "@/lib/mock-data";
import { statusDaLinha } from "../../dashboard/resumo";

export type Coluna = "data" | "descricao" | "valorBanco" | "valorSistema" | "status";

export type Ordem = { coluna: Coluna; crescente: boolean };

/**
 * As datas do mock vêm como "DD/MM", sem ano, porque uma conciliação é de uma
 * competência só. Vira MMDD para comparar — quando houver ano de verdade isto
 * passa a ser uma data e a função não muda de forma.
 */
function dataComparavel(data: string): number {
  const [dia, mes] = data.split("/").map((parte) => Number.parseInt(parte, 10));
  if (Number.isNaN(dia) || Number.isNaN(mes)) return 0;
  return mes * 100 + dia;
}

function valorDe(linha: LinhaComparacao, coluna: Coluna): number | string | null {
  if (coluna === "data") return dataComparavel(linha.data);
  if (coluna === "descricao") return linha.descricao.toLowerCase();
  if (coluna === "status") return statusDaLinha(linha.status).rotulo.toLowerCase();
  return coluna === "valorBanco" ? linha.valorBanco : linha.valorSistema;
}

/**
 * Ordena por uma coluna sem mutar a lista recebida.
 *
 * Linha sem valor no lado escolhido vai para o fim nas duas direções: inverter a
 * ordem não deveria encher a primeira página de travessões.
 */
export function ordenarLinhas(
  linhas: LinhaComparacao[],
  { coluna, crescente }: Ordem,
): LinhaComparacao[] {
  const sinal = crescente ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const x = valorDe(a, coluna);
    const y = valorDe(b, coluna);

    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;

    if (typeof x === "string" && typeof y === "string") {
      return x.localeCompare(y, "pt-BR") * sinal;
    }
    return ((x as number) - (y as number)) * sinal;
  });
}

/** O filtro "só revisão" do design: esconde o que já bateu. */
export function filtrarLinhas(
  linhas: LinhaComparacao[],
  filtro: "todos" | "revisao",
): LinhaComparacao[] {
  return filtro === "revisao" ? linhas.filter((linha) => linha.status !== "batido") : linhas;
}
