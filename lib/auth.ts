/**
 * O que sobrou do mock de autenticação depois que o NextAuth entrou (`auth.ts`
 * na raiz): a conta de teste e o bloqueio por tentativas.
 *
 * A sessão em si — criar, ler, encerrar — é do NextAuth agora, em cookie
 * httpOnly. Nada aqui toca mais em `localStorage` pra guardar quem está logado.
 */

const TENTATIVAS_KEY = "ledgr_tentativas";

// ponytail: o backend ainda não tem endpoint de login (só /extratos e
// /conciliacoes), então esta continua sendo a única conta que entra. Quem
// valida de verdade é o `authorize` do NextAuth, no servidor; aqui a conta é
// usada só pra escolher qual mensagem de erro o formulário mostra.
export const CONTA_TESTE = { email: "financeiro@telhacerta.com.br", senha: "ledgr2026" };

// senhas erradas seguidas antes de bloquear, e por quanto tempo
export const LIMITE_TENTATIVAS = 5;
export const BLOQUEIO_MS = 2 * 60 * 1000;

export type ErroAutenticacao = "conta_nao_encontrada" | "senha_incorreta" | "muitas_tentativas";

export type ResultadoAutenticacao = { ok: true } | { ok: false; erro: ErroAutenticacao };

type Tentativas = { falhas: number; bloqueadoAte: number };

export type OpcoesSessao = {
  /** "Manter sessão ativa": sem ela, o cookie some quando o navegador fecha. */
  manterSessao?: boolean;
};

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

/**
 * Decide **qual mensagem** o formulário mostra, e conta as tentativas erradas.
 *
 * Não é o que autentica: quem autentica é o `authorize` do NextAuth, no
 * servidor. Esta função existe porque o formulário distingue "conta não
 * encontrada" de "senha incorreta", e o Credentials provider devolve só
 * `null` — não tem como saber qual dos dois foi.
 *
 * Quando o backend expuser login de verdade, esta distinção deixa de ser
 * possível (e deixa de ser desejável: dizer qual e-mail existe é justamente o
 * vazamento que o backend evita em outros pontos, devolvendo 404 no lugar de
 * 403). Aí isto vira uma mensagem só e a função some.
 */
export function autenticar(
  email: string,
  senha: string,
  { agora = Date.now() }: { agora?: number } = {},
): ResultadoAutenticacao {
  const tentativas = lerTentativas();
  if (tentativas.bloqueadoAte > agora) return { ok: false, erro: "muitas_tentativas" };

  if (email.trim().toLowerCase() !== CONTA_TESTE.email) {
    return { ok: false, erro: "conta_nao_encontrada" };
  }

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
  return { ok: true };
}
