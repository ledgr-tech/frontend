export type Tema = "claro" | "escuro";

const CHAVE = "ledgr_tema";

type DocumentoComTransicao = Document & { startViewTransition?: (trocar: () => void) => { finished: Promise<void> } };

/**
 * Troca o tema num cross-fade da página inteira (View Transitions, globals.css). Sem a API ou com
 * movimento reduzido, troca na hora. O atributo restringe a animação à troca de tema: as trocas de
 * tela usam a mesma API com outra animação.
 */
function comTransicao(trocar: () => void): void {
  const doc = document as DocumentoComTransicao;
  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (typeof doc.startViewTransition !== "function" || reduzido) {
    trocar();
    return;
  }
  const html = document.documentElement;
  html.dataset.trocandoTema = "";
  doc
    .startViewTransition(trocar)
    .finished.catch(() => {})
    .finally(() => delete html.dataset.trocandoTema);
}

/** O que o sistema operacional pede. É o padrão enquanto ninguém escolheu nada. */
export function temaDoSistema(): Tema {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "claro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

/** A escolha salva, ou a do sistema quando não há escolha. */
export function temaAtual(): Tema {
  if (typeof window === "undefined") return "claro";
  let salvo: string | null = null;
  try {
    salvo = window.localStorage.getItem(CHAVE);
  } catch {
    // localStorage bloqueado (janela anônima, cookies negados): segue o sistema
  }
  return salvo === "claro" || salvo === "escuro" ? salvo : temaDoSistema();
}

/**
 * Fixa um tema. Escrever o atributo em <html> é o que liga o bloco escuro do CSS;
 * o mesmo atributo é escrito antes da primeira pintura pelo script em
 * `app/layout.tsx`, para o app não abrir claro e piscar.
 */
export function aplicarTema(tema: Tema): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, tema);
  } catch {
    // sem persistência, mas a sessão atual ainda respeita a escolha
  }
  comTransicao(() => {
    document.documentElement.dataset.tema = tema;
  });
}

/** O que a pessoa escolheu nas configurações: um tema fixo ou seguir o sistema. */
export type EscolhaDeTema = Tema | "sistema";

export function escolhaDeTema(): EscolhaDeTema {
  if (typeof window === "undefined") return "sistema";
  try {
    const salvo = window.localStorage.getItem(CHAVE);
    return salvo === "claro" || salvo === "escuro" ? salvo : "sistema";
  } catch {
    return "sistema";
  }
}

/**
 * Esquece a escolha: sem o atributo em <html>, o CSS volta a seguir o
 * `prefers-color-scheme`, inclusive se o sistema trocar com o app aberto.
 */
export function seguirSistema(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // nada salvo para apagar
  }
  comTransicao(() => {
    delete document.documentElement.dataset.tema;
  });
}
