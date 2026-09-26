import type { Divergencia } from "@/lib/adaptadores";
import type { LinhaComparacao } from "@/lib/mock-data";
import { estaResolvida, statusDaLinha } from "../../dashboard/resumo";

export type Coluna = "data" | "descricao" | "valorBanco" | "valorSistema" | "status";

export type Ordem = { coluna: Coluna; crescente: boolean };

/**
 * Chave de ordenação por data.
 *
 * Do backend vem a data completa, e aí a chave é AAAAMMDD — um extrato que
 * cruza dezembro/janeiro ordena certo. O mock só tem "DD/MM" (uma conciliação é
 * de uma competência só) e cai em MMDD. As duas escalas nunca se misturam numa
 * mesma lista: ou as linhas vieram todas do backend, ou todas do mock.
 */
function dataComparavel(linha: LinhaComparacao): number {
  if (linha.dataISO) return Number(linha.dataISO.replaceAll("-", ""));
  const [dia, mes] = linha.data.split("/").map((parte) => Number.parseInt(parte, 10));
  if (Number.isNaN(dia) || Number.isNaN(mes)) return 0;
  return mes * 100 + dia;
}

function valorDe(linha: LinhaComparacao, coluna: Coluna): number | string | null {
  if (coluna === "data") return dataComparavel(linha);
  if (coluna === "descricao") return linha.descricao.toLowerCase();
  if (coluna === "status") return statusDaLinha(linha).rotulo.toLowerCase();
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

/** Todas, só as que pedem revisão (o "só revisão" do design), ou uma categoria do relatório. */
export type Filtro = "todos" | "revisao" | Divergencia;

export function filtrarLinhas(linhas: LinhaComparacao[], filtro: Filtro): LinhaComparacao[] {
  if (filtro === "todos") return linhas;
  if (filtro === "revisao") return linhas.filter((linha) => !estaResolvida(linha.status));
  return linhas.filter((linha) => linha.status === filtro);
}
