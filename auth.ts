import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { autorizarContaDeTeste } from "@/lib/conta-teste";
import { DURACAO_SESSAO_SEGUNDOS, assinarToken, lerToken } from "@/lib/token";

/**
 * Sessão via NextAuth (ADR-003) com o payload fechado em
 * `02-decisoes/05-contrato-jwt-empresa-id`: HS256, assinado com
 * NEXTAUTH_SECRET, claims `sub` / `empresa_id` / `email` / `iat` / `exp`.
 *
 * O ponto não óbvio: por padrão o NextAuth **criptografa** o cookie de sessão
 * (JWE A256CBC-HS512) em vez de só assinar. O backend decodifica com PyJWT e
 * HS256 — ou seja, o token padrão do NextAuth seria ilegível pra ele. Por isso
 * `jwt.encode`/`jwt.decode` estão trocados aqui: o cookie passa a ser
 * exatamente o JWT que o backend espera, e não precisa de conversão nenhuma
 * na hora de chamar a API.
 */

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: DURACAO_SESSAO_SEGUNDOS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      // ponytail: o backend ainda não expõe endpoint de autenticação — só
      // /extratos e /conciliacoes. Enquanto não expõe, a única conta que entra
      // é a de teste (`lib/conta-teste.ts`) e o empresa_id vem do ambiente.
      // Quando o login real existir, é esta função que passa a chamá-lo; nada
      // mais muda, porque o resto do sistema já trabalha em cima do token.
      authorize(credenciais) {
        return autorizarContaDeTeste(
          String(credenciais?.email ?? ""),
          String(credenciais?.senha ?? ""),
        );
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` só existe no login; depois disso o claim já está no token.
      if (user) token.empresaId = String((user as { empresaId?: string }).empresaId ?? "");
      return token;
    },
    session({ session, token }) {
      session.user.empresaId = String(token.empresaId ?? "");
      return session;
    },
  },
  jwt: {
    encode({ token }) {
      if (!token) return Promise.resolve("");
      return assinarToken({
        usuarioId: String(token.sub ?? ""),
        email: String(token.email ?? ""),
        empresaId: String(token.empresaId ?? ""),
      });
    },
    async decode({ token }) {
      if (!token) return null;
      const claims = await lerToken(token);
      if (!claims) return null;
      return { sub: claims.usuarioId, email: claims.email, empresaId: claims.empresaId };
    },
  },
});
