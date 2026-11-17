/**
 * O que a pessoa dispensou no primeiro uso: os tutoriais que já abriram (ou todos, com "Não mostrar mais tutoriais") e o
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

/** `boasVindasVista` é opcional só porque a conta (`GET /me`) ainda não a manda: ausente vale falso. */
export type Preferencias = { tutoriaisDispensados: TelaDoTutorial[]; roteiroDispensado: boolean; boasVindasVista?: boolean };

export const PREFERENCIAS_VAZIAS: Preferencias = { tutoriaisDispensados: [], roteiroDispensado: false, boasVindasVista: false };

const CHAVE = "ledgr:preferencias";

export function ehTela(valor: unknown): valor is TelaDoTutorial {
  return typeof valor === "string" && (TELAS_DO_TUTORIAL as readonly string[]).includes(valor);
}

export function preferenciasLocais(dono: string): Preferencias {
  if (!dono) return PREFERENCIAS_VAZIAS;
  try {
    const armazenamento = window.localStorage;
    // A chave antiga era compartilhada: não dá para atribuir as escolhas a uma pessoa.
    armazenamento.removeItem(CHAVE);
    const bruto = JSON.parse(armazenamento.getItem(`${CHAVE}:${dono.toLowerCase()}`) ?? "null") as Record<string, unknown> | null;
    if (!bruto || typeof bruto !== "object") return PREFERENCIAS_VAZIAS;
    const telas = Array.isArray(bruto.tutoriaisDispensados) ? bruto.tutoriaisDispensados.filter(ehTela) : [];
    return {
      tutoriaisDispensados: telas,
      roteiroDispensado: bruto.roteiroDispensado === true,
      boasVindasVista: bruto.boasVindasVista === true,
    };
  } catch {
    // aba privada, armazenamento bloqueado ou JSON quebrado: só não lembra
    return PREFERENCIAS_VAZIAS;
  }
}

export function guardarLocal(dono: string, preferencias: Preferencias): void {
  if (!dono) return;
  try {
    window.localStorage.setItem(`${CHAVE}:${dono.toLowerCase()}`, JSON.stringify(preferencias));
  } catch {
    // sem armazenamento: a escolha vale até recarregar
  }
}

export function juntar(a: Preferencias, b: Preferencias): Preferencias {
  return {
    tutoriaisDispensados: [...new Set([...a.tutoriaisDispensados, ...b.tutoriaisDispensados])],
    roteiroDispensado: a.roteiroDispensado || b.roteiroDispensado,
    boasVindasVista: !!(a.boasVindasVista || b.boasVindasVista),
  };
}
