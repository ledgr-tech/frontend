import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { auth } from "@/auth";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";
import { ehUuid } from "@/lib/rotas";
import { contaDaSessao } from "../../../(auth)/acoes";
import { Shell } from "./shell";

/**
 * Porta de entrada do app: sem sessão, ninguém passa daqui.
 *
 * A checagem é no servidor agora. Antes era um `useEffect` lendo o
 * `localStorage`, o que obrigava a renderizar nada até saber se havia sessão —
 * a tela piscava em branco a cada navegação, e o HTML da página protegida já
 * tinha sido enviado.
 *
 * A empresa vem da URL (`/e/<empresa>/...`, spec 2026-10-21-empresa-ativa-na-url): um segmento que não
 * é UUID, ou um UUID que não é de empresa da conta, é 404. Sem a lista de empresas (o `GET /me` de um
 * backend anterior ao #133, ou fora do ar) o UUID é aceito: o cabeçalho segue vindo da URL, e um backend
 * que não conhece o cabeçalho o ignora.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ empresa: string }>;
}) {
  const sessao = await auth();
  if (!sessao?.user?.email) return redirecionarNoApp("/login");

  const { empresa } = await params;
  if (!ehUuid(empresa)) notFound();

  const conta = await contaDaSessao();
  if (conta.empresas.length > 0 && !conta.empresas.some((candidata) => candidata.id === empresa)) notFound();
  // sem plano, escolhe antes de entrar (spec 2026-10-15-primeiro-uso); sem a informação, segue
  if (conta.assinatura?.situacao === "sem_plano") return redirecionarNoApp("/plano");

  const ativa = conta.empresas.find((candidata) => candidata.id === empresa) ?? {
    id: empresa,
    razaoSocial: conta.empresa,
    cnpj: "",
  };
  return (
    <ProvedorDaEmpresa ativa={ativa} empresas={conta.empresas.length > 0 ? conta.empresas : [ativa]}>
      <Shell
        email={sessao.user.email}
        empresa={ativa.razaoSocial}
        nomeDaConta={conta.empresa}
        temSenha={conta.temSenha}
        papel={conta.papel}
        preferencias={conta.preferencias}
        assinatura={conta.assinatura}
        limites={conta.limites}
        guardaArquivoOriginal={conta.guardaArquivoOriginal}
      >
        {children}
      </Shell>
    </ProvedorDaEmpresa>
  );
}
