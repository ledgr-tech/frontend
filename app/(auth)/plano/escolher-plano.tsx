"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { NumeroAnimado } from "@/app/(app)/numero-animado";
import { formatarVolume, teclarNoMedidor, useAlturaQueDesliza } from "@/app/medidor-suave";
import { planosDoTeste, type PlanoId } from "@/lib/assinatura";
import {
  CONTATO,
  DETALHES,
  MARCAS,
  PASSO_INICIAL,
  ULTIMO_PASSO,
  passoDoPlano,
  planoDoVolume,
  planoLembrado,
  volumeDoPasso,
  type Indicado,
} from "@/lib/medidor-de-planos";
import { escolherPlano } from "../acoes";

/**
 * A escolha do plano que começa o teste de 14 dias (spec 2026-10-15-primeiro-uso), guiada: a pessoa
 * diz quantos lançamentos concilia por mês e a tela indica o plano (lib/medidor-de-planos.ts, a mesma
 * conta do Cap. IV da landing). Acima de 350, o plano é combinado com a equipe. `encerrado`: o teste
 * acabou e a pessoa volta para assinar (o link do topo e o bloqueio levam aqui).
 *
 * shortcut: sem o seletor de período (mensal, anual e "ver outros planos"), porque o teste é sem
 * cartão e os descontos ainda não foram decididos; ele entra com o gateway (#167).
 */
export function EscolherPlano({ encerrado = false }: { encerrado?: boolean }) {
  const router = useRouter();
  const idMedidor = useId();
  const [passo, setPasso] = useState(PASSO_INICIAL);
  const [escolhendo, setEscolhendo] = useState<PlanoId | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // quem escolheu um plano na landing chega aqui com o medidor nele
  useEffect(() => {
    const lembrado = planoLembrado();
    // o navegador só existe no cliente; ler fora do render é o padrão do projeto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lembrado) setPasso(passoDoPlano(lembrado));
  }, []);

  const lancamentos = volumeDoPasso(passo);
  const planos = planosDoTeste();
  const indicado = planoDoVolume(lancamentos);
  const plano = planos.find((p) => p.id === indicado) ?? null;
  const detalhes = DETALHES[indicado];
  const { caixa, conteudo } = useAlturaQueDesliza(indicado);

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

  const outros: { id: Indicado; nome: string }[] = [...planos.map((p) => ({ id: p.id as Indicado, nome: p.nome })), { id: "volume", nome: "Volume" }];

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
              <NumeroAnimado valor={lancamentos} duracao={350} formatar={formatarVolume(passo)} />
            </output>
            <span>lançamentos por mês</span>
          </label>
          <input
            id={idMedidor}
            type="range"
            min={0}
            max={ULTIMO_PASSO}
            step={0.01}
            value={passo}
            aria-valuetext={`${lancamentos.toLocaleString("pt-BR")}${passo === ULTIMO_PASSO ? " ou mais" : ""} lançamentos por mês`}
            style={{ "--cheio": `${(passo / ULTIMO_PASSO) * 100}%` } as CSSProperties}
            onChange={(evento) => setPasso(Number(evento.target.value))}
            onKeyDown={teclarNoMedidor(setPasso)}
          />
          <div className="plano-marcas" aria-hidden="true">
            {MARCAS.map(([marca, rotulo]) => (
              <span key={rotulo} style={{ "--p": `${(marca / ULTIMO_PASSO) * 100}%` } as CSSProperties}>
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
        <div ref={caixa} className="plano-corpo">
          <div ref={conteudo} key={indicado} className="plano-indicacao">
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
            {detalhes.tag && <span className="selo plano-selo">{detalhes.tag}</span>}
            <p className="plano-para">{detalhes.para}</p>
            {plano ? (
              <>
                <p className="plano-preco">
                  <span>{plano.preco}</span> <small>/mês</small>
                </p>
                <p className="plano-limite">{plano.limite}</p>
                <ul className="plano-itens">
                  {detalhes.itens.map(([item, emBreve]) => (
                    <li key={item} data-depois={emBreve ? "" : undefined}>
                      <Check size={15} aria-hidden="true" />
                      <span>
                        {item}
                        {emBreve && <span className="plano-em-breve">em breve</span>}
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
        </div>
        {erro && (
          <p role="alert" className="plano-erro">
            {erro}
          </p>
        )}
        <div className="plano-outros">
          <span>Ou escolha outro:</span>
          {outros
            .filter((outro) => outro.id !== indicado)
            .map((outro) => (
              <button key={outro.id} type="button" onClick={() => setPasso(passoDoPlano(outro.id))}>
                {outro.nome}
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
