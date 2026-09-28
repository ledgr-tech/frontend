import type { Metadata } from "next";
import Link from "next/link";
import { TelaDeAviso } from "./tela-de-aviso";

export const metadata: Metadata = { title: "Página não encontrada · Ledgr" };

/**
 * O 404 de todo endereço que não existe. Um layout raiz só, então este arquivo
 * basta; o `global-not-found` do Next é para app com vários layouts raiz.
 *
 * "Ir para o Ledgr" leva à visão geral: quem não está logado cai no login pelo
 * próprio layout do app, então o link serve aos dois casos sem ler a sessão.
 */
export default function NaoEncontrada() {
  return (
    <main className="aviso-pagina">
      <TelaDeAviso titulo="Esta página não existe." texto="O endereço pode ter mudado, ou o link chegou incompleto.">
        <Link href="/visao-geral" className="btn btn-primary">
          Ir para o Ledgr
        </Link>
        <Link href="/" className="btn btn-secondary">
          Ver o site
        </Link>
      </TelaDeAviso>
    </main>
  );
}
