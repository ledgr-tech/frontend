import type { MetadataRoute } from "next";
import { ENDERECO_DO_SITE, PAGINAS_PUBLICAS } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINAS_PUBLICAS.map((pagina) => ({
    url: `${ENDERECO_DO_SITE}${pagina === "/" ? "" : pagina}`,
    changeFrequency: pagina === "/" ? "weekly" : "monthly",
    priority: pagina === "/" ? 1 : 0.5,
  }));
}
