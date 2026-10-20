import type { TelaDoTutorial } from "@/lib/preferencias";

export const CHAVE_COLUNA = "ledgr_coluna";

/** As telas que mostram a coluna Agora; a divergência só a tem quando abre por cima da Comparação. */
export const TELAS_COM_COLUNA: ReadonlySet<TelaDoTutorial> = new Set<TelaDoTutorial>([
  "visao-geral",
  "conciliacoes",
  "nova-conciliacao",
  "comparacao",
  "extratos",
  "historico",
  "fechamentos",
]);

export function temColuna(tela: TelaDoTutorial | null): boolean {
  return tela !== null && TELAS_COM_COLUNA.has(tela);
}

/** Lê o atributo de <html> (o que o CSS mostra agora), como `menuRecolhido`; vale mesmo sem localStorage. */
export function colunaRecolhida(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.coluna === "recolhida";
}

/** Recolhe ou abre a coluna; sem `gravar`, só vale nesta sessão (o tutorial abre a coluna sem lembrar). */
export function definirColuna(recolhida: boolean, { gravar = true } = {}): void {
  const valor = recolhida ? "recolhida" : "aberta";
  if (gravar) {
    try {
      window.localStorage.setItem(CHAVE_COLUNA, valor);
    } catch {
      // sem persistência, mas a sessão atual ainda respeita a escolha
    }
  }
  document.documentElement.dataset.coluna = valor;
}
