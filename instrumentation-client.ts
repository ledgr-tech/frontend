import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentry } from "@/lib/sentry";

// Erros do navegador vão para o Sentry (#290); o que vai junto está em lib/sentry.ts.
Sentry.init(opcoesDoSentry(process.env.NEXT_PUBLIC_VERCEL_ENV));
