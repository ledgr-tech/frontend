import Image from "next/image";
import Link from "@/lib/link-do-app";
import { planosDoTeste } from "@/lib/assinatura";

/** No lugar do envio, quando o teste acabou (pelo /me ou pelo 402 do backend). O resto do app segue aberto. */
export function PlanosBloqueados({ motivo }: { motivo?: string }) {
  return (
    <section className="card bloqueio" aria-labelledby="bloqueio-titulo">
      <Image src="/mascotes/mascote-cadeado.png" alt="" width={150} height={150} className="bloqueio-mascote" />
      <div className="bloqueio-corpo">
        <h2 id="bloqueio-titulo" className="bloqueio-titulo">Seu teste de 14 dias acabou.</h2>
        <p>{motivo ?? "Para fazer novas conciliações, escolha um plano. O que você já fez continua aqui: conciliações, extratos, histórico e fechamentos."}</p>
        <ul className="bloqueio-planos">
          {planosDoTeste().map((plano) => (
            <li key={plano.id} className="card">
              <strong>{plano.nome}</strong>
              <span>{plano.preco} /mês · {plano.limite}</span>
              <Link href="/plano" className="btn btn-secondary">{`Assinar o ${plano.nome}`}</Link>
            </li>
          ))}
        </ul>
        <Link href="/dashboard" className="btn btn-ghost">Ver minhas conciliações</Link>
      </div>
    </section>
  );
}
