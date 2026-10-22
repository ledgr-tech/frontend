/**
 * Os limites do plano (`limites` do `GET /me`, backend #133): quantas empresas e quantas pessoas a conta
 * já usa e o máximo do plano. `maximo` nulo é sem limite. Só regras puras: as telas decidem o que mostrar
 * com elas (spec 2026-10-22-empresas-na-configuracao).
 */
export type Limite = { usadas: number; maximo: number | null };
export type LimitesDaConta = { empresas: Limite | null; usuarios: Limite | null };
export type SituacaoDoLimite = "livre" | "folga" | "perto" | "no-limite" | "acima";

function lerLimite(bruto: unknown, campoUsadas: "usadas" | "usados"): Limite | null {
  if (!bruto || typeof bruto !== "object") return null;
  const { maximo, [campoUsadas]: usadas } = bruto as Record<string, unknown>;
  const contagem = (valor: unknown): valor is number => typeof valor === "number" && Number.isInteger(valor) && valor >= 0;
  if (!contagem(usadas) || !(maximo === null || contagem(maximo))) return null;
  return { usadas, maximo };
}

/** Null sem o campo ou sem nenhum dos dois válido: um backend anterior ao #133 não mostra aviso algum. */
export function adaptarLimites(bruto: unknown): LimitesDaConta | null {
  if (!bruto || typeof bruto !== "object") return null;
  const { empresas, usuarios } = bruto as Record<string, unknown>;
  // o backend chama de `usados` as pessoas e de `usadas` as empresas; aqui o tipo é um só
  const limites = { empresas: lerLimite(empresas, "usadas"), usuarios: lerLimite(usuarios, "usados") };
  return limites.empresas || limites.usuarios ? limites : null;
}

export function situacaoDoLimite({ usadas, maximo }: Limite): SituacaoDoLimite {
  if (maximo === null) return "livre";
  if (usadas > maximo) return "acima";
  if (usadas === maximo) return "no-limite";
  const faltam = maximo - usadas;
  return faltam === 1 || usadas / maximo >= 0.8 ? "perto" : "folga";
}

const PALAVRAS = {
  empresas: { um: "empresa", varias: "empresas", maisDe: "mais empresas" },
  usuarios: { um: "pessoa", varias: "pessoas", maisDe: "mais pessoas" },
};

/** A frase do aviso, ou null quando não há o que avisar (sem limite, ou com folga). */
export function textoDoLimite(tipo: "empresas" | "usuarios", limite: Limite): string | null {
  const situacao = situacaoDoLimite(limite);
  const { um, varias, maisDe } = PALAVRAS[tipo];
  const { usadas, maximo } = limite;
  if (situacao === "perto" && maximo !== null) {
    const faltam = maximo - usadas;
    return faltam === 1 ? `Falta 1 ${um} para o limite do plano.` : `Faltam ${faltam} ${varias} para o limite do plano.`;
  }
  if (situacao === "no-limite") {
    return tipo === "empresas"
      ? `O plano chegou ao limite de ${maximo} ${varias}. Para adicionar outra, troque de plano em Assinatura.`
      : `O plano chegou ao limite de ${maximo} ${varias}, contando os convites pendentes. Para convidar mais, troque de plano em Assinatura.`;
  }
  if (situacao === "acima") {
    return tipo === "empresas"
      ? `A conta tem ${maisDe} (${usadas}) do que o plano permite (${maximo}). Nada some; só não dá para adicionar.`
      : `A conta tem ${maisDe} (${usadas}) do que o plano permite (${maximo}). Ninguém perde o acesso; só não dá para convidar.`;
  }
  return null;
}
