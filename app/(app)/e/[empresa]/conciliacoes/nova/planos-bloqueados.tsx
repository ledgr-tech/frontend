import Image from "next/image";
import Link from "@/lib/link-do-app";
import { planosDoTeste, type PrecoDoPlano, type SituacaoDaConta } from "@/lib/assinatura";

const FRANQUIA = "Sua conta chegou ao limite de conciliações deste mês.";

// em teste ou assinando, o 402 é a franquia de conciliações do mês (#295); sem situação, o backend antigo, é o teste
const TITULOS: Partial<Record<SituacaoDaConta, string>> = {
  assinatura_encerrada: "Sua assinatura foi encerrada.",
  teste: FRANQUIA,
  ativo: FRANQUIA,
  pagamento_pendente: FRANQUIA,
};

/**
 * No lugar do envio, quando o teste ou a assinatura acabou (pelo /me ou pelo 402 do backend). O resto do app segue
 * aberto. O preço é o mensal da Stripe; sem ele (carregando, cobrança desligada, erro), nenhum valor (#296).
 */
export function PlanosBloqueados({
  motivo,
  situacao,
  precos,
}: {
  motivo?: string;
  situacao?: SituacaoDaConta;
  precos: PrecoDoPlano[] | null;
}) {
  const titulo = (situacao && TITULOS[situacao]) ?? "Seu teste de 14 dias acabou.";
  return (
    <section className="card bloqueio" aria-labelledby="bloqueio-titulo">
      <Image src="/mascotes/mascote-cadeado.png" alt="" width={150} height={150} className="bloqueio-mascote" />
      <div className="bloqueio-corpo">
        <h2 id="bloqueio-titulo" className="bloqueio-titulo">{titulo}</h2>
        <p>{motivo ?? "Para fazer novas conciliações, escolha um plano. O que você já fez continua aqui: conciliações, extratos, histórico e fechamentos."}</p>
        {titulo === FRANQUIA && <p>A franquia recomeça no dia 1º. Para conciliar antes, escolha um plano maior.</p>}
        <ul className="bloqueio-planos">
          {planosDoTeste().map((plano) => {
            const preco = precos?.find((p) => p.plano === plano.id && p.periodo === "mensal");
            return (
              <li key={plano.id} className="card">
                <strong>{plano.nome}</strong>
                <span>{preco ? `${preco.valor} /mês · ${plano.limite}` : plano.limite}</span>
                <Link href={`/assinatura#plano-${plano.id}`} className="btn btn-secondary">{`Assinar o ${plano.nome}`}</Link>
              </li>
            );
          })}
        </ul>
        <Link href="/dashboard" className="btn btn-ghost">Ver minhas conciliações</Link>
      </div>
    </section>
  );
}
