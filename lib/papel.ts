/**
 * Os três papéis da conta (backend #133, ADR 19; decisões de 21/10): o admin cuida do plano e da equipe,
 * o gestor convida analistas, aprova justificativas e fecha o mês, o analista concilia e justifica.
 * Justificar é de todos; fechar e reabrir o mês, do admin e do gestor. O backend garante cada regra
 * (403); a tela só esconde o que ele recusaria.
 */
export type Papel = "admin" | "gestor" | "analista";

export const ROTULO_DO_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  analista: "Analista",
};

export function ehPapel(valor: unknown): valor is Papel {
  // hasOwn, não `in`: "toString" e companhia vêm do protótipo e não são papel
  return typeof valor === "string" && Object.hasOwn(ROTULO_DO_PAPEL, valor);
}

/**
 * O papel de quem o backend descreve (`GET /me`, `GET /empresa/usuarios`): o campo `papel`; sem ele, o
 * `administrador` do backend anterior ao #133 (falso vira analista); sem nenhum dos dois, admin, como
 * a conta única antiga. O `administrador` é obsoleto: sai quando o backend souber que paramos de ler.
 */
export function lerPapel(bruto: { papel?: unknown; administrador?: unknown }): Papel {
  if (ehPapel(bruto.papel)) return bruto.papel;
  return bruto.administrador === false ? "analista" : "admin";
}

/** Fechar e reabrir o mês (e aprovar justificativas, quando a aprovação chegar): admin e gestor. */
export function podeFecharMes(papel: Papel): boolean {
  return papel !== "analista";
}

/** Convidar pessoas: admin e gestor. */
export function podeConvidar(papel: Papel): boolean {
  return papel !== "analista";
}

/** Os papéis que cada um pode dar num convite: o admin convida gestor ou analista; o gestor, só analista. */
export function papeisQueConvida(papel: Papel): Papel[] {
  if (papel === "admin") return ["gestor", "analista"];
  return papel === "gestor" ? ["analista"] : [];
}
