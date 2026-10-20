import { redirect } from "next/navigation";
import { PAGINAS } from "./paginas";

/** A Central abre na primeira tela do fluxo, como o índice de um manual. */
export default function AjudaPage() {
  redirect(`/ajuda/${PAGINAS[0].id}`);
}
