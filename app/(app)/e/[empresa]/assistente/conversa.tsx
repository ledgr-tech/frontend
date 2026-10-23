"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "@/lib/link-do-app";
import { useRoteador } from "@/lib/roteador";
import { caminhoSemEmpresa } from "@/lib/rotas";
import { Sparkles, X } from "lucide-react";
import { explicarDivergencia } from "../conciliacoes/acoes";
import { formatarMoedaCurta } from "../dashboard/resumo";
import { telaDoCaminho } from "../tutorial/roteiros";
import { ajudaDaTela } from "../../../../(ajuda)/ajuda/paginas";
import { lembrarDeOndeVeio } from "../../../../(ajuda)/ajuda/voltar";
import { perguntarAoAssistente, type TurnoDaConversa } from "./acoes";
import { foraDoRoteiro, responder, saudacao, sugestoes, type Contexto } from "./respostas";

/**
 * A conversa com o Ledgr ("chatbot" do APP em Ledgr.dc.html), dentro do painel
 * que abre do cartão do menu.
 * O que é sobre o mês sai de `responder`, com os números da última conciliação; a
 * explicação de uma divergência é a IA do backend. O resto ("como faço…") vai ao
 * assistente da Central de ajuda (backend #137, front #172), com a tela aberta e as
 * últimas mensagens. Só as chamadas de verdade têm espera, para não encenar.
 */

type LinkDaMensagem = { href: string; rotulo: string };

type Mensagem = {
  id: number;
  de: "ledgr" | "voce";
  texto: string;
  links?: LinkDaMensagem[];
  /** Só o texto que veio do modelo leva o selo de IA. */
  ia?: boolean;
};

/** O que o painel tem quando não há conciliação para olhar: só as dúvidas de uso. */
export type SemDados = "vazio" | "falhou";

const CENTRAL: LinkDaMensagem = { href: "/ajuda", rotulo: "Abrir a Central de ajuda" };
const MAXIMO_TURNOS = 6;

const SUGESTOES_DE_USO = ["Como envio o extrato do banco?", "Como convido alguém da equipe?", "Como fecho o mês?"];

function saudacaoSemDados(semDados: SemDados): string {
  return semDados === "vazio"
    ? "Ainda não há conciliação para eu olhar, mas posso explicar como usar o Ledgr: pergunte como fazer o que precisar."
    : "Não consegui ler a última conciliação agora, mas posso explicar como usar o Ledgr: pergunte como fazer o que precisar.";
}

/**
 * No topo, o mascote acenando com o balão; ao lado de cada mensagem, em 28px, só o rosto: a mão e
 * o balão viravam ruído nesse tamanho.
 */
