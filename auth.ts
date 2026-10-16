import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { aoVoltarDoGoogle, autorizar, autorizarDepoisDoCadastroGoogle } from "@/lib/login";
import { DURACAO_SESSAO_SEGUNDOS, assinarToken, lerToken } from "@/lib/token";

/**
 * Sessão via NextAuth (ADR-003) com o payload fechado em
 * `02-decisoes/05-contrato-jwt-empresa-id`: HS256, assinado com
 * NEXTAUTH_SECRET, claims `sub` / `empresa_id` / `email` / `auth_time` / `iat` / `exp`.
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
  // um erro do NextAuth (a pessoa cancelou no Google, o state venceu) volta ao login, e não à página padrão dele
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      authorize(credenciais) {
        return autorizar(String(credenciais?.email ?? ""), String(credenciais?.senha ?? ""));
      },
    }),
    // a sessão logo depois do POST /register/google: o id_token vem do cookie httpOnly, não do formulário
    Credentials({
      id: "google-cadastro",
      credentials: {},
      authorize() {
        return autorizarDepoisDoCadastroGoogle();
      },
    }),
    // Login pelo Google (backend #73): só com AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET no servidor (ver lib/google.ts)
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
  ],
  callbacks: {
    signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      return aoVoltarDoGoogle(user, account.id_token);
    },
    jwt({ token, user }) {
      // `user` só existe no login; depois disso os claims já estão no token, e
      // o `auth_time` passa adiante sem mudar em cada renovação (backend #75).
      if (user) {
        token.empresaId = String(user.empresaId ?? "");
        token.authTime = user.authTime;
      }
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
        authTime: typeof token.authTime === "number" ? token.authTime : undefined,
      });
    },
    async decode({ token }) {
      if (!token) return null;
      const claims = await lerToken(token);
      if (!claims) return null;
      return { sub: claims.usuarioId, email: claims.email, empresaId: claims.empresaId, authTime: claims.authTime };
    },
  },
});
