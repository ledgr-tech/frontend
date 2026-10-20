"use client";

import { useId, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { planosDoTeste, type PlanoId } from "@/lib/assinatura";
import { escolherPlano } from "../acoes";

const PARA: Record<PlanoId, { para: string; itens: [string, "breve"?][]; tag?: string }> = {
  essencial: { para: "Para a empresa que concilia o próprio banco.", itens: [["Conciliação banco × sistema"], ["Fechamento do mês com relatório em PDF"], ["Histórico das conciliações"]] },
  padrao: { para: "Para o escritório que concilia os clientes.", itens: [["Tudo do Essencial"], ["Pastas de extratos, uma por cliente"]], tag: "Para escritórios" },
  // a IA (assistente e conexão com ChatGPT/Claude) fica no plano mais caro (mentoria de 19/10, #172)
  avancado: { para: "Para o escritório com equipe.", itens: [["Tudo do Padrão"], ["Convites para a equipe"], ["Assistente de IA no Ledgr", "breve"], ["Conexão com o ChatGPT e o Claude", "breve"]] },
};

/**
 * Os passos do medidor: lançamentos por mês. A régua marca o teto de cada plano (100, 200, 350) e o
 * fim, acima do qual o plano é combinado com a equipe. shortcut: o Escala (até 5.000) não está entre
 * os planos do teste (ata de 14/10: Essencial, Padrão, Avançado e o sob consulta); se voltar, a faixa
 * de 351 a 5.000 ganha preço em vez do "fale com a gente".
 */
const PASSOS = [20, 50, 80, 100, 150, 180, 200, 250, 300, 350, 500, 1000, 2000, 3500, 5000, 6000];
const INICIAL = PASSOS.indexOf(180);
const MARCAS: [number, string][] = [
  [100, "100"],
  [200, "200"],
  [350, "350"],
  [5000, "5.000+"],
];
const TOPO: Record<PlanoId | "volume", number> = { essencial: 100, padrao: 200, avancado: 350, volume: 6000 };
const CONTATO = "ledgrtech@gmail.com";

function planoDoVolume(lancamentos: number): PlanoId | null {
  if (lancamentos <= 100) return "essencial";
  if (lancamentos <= 200) return "padrao";
  if (lancamentos <= 350) return "avancado";
  return null;
}

/**
 * A escolha do plano que começa o teste de 14 dias (spec 2026-10-15-primeiro-uso), guiada: a pessoa
 * diz quantos lançamentos concilia por mês e a tela indica o plano. Acima de 350, o plano é combinado
 * com a equipe. `encerrado`: o teste acabou e a pessoa volta para assinar (o link do topo e o bloqueio
 * levam aqui).
 *
 * shortcut: sem o seletor de período (mensal, anual e "ver outros planos"), porque o teste é sem
 * cartão e os descontos ainda não foram decididos; ele entra com o gateway (#167).
 */
export function EscolherPlano({ encerrado = false }: { encerrado?: boolean }) {
  const router = useRouter();
  const idMedidor = useId();
  const [passo, setPasso] = useState(INICIAL);
  const [escolhendo, setEscolhendo] = useState<PlanoId | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lancamentos = PASSOS[passo];
  const planos = planosDoTeste();
  const id = planoDoVolume(lancamentos);
  const plano = planos.find((p) => p.id === id) ?? null;
  const ultimo = PASSOS.length - 1;

  async function escolher(escolhido: PlanoId) {
    setErro(null);
    setEscolhendo(escolhido);
    const resposta = await escolherPlano(escolhido).catch(() => ({ ok: false as const, erro: "Não foi possível falar com o servidor." }));
    if (resposta.ok) {
      router.push("/visao-geral");
      return;
    }
    setEscolhendo(null);
    setErro(resposta.erro);
  }

  function irPara(destino: PlanoId | "volume") {
    setPasso(PASSOS.indexOf(TOPO[destino]));
  }

  return (
    <div className="plano-tela">
      <div className="plano-pergunta">
        <p className="eyebrow plano-rotulo">{encerrado ? "Assinatura" : "Último passo · 14 dias grátis"}</p>
        <h1 className="titulo-misto plano-titulo">
          {encerrado ? (
            <>
              Seu teste acabou. <em>Escolha um plano.</em>
            </>
          ) : (
            <>
              Quantos lançamentos você <em>concilia por mês?</em>
            </>
          )}
        </h1>
        <hr className="plano-traco" />
        <p className="plano-texto">
          {encerrado
            ? "O que você já fez continua na conta. Diga quantos lançamentos concilia por mês e veja o plano para assinar."
            : "Conte os lançamentos do extrato do banco de um mês. Se não souber, arraste até perto: o teste é de 14 dias, sem cartão, e dá para trocar de plano quando quiser."}
        </p>

        <div className="plano-medidor">
          <label htmlFor={idMedidor} className="plano-valor">
            <output htmlFor={idMedidor}>
              {lancamentos.toLocaleString("pt-BR")}
              {passo === ultimo ? "+" : ""}
            </output>
            <span>lançamentos por mês</span>
          </label>
          <input
            id={idMedidor}
            type="range"
            min={0}
            max={ultimo}
            step={1}
            value={passo}
            aria-valuetext={`${lancamentos.toLocaleString("pt-BR")}${passo === ultimo ? " ou mais" : ""} lançamentos por mês`}
            style={{ "--cheio": `${(passo / ultimo) * 100}%` } as CSSProperties}
            onChange={(evento) => setPasso(Number(evento.target.value))}
          />
          <div className="plano-marcas" aria-hidden="true">
            {MARCAS.map(([valor, rotulo]) => (
              <span key={rotulo} style={{ "--p": `${(PASSOS.indexOf(valor) / ultimo) * 100}%` } as CSSProperties}>
                {rotulo}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="plano-resposta" aria-live="polite" aria-labelledby="plano-indicado">
        <Image src="/mascotes/mascote-joinha.png" alt="" width={1073} height={1173} sizes="104px" className="plano-mascote" priority />
        <p className="eyebrow plano-rotulo">{plano ? "O plano para o seu volume" : "Mais de 350 por mês"}</p>
        {/* a key reinicia a entrada a cada plano indicado; o resto do cartão fica parado */}
        <div key={plano?.id ?? "volume"} className="plano-indicacao">
          <h2 id="plano-indicado" className="titulo-misto plano-nome">
            {plano ? (
              <>
                O seu plano é o <em>{plano.nome}.</em>
              </>
            ) : (
              <>
                Vamos combinar <em>juntos.</em>
              </>
            )}
          </h2>
          {plano && PARA[plano.id].tag && <span className="selo plano-selo">{PARA[plano.id].tag}</span>}
          <p className="plano-para">
            {plano ? PARA[plano.id].para : "Acima de 350 lançamentos, para a indústria e quem concilia muitos bancos, o plano e o preço são combinados com a gente."}
          </p>
          {plano ? (
            <>
              <p className="plano-preco">
                <span>{plano.preco}</span> <small>/mês</small>
              </p>
              <p className="plano-limite">{plano.limite}</p>
              <ul className="plano-itens">
                {PARA[plano.id].itens.map(([item, marca]) => (
                  <li key={item} data-depois={marca ? "" : undefined}>
                    <Check size={15} aria-hidden="true" />
                    <span>
                      {item}
                      {marca && <span className="plano-em-breve">em breve</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {encerrado ? (
                // a cobrança chega com o gateway, depois de 02/11: até lá, assinar é falar com a equipe, e
                // a rota de escolher o plano (que começa o teste) não é chamada de novo
                <a className="btn btn-primary plano-acao" href={`mailto:${CONTATO}?subject=${encodeURIComponent(`Assinar o ${plano.nome}`)}`}>
                  {`Assinar o ${plano.nome}`}
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary plano-acao"
                  disabled={escolhendo !== null}
                  onClick={() => void escolher(plano.id)}
                >
                  {escolhendo === plano.id ? "Um momento…" : `Começar com o ${plano.nome}`}
                </button>
              )}
            </>
          ) : (
            <a className="btn btn-primary plano-acao" href={`mailto:${CONTATO}?subject=${encodeURIComponent("Plano Volume")}`}>
              Fale com a gente
            </a>
          )}
        </div>
        {erro && (
          <p role="alert" className="plano-erro">
            {erro}
          </p>
        )}
        <div className="plano-outros">
          <span>Ou escolha outro:</span>
          {[...planos.map((p) => ({ id: p.id as PlanoId | "volume", nome: p.nome })), { id: "volume" as const, nome: "Volume" }]
            .filter((outro) => outro.id !== (plano?.id ?? "volume"))
            .map((outro) => (
              <button key={outro.id} type="button" onClick={() => irPara(outro.id)}>
                {outro.nome}
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
