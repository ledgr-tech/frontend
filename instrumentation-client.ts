import { opcoesDoSentry } from "@/lib/sentry";

// Erros do navegador vão para o Sentry (#290); o que vai junto está em lib/sentry.ts.
// Importado depois, num chunk à parte: estático, o SDK somava ~90 KB (gzip) à landing antes de ela abrir.
// shortcut: um erro nos primeiros instantes, antes de o chunk chegar, não é enviado; se fizer falta, voltar ao import estático.
void import("@sentry/nextjs").then((Sentry) => Sentry.init(opcoesDoSentry(process.env.NEXT_PUBLIC_VERCEL_ENV)));
