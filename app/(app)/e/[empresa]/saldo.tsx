import type { SaldoDoExtrato } from "@/lib/adaptadores";
import { formatarMoeda } from "@/lib/mock-data";

/**
 * O saldo do extrato do banco (front #118, backend #118): a conciliação bancária fecha por ele.
 * `undefined` é o backend sem a #118, e aí nenhuma tela fala de saldo; `null` é o arquivo sem
 * saldo (CSV sem a coluna, extrato antigo ou ainda processando), e aí a tela diz isso em vez de
 * mostrar R$ 0,00.
 */

export const SEM_SALDO = "Saldo não informado no arquivo";

/** AAAA-MM-DD → DD/MM/AAAA. */
export function data(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** "Saldo final de R$ 1.000,00 em 10/09/2026", ou o aviso de sem saldo. Para uma frase solta. */
export function fraseDoSaldoFinal(saldo: SaldoDoExtrato | null): string {
  return saldo ? `Saldo final de ${formatarMoeda(saldo.final)} em ${data(saldo.data)}` : SEM_SALDO;
}

/**
 * A linha que fecha a comparação, onde o extrato do banco traz o saldo final (#239): o mesmo saldo
 * da faixa do topo, em qualquer página e filtro, porque é do extrato, não das linhas à vista.
 */
export function SaldoNoFim({ saldo }: { saldo: SaldoDoExtrato | null | undefined }) {
  if (saldo === undefined) return null;
  return (
    <p className="saldo-fim">
      {saldo === null ? (
        SEM_SALDO
      ) : (
        <>
          <span>{`Saldo final em ${data(saldo.data)}:`}</span> <strong>{formatarMoeda(saldo.final)}</strong>
        </>
      )}
    </p>
  );
}

/** A faixa do saldo no topo da comparação: inicial, final e a data, do extrato do banco. */
export function FaixaDoSaldo({ saldo }: { saldo: SaldoDoExtrato | null | undefined }) {
  if (saldo === undefined) return null;
  return (
    <section className="saldo-faixa" aria-label="Saldo do extrato do banco">
      {saldo === null ? (
        <p>{SEM_SALDO}</p>
      ) : (
        <dl>
          <div>
            <dt>Saldo inicial</dt>
            {/* com linhas não lidas a soma sairia incompleta: o backend não calcula, e o front também não */}
            <dd>{saldo.inicial === null ? "depende das linhas não lidas" : formatarMoeda(saldo.inicial)}</dd>
          </div>
          <div>
            <dt>Saldo final</dt>
            <dd>{formatarMoeda(saldo.final)}</dd>
          </div>
          <div>
            <dt>Data do saldo</dt>
            <dd>{data(saldo.data)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
