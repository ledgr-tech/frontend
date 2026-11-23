import type { DiferencaDoSaldo, SaldoDoExtrato } from "@/lib/adaptadores";
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

/** O saldo inicial (no topo) ou o final (no pé) da folha de um extrato na comparação (#474). */
export function SaldoDaFolha({
  saldo,
  momento,
  id,
}: {
  saldo: SaldoDoExtrato | null | undefined;
  momento: "inicial" | "final";
  /** Para o cabeçalho da folha apontar o saldo inicial como descrição (aria-describedby). */
  id?: string;
}) {
  if (saldo === undefined) return null;
  if (saldo === null) return momento === "final" ? <span className="saldo-folha">{SEM_SALDO}</span> : null;

  if (momento === "inicial") {
    return (
      <span className="saldo-folha" id={id}>
        <span>Saldo inicial</span>{" "}
        {/* com linhas não lidas a soma sairia incompleta: o backend não calcula, e o front também não */}
        {saldo.inicial === null ? (
          <span>depende das linhas não lidas</span>
        ) : (
          <strong>{formatarMoeda(saldo.inicial)}</strong>
        )}
      </span>
    );
  }

  return (
    <span className="saldo-folha">
      <span>{`Saldo final em ${data(saldo.data)}`}</span> <strong>{formatarMoeda(saldo.final)}</strong>
    </span>
  );
}

/** A diferença já calculada pelo backend; a falta de saldo é explicada na própria folha. */
export function DiferencaDosSaldos({ diferenca }: { diferenca?: DiferencaDoSaldo }) {
  if (diferenca === undefined) return null;
  if (diferenca.valor === null) {
    return diferenca.motivo === "datas_diferentes" ? <span className="saldo-diferenca">Saldos em datas diferentes</span> : null;
  }
  return (
    <span className="saldo-diferenca">
      {diferenca.valor === 0 ? "Saldos finais batem" : <>Diferença <strong>{formatarMoeda(diferenca.valor)}</strong></>}
    </span>
  );
}

/** Os finais dos dois extratos no celular; sem o campo do sistema, mantém a faixa do banco. */
export function FaixaDoSaldo({ banco, sistema, diferenca }: {
  banco: SaldoDoExtrato | null | undefined;
  sistema?: SaldoDoExtrato | null;
  diferenca?: DiferencaDoSaldo;
}) {
  if (sistema !== undefined) {
    return (
      <section className="saldo-faixa saldo-faixa-celular saldo-faixa-dupla" aria-label="Saldos dos extratos">
        <dl>
          {banco !== undefined && <div><dt>Banco</dt><dd><SaldoDaFolha saldo={banco} momento="final" /></dd></div>}
          <div><dt>Sistema</dt><dd><SaldoDaFolha saldo={sistema} momento="final" /></dd></div>
        </dl>
        <DiferencaDosSaldos diferenca={diferenca} />
      </section>
    );
  }
  if (banco === undefined) return null;
  return (
    <section className="saldo-faixa saldo-faixa-celular" aria-label="Saldo do extrato do banco">
      {banco === null ? (
        <p>{SEM_SALDO}</p>
      ) : (
        <dl>
          <div>
            <dt>Saldo inicial</dt>
            {/* com linhas não lidas a soma sairia incompleta: o backend não calcula, e o front também não */}
            <dd>{banco.inicial === null ? "depende das linhas não lidas" : formatarMoeda(banco.inicial)}</dd>
          </div>
          <div>
            <dt>Saldo final</dt>
            <dd>{formatarMoeda(banco.final)}</dd>
          </div>
          <div>
            <dt>Data do saldo</dt>
            <dd>{data(banco.data)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
