import "server-only";
import { CredentialsSignin } from "next-auth";
import { ErroBackend, chamarBackend } from "./backend";

/**
 * A conferência da senha, que é do backend (`POST /login`, issue #57 dele).
 * Ele devolve só quem é o usuário, sem token: quem emite o JWT continua sendo o
 * NextAuth (ADR-003), com o `empresa_id` que vem daqui.
 *
 * Separado do `auth.ts` pelo mesmo motivo do `lib/token.ts`: é a parte que
 * precisa de teste, e o `auth.ts` não se importa sem subir o NextAuth inteiro.
 */

/** O corpo que `POST /login` e `POST /register` devolvem. */
export type UsuarioAPI = { id: string; empresa_id: string; nome: string; email: string };

/**
 * O 429 do backend. Tem que ser um `CredentialsSignin` pra chegar inteiro na
 * Server Action (qualquer outro erro o NextAuth embrulha), e o `code` é o que
 * separa "espere um minuto" de "senha errada".
 */
export class MuitasEntradas extends CredentialsSignin {
  code = "limite";
}

/**
 * O `authorize` do NextAuth. `null` é credencial errada: o backend responde o
 * mesmo 401 pra e-mail sem conta e pra senha errada, de propósito, pra não
 * contar quais e-mails existem. Backend fora do ar sobe como erro.
 */
export async function autorizar(email: string, senha: string) {
  try {
    const usuario = await chamarBackend<UsuarioAPI>("/login", {
      method: "POST",
      corpo: { email, senha },
      publica: true,
    });
    return { id: usuario.id, email: usuario.email, name: usuario.nome, empresaId: usuario.empresa_id };
  } catch (erro) {
    if (erro instanceof ErroBackend && erro.status === 401) return null;
    if (erro instanceof ErroBackend && erro.status === 429) throw new MuitasEntradas();
    throw erro;
  }
}
