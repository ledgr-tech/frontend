/**
 * Login e cadastro pelo Google (backend #73). Quem confere a identidade é o
 * backend, com o `id_token` que o Google entrega ao NextAuth; daqui saem só o
 * interruptor do botão, o cookie do cadastro pela metade e os textos de erro,
 * que o login e o cadastro dividem.
 *
 * `NEXT_PUBLIC_` pelo mesmo motivo do `lib/demo.ts`: o login precisa saber se
 * mostra o botão, e o valor entra no build. O provider em si só existe com
 * `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` no servidor (`auth.ts`).
 */
export function googleLigado(): boolean {
  return process.env.NEXT_PUBLIC_LEDGR_GOOGLE === "1";
}

/**
 * Quem voltou do Google sem conta no Ledgr (404 do `/login/google`) termina o
 * cadastro em `/cadastro/google`. O `id_token` espera nesse cookie httpOnly,
 * só no servidor, como o token do NextAuth, e vale o mesmo que ele: 1 hora.
 */
export const COOKIE_CADASTRO_GOOGLE = "ledgr-cadastro-google";
export const VALIDADE_ID_TOKEN_SEGUNDOS = 60 * 60;

/**
 * Quem voltou do Google com um e-mail que já tem senha (409 `email_com_senha`) liga os dois
 * digitando a senha no login (backend #218). O `id_token` espera aqui, como no cadastro.
 */
export const COOKIE_VINCULO_GOOGLE = "ledgr-vinculo-google";

/**
 * O consentimento de uma conexão (o `voltar` do login) enquanto a pessoa está no Google: se ele recusar,
 * o `/login?google=<erro>` volta com ele, e entrar com a senha em seguida ainda leva ao pedido.
 */
export const COOKIE_VOLTAR_GOOGLE = "ledgr-voltar-google";

/** O que volta ao login quando o Google não abre a sessão: vai em `/login?google=<erro>`. */
export type ErroGoogle =
  | "email_com_senha"
  | "email_com_outro_google"
  | "google_de_outra_conta"
  | "nao_confirmado"
  | "indisponivel"
  | "muitas_tentativas"
  | "falha";

export const MENSAGEM_GOOGLE: Record<ErroGoogle, string> = {
  // o backend não liga o Google sozinho a uma conta com senha (ADR-004, 13/10): a senha liga, pelo /login/google/vincular (#218)
  email_com_senha: "Este e-mail já tem conta com senha. Digite a senha para conectar o Google a ela e entrar.",
  email_com_outro_google: "Esta conta já está conectada a outra conta Google. Entre com a senha ou com aquele Google.",
  google_de_outra_conta: "Este Google já entra no Ledgr por outra conta. Aceite com senha ou com outro Google.",
  nao_confirmado: "Não foi possível confirmar a conta Google. Tente de novo.",
  indisponivel: "O login pelo Google está indisponível agora. Entre com e-mail e senha.",
  muitas_tentativas: "Muitas tentativas seguidas agora. Espere um minuto e tente de novo.",
  falha: "Não foi possível entrar com o Google. Tente de novo em instantes.",
};

/**
 * O `?error=` que o NextAuth manda ao login vem do Google quando é do OAuth (`OAuthCallbackError`…) ou
 * a recusa do callback `signIn` (`AccessDenied`). Uma exceção dentro do `signIn` (`aoVoltarDoGoogle`)
 * chega como `Configuration` e mostra o texto genérico: o Auth.js não diz que veio do Google.
 */
export function erroEhDoGoogle(erro: string | null): boolean {
  return erro !== null && (erro.startsWith("OAuth") || erro === "AccessDenied");
}

/**
 * Quem aceita um convite pelo Google (backend #69/#73) vai ao Google com o token do
 * convite neste cookie httpOnly, pelo mesmo tempo do `id_token`. Na volta, o
 * `aoVoltarDoGoogle` vê o cookie e aceita o convite em vez de entrar.
 */
export const COOKIE_CONVITE_GOOGLE = "ledgr-convite-google";

/** O que volta a `/aceitar-convite?google=<motivo>` quando o Google não aceitou o convite. */
export type ErroConviteGoogle =
  | "email_diferente"
  | "convite_invalido"
  | "email_cadastrado"
  | "google_de_outra_conta"
  | "conta_inativa"
  | "muitas_tentativas"
  | "falha";

const ERROS_CONVITE_GOOGLE: readonly string[] = [
  "email_diferente",
  "convite_invalido",
  "email_cadastrado",
  "google_de_outra_conta",
  "conta_inativa",
  "muitas_tentativas",
  "falha",
];

export function ehErroConviteGoogle(valor: unknown): valor is ErroConviteGoogle {
  return typeof valor === "string" && ERROS_CONVITE_GOOGLE.includes(valor);
}

export function ehErroGoogle(valor: unknown): valor is ErroGoogle {
  return typeof valor === "string" && Object.hasOwn(MENSAGEM_GOOGLE, valor);
}

/**
 * O e-mail e o nome de dentro do `id_token`, só para preencher o cadastro: a
 * assinatura não é conferida aqui, porque quem decide é o backend, que confere
 * tudo de novo no `/register/google`.
 */
export function identidadeDoIdToken(idToken: string): { email: string; nome: string } | null {
  try {
    const parte = idToken.split(".")[1] ?? "";
    const json = atob(parte.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { email?: unknown; name?: unknown };
    if (typeof claims.email !== "string" || !claims.email) return null;
    return { email: claims.email, nome: typeof claims.name === "string" ? claims.name : "" };
  } catch {
    return null;
  }
}
