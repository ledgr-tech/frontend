"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { explicarDivergencia } from "../conciliacoes/acoes";
import { formatarMoedaCurta } from "../dashboard/resumo";
import { responder, saudacao, sugestoes, type Contexto, type Resposta } from "./respostas";

/**
 * A conversa com o Ledgr ("chatbot" do APP em Ledgr.dc.html), dentro do painel
 * que abre do cartão do menu.
 * As respostas saem de `responder`, com os números da última conciliação; a
 * explicação de uma divergência é a IA do backend, e só ela tem espera — o
 * "lendo o extrato…" aparece quando há uma chamada de verdade, não para encenar.
 */

type Mensagem = {
  id: number;
  de: "ledgr" | "voce";
  texto: string;
  link?: Resposta["link"];
  /** Só o texto que veio do modelo leva o selo de IA. */
  ia?: boolean;
};

function Mascote({ tamanho }: { tamanho: number }) {
  return (
    <Image
      src="/mascotes/mascote-chatbot.png"
      alt=""
      width={1254}
      height={1254}
      sizes={`${tamanho}px`}
      style={{ width: tamanho, height: tamanho, flex: "none" }}
    />
  );
}

/** O topo do painel, no tom do cartão de lançamento: a chamada em ouro, o nome, fechar. */
export function TopoDoLedgr({ status, onFechar }: { status?: string; onFechar: () => void }) {
  return (
    <div className="asst-topo">
      <Mascote tamanho={40} />
      <div className="asst-topo-texto">
        <h6 className="asst-chamada">
          <span className="asst-ponto" aria-hidden="true" />
          {status ? `Assistente · ${status}` : "Assistente"}
        </h6>
        <span className="asst-nome">Fale com o Ledgr</span>
      </div>
      <button type="button" className="asst-fechar" aria-label="Fechar conversa" onClick={onFechar}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Conversa({ contexto, onFechar }: { contexto: Contexto; onFechar: () => void }) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ id: 0, de: "ledgr", texto: saudacao(contexto) }]);
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const proximoId = useRef(1);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: "nearest" });
  }, [mensagens, lendo]);

  function acrescentar(mensagem: Omit<Mensagem, "id">) {
    const id = proximoId.current++;
    setMensagens((atuais) => [...atuais, { ...mensagem, id }]);
  }

  async function explicar() {
    const maior = contexto.maior;
    if (!maior) return;
    setLendo(true);
    try {
      const resposta = await explicarDivergencia(maior.id);
      if (!resposta.ok && resposta.status === 401) {
        router.push("/login");
        return;
      }
      const sobre = `Sobre “${maior.descricao}” (${maior.rotulo}${maior.valor > 0 ? `, ${formatarMoedaCurta(maior.valor)}` : ""}): `;
      acrescentar(
        resposta.ok
          ? {
              de: "ledgr",
              texto: sobre + resposta.dados.texto,
              ia: resposta.dados.geradaPorIa,
              link: { href: maior.href, rotulo: "Abrir a linha" },
            }
          : { de: "ledgr", texto: resposta.erro },
      );
    } catch {
      acrescentar({ de: "ledgr", texto: "Não foi possível falar com o servidor. Tente de novo em instantes." });
    } finally {
      setLendo(false);
    }
  }

  function perguntar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || lendo) return;
    acrescentar({ de: "voce", texto: limpa });
    setTexto("");
    const resposta = responder(limpa, contexto);
    if (resposta.explicar) {
      void explicar();
      return;
    }
    acrescentar({ de: "ledgr", texto: resposta.texto, link: resposta.link });
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    perguntar(texto);
  }

  return (
    <>
      <TopoDoLedgr status={lendo ? "lendo o extrato…" : `olhando ${contexto.mes}`} onFechar={onFechar} />

      {/* role="log": o leitor de tela anuncia cada mensagem nova, sem roubar o foco */}
      <div className="asst-mensagens" role="log" aria-label="Conversa com o Ledgr" aria-live="polite">
        {mensagens.map((mensagem) =>
          mensagem.de === "ledgr" ? (
            <div key={mensagem.id} className="asst-linha">
              <Mascote tamanho={28} />
              <div className="asst-bolha asst-bolha-ledgr">
                {mensagem.ia && (
                  <span className="asst-selo-ia">
                    <Sparkles size={13} aria-hidden="true" />
                    Gerada por IA · confira antes de decidir
                  </span>
                )}
                {/* texto puro: pode vir de descrição de extrato de terceiro, nunca vira HTML */}
                <p>{mensagem.texto}</p>
                {mensagem.link && (
                  <Link href={mensagem.link.href} className="asst-link">
                    {mensagem.link.rotulo}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div key={mensagem.id} className="asst-linha asst-linha-voce">
              <p className="asst-bolha asst-bolha-voce">{mensagem.texto}</p>
            </div>
          ),
        )}
        {lendo && (
          <div className="asst-linha" aria-label="O Ledgr está lendo o extrato">
            <Mascote tamanho={28} />
            <span className="asst-bolha asst-digitando" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
        <div ref={fim} />
      </div>

      <div className="asst-sugestoes" role="group" aria-label="Perguntas sugeridas">
        {sugestoes(contexto).map((sugestao) => (
          <button key={sugestao} type="button" className="pill" disabled={lendo} onClick={() => perguntar(sugestao)}>
            {sugestao}
          </button>
        ))}
      </div>

      <form className="asst-campo" onSubmit={enviar}>
        <input
          type="text"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder={`Pergunte sobre ${contexto.mes}…`}
          aria-label="Sua pergunta"
          autoComplete="off"
          // o painel abriu para uma pergunta: o cursor já espera nela
          autoFocus
        />
        <button type="submit" className="btn btn-secondary" disabled={lendo || !texto.trim()}>
          Enviar
        </button>
      </form>
    </>
  );
}