function Mascote({ tamanho, rosto = false }: { tamanho: number; rosto?: boolean }) {
  return (
    <Image
      src={rosto ? "/mascotes/mascote-avatar.png" : "/mascotes/mascote-chatbot.png"}
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

export function Conversa({
  contexto,
  semDados = "vazio",
  onFechar,
}: {
  /** null quando não há conciliação (ou ela não carregou): a conversa fica só com as dúvidas de uso. */
  contexto: Contexto | null;
  semDados?: SemDados;
  onFechar: () => void;
}) {
  const router = useRoteador();
  // a página da Central da tela aberta: o assistente responde pensando nela
  const tela = ajudaDaTela(telaDoCaminho(caminhoSemEmpresa(usePathname())))?.id ?? null;
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    contexto
      ? { id: 0, de: "ledgr", texto: saudacao(contexto) }
      : {
          id: 0,
          de: "ledgr",
          texto: saudacaoSemDados(semDados),
          links: semDados === "vazio" ? [{ href: "/conciliacoes/nova", rotulo: "Nova conciliação" }] : undefined,
        },
  ]);
  const [texto, setTexto] = useState("");
  // o que a espera está fazendo: lendo o extrato (a explicação) ou procurando na Central
  const [lendo, setLendo] = useState<"extrato" | "central" | null>(null);
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
    const maior = contexto?.maior;
    if (!maior) return;
    setLendo("extrato");
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
              links: [{ href: maior.href, rotulo: "Abrir a linha" }],
            }
          : { de: "ledgr", texto: resposta.erro },
      );
    } catch {
      acrescentar({ de: "ledgr", texto: "Não foi possível falar com o servidor. Tente de novo em instantes." });
    } finally {
      setLendo(null);
    }
  }

  /** A pergunta que o roteiro do mês não responde vai ao assistente da Central, com as últimas mensagens. */
  async function perguntarACentral(pergunta: string, anteriores: Mensagem[]) {
    setLendo("central");
    const historico: TurnoDaConversa[] = anteriores
      .slice(-MAXIMO_TURNOS)
      .map((mensagem) => ({ papel: mensagem.de === "voce" ? "usuario" : "assistente", texto: mensagem.texto }));
    try {
      const resposta = await perguntarAoAssistente(pergunta, tela, historico);
      if (resposta.ok) {
        const { dados } = resposta;
        const links = dados.links.map((link) => ({ href: link.caminho, rotulo: link.titulo }));
        // sem resposta na Central, ou sem seção citada, a Central inteira é o caminho
        acrescentar({
          de: "ledgr",
          texto: dados.resposta,
          ia: true,
          links: dados.respondida && links.length > 0 ? links : [...links, CENTRAL],
        });
        return;
      }
      if (resposta.status === 401) {
        router.push("/login");
        return;
      }
      // o limite do dia tem o texto do backend; fora do ar, o que o roteiro sabe, e a Central
      acrescentar({
        de: "ledgr",
        texto:
          resposta.status === 429
            ? resposta.erro
            : contexto
              ? foraDoRoteiro(contexto)
              : "O assistente está indisponível agora. A Central de ajuda tem o passo a passo de cada tela.",
        links: [CENTRAL],
      });
    } catch {
      acrescentar({ de: "ledgr", texto: "Não foi possível falar com o servidor. Tente de novo em instantes.", links: [CENTRAL] });
    } finally {
      setLendo(null);
    }
  }

  function perguntar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || lendo) return;
    const anteriores = mensagens;
    acrescentar({ de: "voce", texto: limpa });
    setTexto("");
    const resposta = contexto ? responder(limpa, contexto) : null;
    if (resposta?.explicar) {
      void explicar();
      return;
    }
    if (resposta) {
      acrescentar({ de: "ledgr", texto: resposta.texto, links: resposta.link && [resposta.link] });
      return;
    }
    void perguntarACentral(limpa, anteriores);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    perguntar(texto);
  }

  return (
    <>
      <TopoDoLedgr
        status={
          lendo === "extrato"
            ? "lendo o extrato…"
            : lendo === "central"
              ? "procurando na Central…"
              : contexto
                ? `olhando ${contexto.mes}`
                : undefined
        }
        onFechar={onFechar}
      />

      {/* role="log": o leitor de tela anuncia cada mensagem nova, sem roubar o foco */}
      <div className="asst-mensagens" role="log" aria-label="Conversa com o Ledgr" aria-live="polite">
        {mensagens.map((mensagem) =>
          mensagem.de === "ledgr" ? (
            <div key={mensagem.id} className="asst-linha">
              <Mascote tamanho={28} rosto />
              <div className="asst-bolha asst-bolha-ledgr">
                {mensagem.ia && (
                  <span className="asst-selo-ia">
                    <Sparkles size={13} aria-hidden="true" />
                    Gerada por IA · confira antes de decidir
                  </span>
                )}
                {/* texto puro: pode vir de descrição de extrato de terceiro, nunca vira HTML */}
                <p>{mensagem.texto}</p>
                {mensagem.links?.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="asst-link"
                    // a Central abre em tela cheia; o "Voltar ao Ledgr" de lá traz de volta a esta tela
                    onClick={link.href.startsWith("/ajuda") ? lembrarDeOndeVeio : undefined}
                  >
                    {link.rotulo}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div key={mensagem.id} className="asst-linha asst-linha-voce">
              <p className="asst-bolha asst-bolha-voce">{mensagem.texto}</p>
            </div>
          ),
        )}
        {lendo && (
          <div
            className="asst-linha"
            aria-label={lendo === "central" ? "O Ledgr está procurando na Central de ajuda" : "O Ledgr está lendo o extrato"}
          >
            <Mascote tamanho={28} rosto />
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
        {(contexto ? sugestoes(contexto) : SUGESTOES_DE_USO).map((sugestao) => (
          <button key={sugestao} type="button" className="pill" disabled={lendo !== null} onClick={() => perguntar(sugestao)}>
            {sugestao}
          </button>
        ))}
      </div>

      <form className="asst-campo" onSubmit={enviar}>
        <input
          type="text"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder={contexto ? `Pergunte sobre ${contexto.mes} ou como usar o Ledgr…` : "Pergunte como fazer algo no Ledgr…"}
          maxLength={500}
          aria-label="Sua pergunta"
          autoComplete="off"
          // o painel abriu para uma pergunta: o cursor já espera nela
          autoFocus
        />
        <button type="submit" className="btn btn-secondary" disabled={lendo !== null || !texto.trim()}>
          Enviar
        </button>
      </form>
    </>
  );
}
