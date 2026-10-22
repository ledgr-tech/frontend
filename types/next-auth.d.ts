import type { DefaultSession } from "next-auth";

// `conta_id` é o claim que o backend lê pra resolver o tenant
// (02-decisoes/05-contrato-jwt-empresa-id). Em camelCase do lado do TypeScript;
// vira snake_case só na hora de assinar o token, em `auth.ts`.
declare module "next-auth" {
  interface User {
    contaId: string;
    /** `auth_time` do `POST /login` (backend #75); ver `lib/token.ts`. */
    authTime?: number;
  }
  interface Session {
    user: { contaId: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    contaId: string;
    authTime?: number;
  }
}
