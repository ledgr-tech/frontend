import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_CADASTRO_GOOGLE, identidadeDoIdToken } from "@/lib/google";
import { FormularioCadastro } from "../formulario";

/**
 * O fim do cadastro de quem voltou do Google sem conta no Ledgr (backend #73):
 * o callback do Google deixou o `id_token` no cookie httpOnly. Sem ele (venceu,
 * ou a pessoa chegou aqui direto), o cadastro é o comum.
 */
export default async function CadastroGooglePage() {
  const idToken = (await cookies()).get(COOKIE_CADASTRO_GOOGLE)?.value;
  const identidade = idToken ? identidadeDoIdToken(idToken) : null;
  if (!identidade) redirect("/cadastro");
  return <FormularioCadastro google={identidade} />;
}
