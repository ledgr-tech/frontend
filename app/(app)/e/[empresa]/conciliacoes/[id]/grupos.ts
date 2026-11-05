import { formatarMoeda, type LinhaComparacao } from "@/lib/mock-data";

type Grupo = NonNullable<LinhaComparacao["grupo"]>;

/** A ponta única do lote: o lançamento cujo lado tem 1 no grupo (backend #131). */
function ehPontaUnica(linha: LinhaComparacao): boolean {
  if (!linha.grupo) return false;
  const doLado = linha.valorBanco !== null ? linha.grupo.quantidadeBanco : linha.grupo.quantidadeSistema;
  return doLado === 1;
}

/**
 * Os membros de cada grupo juntos, na posição do primeiro deles na ordem recebida, com a ponta
 * única primeiro. As linhas sem grupo ficam onde estavam.
 * shortcut: membros do grupo só das linhas carregadas; com truncada, buscar ?grupo_id= no backend
 */
export function juntarGrupos(linhas: LinhaComparacao[]): LinhaComparacao[] {
  const membros = new Map<string, LinhaComparacao[]>();
  for (const linha of linhas) {
    if (linha.grupoId) membros.set(linha.grupoId, [...(membros.get(linha.grupoId) ?? []), linha]);
  }
  if (membros.size === 0) return linhas;
  const resultado: LinhaComparacao[] = [];
  for (const linha of linhas) {
    if (!linha.grupoId) {
      resultado.push(linha);
      continue;
    }
    const grupo = membros.get(linha.grupoId);
    if (!grupo) continue; // já entrou junto com o primeiro membro
    membros.delete(linha.grupoId);
    resultado.push(...grupo.filter(ehPontaUnica), ...grupo.filter((membro) => !ehPontaUnica(membro)));
  }
  return resultado;
}

/** "1 lançamento do banco de R$ 150.000,00 = 10 do sistema", com os dias de diferença quando há. */
export function cabecalhoDoGrupo(grupo: Grupo): string {
  const doBanco = grupo.quantidadeBanco === 1;
  const lado = doBanco ? "banco" : "sistema";
  const outro = doBanco ? "sistema" : "banco";
  const quantos = doBanco ? grupo.quantidadeSistema : grupo.quantidadeBanco;
  const texto = `1 lançamento do ${lado} de ${formatarMoeda(Math.abs(grupo.valorUnico))} = ${quantos} do ${outro}`;
  const dias = grupo.maiorDesvioDias;
  return dias > 0 ? `${texto} · até ${dias} ${dias === 1 ? "dia" : "dias"} de diferença` : texto;
}
