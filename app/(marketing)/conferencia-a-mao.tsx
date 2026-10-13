import { IconeOrigem } from "@/app/(app)/icone-origem";
import type { LinhaExtrato } from "./comparacao";

/** Uma dor do fechamento à mão. Com `linha`, o número dela marca essa linha nas duas telas; sem, marca a escala do mês. */
export type Dor = { titulo: string; texto: string; linha?: string };

function Marca({ numero }: { numero: number }) {
  return (
    <>
      <span className="mao-marca" aria-hidden="true">
        {numero}
      </span>
      <span className="sr-only">, dor {numero}</span>
    </>
  );
}

function Linha({ linha, valor, marca }: { linha: LinhaExtrato; valor: string | null; marca?: number }) {
  return (
    <li className="mao-linha">
      <span className="mao-data">{linha.data}</span>
      <span className="mao-desc">{linha.desc}</span>
      <span className="mao-valor">{valor}</span>
      {marca ? <Marca numero={marca} /> : <span aria-hidden="true" />}
    </li>
  );
}

/**
 * O Cap. II da landing, só leitura: as duas telas de agosto como chegam à mão, sem as marcas do
 * Ledgr (como a Ramp mostra o jeito velho), com as linhas por trás de cada dor numeradas, e as dores
 * embaixo, uma por número (como o Pilot fala na voz de quem lê). Os números das dores saem dos
 * mesmos lançamentos (page.tsx): o site não diz um agosto e mostra outro.
 */
export function ConferenciaAMao({
  banco,
  sistema,
  total,
  dores,
}: {
  banco: LinhaExtrato[];
  sistema: LinhaExtrato[];
  /** quantos lançamentos o banco tem no mês do exemplo */
  total: number;
  dores: Dor[];
}) {
  const marcaDa = (desc: string) => {
    const i = dores.findIndex((dor) => dor.linha === desc);
    return i >= 0 ? i + 1 : undefined;
  };
  const marcaDaEscala = dores.findIndex((dor) => !dor.linha) + 1 || undefined;
  const resto = (total - banco.length).toLocaleString("pt-BR");

  return (
    <div className="mao">
      <figure className="mao-folhas">
        <figcaption className="sr-only">As duas telas de agosto como chegam à mão, com as linhas de cada dor numeradas</figcaption>
        <div className="mao-folha" data-folha="banco">
          <p className="mao-folha-nome" id="mao-banco">
            <IconeOrigem origem="banco" />
            Extrato do banco
          </p>
          <ul className="mao-linhas" aria-labelledby="mao-banco">
            {banco.map((linha) => (
              <Linha key={linha.desc} linha={linha} valor={linha.valorBanco} marca={marcaDa(linha.desc)} />
            ))}
            <li className="mao-linha mao-escala">
              <span className="mao-reticencias">… mais {resto} lançamentos</span>
              {marcaDaEscala ? <Marca numero={marcaDaEscala} /> : <span aria-hidden="true" />}
            </li>
          </ul>
        </div>
        <div className="mao-folha" data-folha="sistema">
          <p className="mao-folha-nome" id="mao-sistema">
            <IconeOrigem origem="sistema" />
            Sistema de gestão
          </p>
          <ul className="mao-linhas" aria-labelledby="mao-sistema">
            {sistema.map((linha) => (
              <Linha key={linha.desc} linha={linha} valor={linha.valorSistema} marca={marcaDa(linha.desc)} />
            ))}
            <li className="mao-linha mao-escala" aria-hidden="true">
              <span className="mao-reticencias">…</span>
            </li>
          </ul>
        </div>
      </figure>

      <ol className="mao-dores" aria-label="O que custa conferir à mão">
        {dores.map((dor, i) => (
          <li key={dor.titulo} className="mao-dor">
            <div className="mao-dor-topo">
              <span className="mao-marca" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="mao-dor-titulo">{dor.titulo}</h3>
            </div>
            <p className="mao-dor-texto">{dor.texto}</p>
          </li>
        ))}
      </ol>

      <p className="mao-ponte">
        O Ledgr confere todas as linhas e aponta só as que não batem, com o motivo.{" "}
        <a href="#como">Veja como funciona</a>
      </p>
    </div>
  );
}
