import { estaResolvida } from "@/app/(app)/dashboard/resumo";
import type { Execucao } from "./adaptadores";
import type { LinhaComparacao } from "./mock-data";

/**
 * As rodadas de uma conciliação: o mesmo extrato do banco conciliado com versões
 * novas do extrato do sistema (spec 2026-10-02-conciliacao-em-rodadas).
 */

/** A linha em qualquer rodada; o mock não tem chave, e lá o id já é estável. */
export function chaveDaLinha(linha: LinhaComparacao): string {
  return linha.chave ?? linha.id;
}

/** Uma rodada: um extrato do sistema conciliado com o extrato do banco. */
export type Rodada = {
  numero: number;
  extratoSistemaId: string;
  arquivoSistema: string;
  /** A execução que vale para o par: a que o backend marca como atual (ou a mais recente). */
  execucao: Execucao;
};

/**
 * As rodadas de um extrato do banco, da primeira à mais recente. Rodada N é o
 * N-ésimo extrato do sistema conciliado com ele, pela primeira execução de cada um:
 * conciliar o mesmo par de novo refaz a rodada, não cria outra.
 */
export function rodadasDoBanco(execucoes: Execucao[], extratoBancoId: string): Rodada[] {
  const porSistema = new Map<string, { primeira: string; vale: Execucao }>();
  for (const execucao of execucoes) {
    if (execucao.extratoBancoId !== extratoBancoId) continue;
    const visto = porSistema.get(execucao.extratoSistemaId);
    if (!visto) {
      porSistema.set(execucao.extratoSistemaId, { primeira: execucao.executadaEm, vale: execucao });
      continue;
    }
    // ISO ordena como texto
    if (execucao.executadaEm < visto.primeira) visto.primeira = execucao.executadaEm;
    // o `atual` do backend decide; sem ele dos dois lados, vale a mais recente
    const melhor =
      execucao.atual !== visto.vale.atual ? execucao.atual : execucao.executadaEm > visto.vale.executadaEm;
    if (melhor) visto.vale = execucao;
  }
  return [...porSistema.values()]
    .sort((a, b) => a.primeira.localeCompare(b.primeira))
    .map(({ vale }, indice) => ({
      numero: indice + 1,
      extratoSistemaId: vale.extratoSistemaId,
      arquivoSistema: vale.arquivoSistema,
      execucao: vale,
    }));
}

/**
 * As execuções que contam: a atual da rodada mais recente de cada extrato do banco.
 * A primeira versão do extrato do sistema continua `atual` do par dela, e sem isto
 * entraria em dobro nas contagens. Rodada sem a execução atual na lista (a página
 * cortou) fica de fora, como antes. Mantém a ordem recebida.
 */
export function execucoesVigentes(execucoes: Execucao[]): Execucao[] {
  const bancos = new Set(execucoes.map((execucao) => execucao.extratoBancoId));
  const vigentes = new Set(
    [...bancos].flatMap((banco) =>
      rodadasDoBanco(execucoes, banco)
        .slice(-1)
        .filter((rodada) => rodada.execucao.atual)
        .map((rodada) => rodada.execucao.id),
    ),
  );
  return execucoes.filter((execucao) => vigentes.has(execucao.id));
}

/** O que mudou de uma rodada para a seguinte, contado pela chave das linhas. */
export type Mudancas = { passaramABater: number; continuamDivergindo: number; novas: number };

/**
 * Divergente antes e não mais (bateu, ou saiu do extrato do sistema): passou a
 * bater. Divergente nas duas: continua. Divergente agora e não antes: nova.
 */
export function compararRodadas(anterior: LinhaComparacao[], atual: LinhaComparacao[]): Mudancas {
  const divergentes = (linhas: LinhaComparacao[]) =>
    new Set(linhas.filter((linha) => !estaResolvida(linha.status)).map(chaveDaLinha));
  const antes = divergentes(anterior);
  const agora = divergentes(atual);
  const continuam = [...agora].filter((chave) => antes.has(chave)).length;
  return {
    passaramABater: antes.size - continuam,
    continuamDivergindo: continuam,
    novas: agora.size - continuam,
  };
}
