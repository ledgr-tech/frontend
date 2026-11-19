import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentry } from "@/lib/sentry";

/** Erros do servidor (páginas, Server Actions, rotas, proxy) vão para o Sentry (#290); o que vai junto está em lib/sentry.ts. */
export function register() {
  Sentry.init(opcoesDoSentry(process.env.VERCEL_ENV));
}

export const onRequestError = Sentry.captureRequestError;
