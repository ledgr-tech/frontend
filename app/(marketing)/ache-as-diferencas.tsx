"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { estaResolvida, rotuloCurto } from "@/app/(app)/dashboard/resumo";
import { IconeOrigem } from "@/app/(app)/icone-origem";
import { porExtenso } from "./categorias";
import type { LinhaExtrato } from "./comparacao";

/** O fecho do jogo: a dor vista de perto, e o Ledgr dito numa frase, sem mostrar a tela dele. */
export const PONTE =
  "Num fechamento real são centenas de linhas, todo mês. O Ledgr confere todas e aponta só as que não batem, com o motivo.";

/** O cronômetro do jogo, em m:ss. */
export function formatarTempo(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

/** O placar: quem desmarcou tudo antes de revelar também "não marcou nenhuma". */
export function textoDoResultado(achadas: number, total: number, marcadas: number, tempo: string): string {
  if (marcadas === 0) return `Você não marcou nenhuma: passaram as ${total}.`;
  return `Você achou ${achadas} de ${total}, em ${tempo}.`;
}

type Estado = "achou" | "passou" | "a-toa";

// o relógio só é lido nos handlers e no intervalo, nunca no render
const agora = () => Date.now();
const segundosDesde = (inicio: number) => Math.floor((agora() - inicio) / 1000);

function Celulas({ linha, valor }: { linha: LinhaExtrato; valor: string | null }) {
  return (
    <>
      <span className="ache-data">{linha.data}</span>
      <span className="ache-desc">{linha.desc}</span>
      <span className="ache-valor">{valor}</span>
    </>
  );
}

/**
 * O Cap. II da landing: as duas folhas de agosto como chegam à mão, sem as marcas do Ledgr. Quem
 * visita marca as linhas do banco que acha que não batem e pede para ver o que passou; a revelação
 * usa os selos do app (`rotuloCurto`) e o que os próprios números dizem (`fatos`, pela descrição).
 * Nada fica guardado: recarregar começa de novo.
 */
export function AcheAsDiferencas({
  banco,
  sistema,
  fatos,
}: {
  banco: LinhaExtrato[];
  sistema: LinhaExtrato[];
  fatos: Record<string, string>;
}) {
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set());
  const [inicio, setInicio] = useState<number | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [revelado, setRevelado] = useState(false);
  const idBanco = useId();
  const idSistema = useId();
  const primeiraLinha = useRef<HTMLButtonElement>(null);
  const tentarDeNovo = useRef<HTMLButtonElement>(null);
  // o foco segue a ação: revelar tira o botão de baixo do foco, recomeçar tira as notas
  const focar = useRef<"tentar" | "primeira" | null>(null);

  useEffect(() => {
    if (inicio === null || revelado) return;
    const intervalo = setInterval(() => setSegundos(segundosDesde(inicio)), 250);
    return () => clearInterval(intervalo);
  }, [inicio, revelado]);

  useEffect(() => {
    if (focar.current === "tentar") tentarDeNovo.current?.focus();
    if (focar.current === "primeira") primeiraLinha.current?.focus();
    focar.current = null;
  }, [revelado]);

  const diverge = (linha: LinhaExtrato) => !estaResolvida(linha.status);
  const divergentes = banco.filter(diverge);

  const alternar = (desc: string) => {
    if (inicio === null) setInicio(agora());
    setMarcadas((atuais) => {
      const novas = new Set(atuais);
      if (novas.has(desc)) novas.delete(desc);
      else novas.add(desc);
      return novas;
    });
  };

  const revelar = () => {
    if (inicio !== null) setSegundos(segundosDesde(inicio));
    focar.current = "tentar";
    setRevelado(true);
  };

  const recomecar = () => {
    setMarcadas(new Set());
    setInicio(null);
    setSegundos(0);
    focar.current = "primeira";
    setRevelado(false);
  };

  const estadoDe = (linha: LinhaExtrato): Estado | undefined => {
    const marcada = marcadas.has(linha.desc);
    if (diverge(linha)) return marcada ? "achou" : "passou";
    return marcada ? "a-toa" : undefined;
  };

  const notaDe = (linha: LinhaExtrato, estado: Estado) => {
    if (estado === "a-toa") return "Esta bate.";
    const abertura = estado === "achou" ? "Você achou." : "Passou.";
    return `${abertura} ${rotuloCurto(linha)} · ${fatos[linha.desc]}`;
  };

  const quantas = porExtenso(banco.length, "m");
  const tempo = formatarTempo(segundos);
  const achadas = divergentes.filter((linha) => marcadas.has(linha.desc)).length;
  let ordem = 0;

  return (
    <div className="ache" data-revelado={revelado || undefined}>
      <div className="ache-topo">
        <p className="problema-rotulo problema-rotulo-ledgr">Tente você</p>
        <div className="ache-enunciado">
          <p className="ache-instrucao">
            <span className="so-mouse">{quantas} lançamentos de agosto. Marque os do banco que não batem com o sistema.</span>
            <span className="so-toque">{quantas} lançamentos de agosto. Toque nos do banco que não batem com o sistema.</span>
          </p>
          <p className="ache-relogio">
            <span className="sr-only">Tempo: </span>
            {tempo}
          </p>
        </div>
      </div>

      <div className="ache-folhas">
        <div className="ache-folha" data-folha="banco">
          <p className="ache-folha-nome" id={idBanco}>
            <IconeOrigem origem="banco" />
            Extrato do banco
          </p>
          <ul className="ache-linhas" aria-labelledby={idBanco}>
            {banco.map((linha, i) => {
              if (!revelado) {
                return (
                  <li key={linha.desc}>
                    <button
                      ref={i === 0 ? primeiraLinha : undefined}
                      type="button"
                      className="ache-linha"
                      aria-pressed={marcadas.has(linha.desc)}
                      aria-label={`${linha.data}, ${linha.desc}, ${linha.valorBanco}`}
                      onClick={() => alternar(linha.desc)}
                    >
                      <Celulas linha={linha} valor={linha.valorBanco} />
                    </button>
                  </li>
                );
              }
              const estado = estadoDe(linha);
              return (
                <li key={linha.desc} className="ache-linha" data-estado={estado}>
                  <Celulas linha={linha} valor={linha.valorBanco} />
                  {estado && (
                    <p className="ache-nota" style={{ "--ordem": ordem++ } as CSSProperties}>
                      {notaDe(linha, estado)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="ache-folha" data-folha="sistema">
          <p className="ache-folha-nome" id={idSistema}>
            <IconeOrigem origem="sistema" />
            Sistema de gestão
          </p>
          <ul className="ache-linhas" aria-labelledby={idSistema}>
            {sistema.map((linha) => {
              // o par da linha do banco, pela descrição, como na TabelaFolhas
              const par = banco.find((b) => b.desc === linha.desc);
              const estado = revelado && par ? estadoDe(par) : undefined;
              return (
                <li key={linha.desc} className="ache-linha" data-estado={estado === "a-toa" ? undefined : estado}>
                  <Celulas linha={linha} valor={linha.valorSistema} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="ache-pe">
        <div className="ache-resultado" aria-live="polite">
          {revelado && (
            <>
              <p className="ache-placar">{textoDoResultado(achadas, divergentes.length, marcadas.size, tempo)}</p>
              <p className="ache-ponte">{PONTE}</p>
            </>
          )}
        </div>
        <div className="ache-acoes">
          {revelado ? (
            <>
              <a href="#como" className="btn btn-primary">
                Ver como funciona
              </a>
              <button ref={tentarDeNovo} type="button" className="btn btn-ghost" onClick={recomecar}>
                Tentar de novo
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={revelar}>
              Ver o que passou
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
