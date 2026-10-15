/**
 * A pausa do formulário de login depois de senhas erradas seguidas.
 *
 * Quem confere a senha é o servidor (`entrar`, em `app/(auth)/acoes.ts`); isto
 * só conta os erros que ele devolve e decide quando o formulário para de
 * tentar. Vive no `localStorage`, então é conforto de interface, não barreira:
 * limite de verdade depende do login do backend.
 */

const TENTATIVAS_KEY = "ledgr_tentativas";

// senhas erradas seguidas antes de bloquear, e por quanto tempo
export const LIMITE_TENTATIVAS = 5;
export const BLOQUEIO_MS = 2 * 60 * 1000;

type Tentativas = { falhas: number; bloqueadoAte: number };

type Relogio = { agora?: number };

function lerTentativas(): Tentativas {
  if (typeof window === "undefined") return { falhas: 0, bloqueadoAte: 0 };
  try {
    const salvas = JSON.parse(
      window.localStorage.getItem(TENTATIVAS_KEY) ?? "null",
    ) as Tentativas | null;
    return salvas ?? { falhas: 0, bloqueadoAte: 0 };
  } catch {
    return { falhas: 0, bloqueadoAte: 0 };
  }
}

function salvarTentativas(tentativas: Tentativas | null): void {
  if (typeof window === "undefined") return;
  if (tentativas) window.localStorage.setItem(TENTATIVAS_KEY, JSON.stringify(tentativas));
  else window.localStorage.removeItem(TENTATIVAS_KEY);
}

export function estaBloqueado({ agora = Date.now() }: Relogio = {}): boolean {
  return lerTentativas().bloqueadoAte > agora;
}

/** Conta uma senha errada. Devolve true se foi ela que disparou o bloqueio. */
export function registrarSenhaErrada({ agora = Date.now() }: Relogio = {}): boolean {
  const falhas = lerTentativas().falhas + 1;
  if (falhas >= LIMITE_TENTATIVAS) {
    salvarTentativas({ falhas: 0, bloqueadoAte: agora + BLOQUEIO_MS });
    return true;
  }
  salvarTentativas({ falhas, bloqueadoAte: 0 });
  return false;
}

export function limparTentativas(): void {
  salvarTentativas(null);
}
