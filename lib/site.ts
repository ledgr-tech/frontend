/**
 * O endereço público do site, para o robots.txt e o sitemap. Na Vercel vem do domínio de produção
 * do projeto (ledgrfinance.com.br); fora dela, o servidor local.
 */
export const ENDERECO_DO_SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

/** Só a produção entra no Google: as prévias de cada PR e o servidor local ficam de fora. */
export const ehProducao = () => process.env.VERCEL_ENV === "production";

/** As páginas públicas que valem a busca. O resto pede login ou é um passo de um fluxo. */
export const PAGINAS_PUBLICAS = ["/", "/cadastro", "/privacidade", "/termos"];
