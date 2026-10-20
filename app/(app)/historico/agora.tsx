import Link from "next/link";
import { TudoEmDia } from "../coluna/tudo-em-dia";
import { formatarInteiro } from "../dashboard/resumo";

/** O "Agora" do Histórico: a primeira conciliação com linhas para revisar, ou "Tudo em dia". */
export function AgoraDoHistorico({
  conciliacao,
}: {
  conciliacao: { titulo: string; quantidade: number; href: string } | null;
}) {
  if (!conciliacao) return <TudoEmDia />;
  const { titulo, quantidade, href } = conciliacao;
  return (
    <div className="conc-continuar">
      <Link href={href} className="btn btn-primary">
        {`${formatarInteiro(quantidade)} ${quantidade === 1 ? "pendência" : "pendências"} em ${titulo}`}
      </Link>
    </div>
  );
}
