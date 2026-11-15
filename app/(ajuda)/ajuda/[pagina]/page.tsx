import { notFound } from "next/navigation";
import { CentralDeAjuda } from "../central";
import { paginaDeAjuda } from "../paginas";
import { enderecoPublicoDoConector } from "@/lib/endereco-do-conector";

export default async function PaginaDaAjuda({
  params,
}: PageProps<"/ajuda/[pagina]">) {
  const { pagina } = await params;
  const achada = paginaDeAjuda(pagina);
  if (!achada) notFound();
  // só a página da conexão mostra o endereço: as outras não esperam o backend
  return <CentralDeAjuda id={pagina} endereco={achada.destaque ? await enderecoPublicoDoConector() : null} />;
}
