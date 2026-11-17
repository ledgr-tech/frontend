"use client";

import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { comEmpresa } from "@/lib/rotas";
import { ErroInesperado } from "../../../tela-de-aviso";

/**
 * Erro inesperado numa tela do app. Fica abaixo do layout do app, então o menu
 * e a barra de cima continuam: a pessoa troca de tela sem recarregar tudo.
 */
export default function ErroNoApp({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const empresa = useEmpresaAtiva();
  const href = empresa ? comEmpresa(empresa.id, "/visao-geral") : "/visao-geral";
  return <ErroInesperado error={error} retry={retry} voltar={{ href, rotulo: "Ir para a visão geral" }} />;
}
