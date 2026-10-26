import type { MetadataRoute } from "next";
import { ENDERECO_DO_SITE, ehProducao } from "@/lib/site";

// as telas do app, da Central de ajuda e as rotas de API pedem login: não há o que indexar nelas
const FORA_DA_BUSCA = [
  "/api/",
  "/ajuda",
  "/assinatura",
  "/assistente",
  "/conciliacoes",
  "/configuracoes",
  "/dashboard",
  "/e/",
  "/extratos",
  "/fechamentos",
  "/historico",
  "/plano",
  "/regras",
  "/visao-geral",
  "/aceitar-convite",
  "/redefinir-senha",
  "/cadastro/google",
  "/autorizar-conexao",
];

export default function robots(): MetadataRoute.Robots {
  if (!ehProducao()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: FORA_DA_BUSCA },
    sitemap: `${ENDERECO_DO_SITE}/sitemap.xml`,
  };
}
