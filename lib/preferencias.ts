/**
 * O que a pessoa dispensou no primeiro uso: os tutoriais marcados com "Não mostrar de novo" e o
 * roteiro fechado com "Já sei usar" (spec 2026-10-15-primeiro-uso). A fonte certa é a conta
 * (`preferencias` do `GET /me`); o navegador é a reserva enquanto o backend não tem a rota, e
 * continua valendo depois, somado a ela.
 */

export const TELAS_DO_TUTORIAL = [
  "visao-geral",
  "conciliacoes",
  "nova-conciliacao",
  "comparacao",
  "divergencia",
  "extratos",
  "historico",
  "fechamentos",
  "configuracoes",
] as const;

export type TelaDoTutorial = (typeof TELAS_DO_TUTORIAL)[number];

export type Preferencias = { tutoriaisDispensados: TelaDoTutorial[]; roteiroDispensado: boolean };

export const PREFERENCIAS_VAZIAS: Preferencias = { tutoriaisDispensados: [], roteiroDispensado: false };

const CHAVE = "ledgr:preferencias";

export function ehTela(valor: unknown): valor is TelaDoTutorial {
  return typeof valor === "string" && (TELAS_DO_TUTORIAL as readonly string[]).includes(valor);
}

export function preferenciasLocais(): Preferencias {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) ?? "null") as Record<string, unknown> | null;
    if (!bruto || typeof bruto !== "object") return PREFERENCIAS_VAZIAS;
    const telas = Array.isArray(bruto.tutoriaisDispensados) ? bruto.tutoriaisDispensados.filter(ehTela) : [];
    return { tutoriaisDispensados: telas, roteiroDispensado: bruto.roteiroDispensado === true };
  } catch {
    // aba privada, armazenamento bloqueado ou JSON quebrado: só não lembra
    return PREFERENCIAS_VAZIAS;
  }
}

export function guardarLocal(preferencias: Preferencias): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(preferencias));
  } catch {
    // sem armazenamento: a escolha vale até recarregar
  }
}

export function juntar(a: Preferencias, b: Preferencias): Preferencias {
  return {
    tutoriaisDispensados: [...new Set([...a.tutoriaisDispensados, ...b.tutoriaisDispensados])],
    roteiroDispensado: a.roteiroDispensado || b.roteiroDispensado,
  };
}
