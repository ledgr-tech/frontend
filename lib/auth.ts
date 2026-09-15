const SESSION_KEY = "ledgr_session";
const TENTATIVAS_KEY = "ledgr_tentativas";

export type Session = {
  email: string;
};

// conta única do login de teste enquanto não existe backend (autenticação real: issue #5)
export const CONTA_TESTE = { email: "financeiro@telhacerta.com.br", senha: "ledgr2026" };

// senhas erradas seguidas antes de bloquear, e por quanto tempo
export const LIMITE_TENTATIVAS = 5;
export const BLOQUEIO_MS = 2 * 60 * 1000;

export type ErroAutenticacao = "conta_nao_encontrada" | "senha_incorreta" | "muitas_tentativas";

export type ResultadoAutenticacao = { ok: true; sessao: Session } | { ok: false; erro: ErroAutenticacao };

type Tentativas = { falhas: number; bloqueadoAte: number };

export function login(email: string): Session {
  const session: Session = { email };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function logout(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

function lerTentativas(): Tentativas {
  if (typeof window === "undefined") return { falhas: 0, bloqueadoAte: 0 };
  try {
    const salvas = JSON.parse(window.localStorage.getItem(TENTATIVAS_KEY) ?? "null") as Tentativas | null;
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

/**
 * Autenticação simulada: só a CONTA_TESTE entra. Mesma forma de resultado que uma API real devolveria,
 * para a tela já tratar cada erro no lugar certo.
 */
export function autenticar(email: string, senha: string, agora: number = Date.now()): ResultadoAutenticacao {
  const tentativas = lerTentativas();
  if (tentativas.bloqueadoAte > agora) return { ok: false, erro: "muitas_tentativas" };

  if (email.trim().toLowerCase() !== CONTA_TESTE.email) return { ok: false, erro: "conta_nao_encontrada" };

  if (senha !== CONTA_TESTE.senha) {
    const falhas = tentativas.falhas + 1;
    if (falhas >= LIMITE_TENTATIVAS) {
      salvarTentativas({ falhas: 0, bloqueadoAte: agora + BLOQUEIO_MS });
      return { ok: false, erro: "muitas_tentativas" };
    }
    salvarTentativas({ falhas, bloqueadoAte: 0 });
    return { ok: false, erro: "senha_incorreta" };
  }

  salvarTentativas(null);
  return { ok: true, sessao: login(CONTA_TESTE.email) };
}
