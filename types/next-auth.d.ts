import type { DefaultSession } from "next-auth";

// `empresa_id` é o claim que o backend lê pra resolver o tenant
// (02-decisoes/05-contrato-jwt-empresa-id). Em camelCase do lado do TypeScript;
// vira snake_case só na hora de assinar o token, em `auth.ts`.
declare module "next-auth" {
  interface User {
    empresaId: string;
    /** `auth_time` do `POST /login` (backend #75); ver `lib/token.ts`. */
    authTime?: number;
  }
  interface Session {
    user: { empresaId: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    empresaId: string;
    authTime?: number;
  }
}
