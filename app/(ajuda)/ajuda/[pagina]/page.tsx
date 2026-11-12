import { notFound } from "next/navigation";
import { CentralDeAjuda } from "../central";
import { paginaDeAjuda } from "../paginas";
import { enderecoDoConector } from "@/lib/conexao-ia";

export default async function PaginaDaAjuda({
  params,
}: PageProps<"/ajuda/[pagina]">) {
  const { pagina } = await params;
  if (!paginaDeAjuda(pagina)) notFound();
  return <CentralDeAjuda id={pagina} endereco={enderecoDoConector()} />;
}
