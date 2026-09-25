"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { explicarDivergencia, type Explicacao, type Indisponibilidade } from "../../acoes";

const FALHA = "Não foi possível pedir a explicação agora. Tente de novo em instantes.";

// "desabilitado" fica de fora de propósito: recurso desligado não é falha, e o
// texto do motor é a explicação daquele momento. O limite zera à meia-noite UTC.
const AVISO: Partial<Record<Indisponibilidade, string>> = {
  erro_provedor: "A explicação automática não respondeu agora; este é o texto padrão do Ledgr.",
  limite_diario:
    "O limite diário de explicações automáticas acabou (volta às 21h); este é o texto padrão do Ledgr.",
};

type Estado =
  | { etapa: "ocioso" }
  | { etapa: "explicando" }
  | { etapa: "pronta"; explicacao: Explicacao }
  | { etapa: "falhou"; erro: string; linhaMudou: boolean };

/**
 * O "O que provavelmente aconteceu" de uma divergência com dado do backend.
 *
 * A explicação só é pedida no clique: cada geração pode custar e há limite
 * diário por empresa. O texto chega puro e é mostrado como texto — é gerado a
 * partir de descrições que vêm de extrato de terceiro. Quando veio da IA, leva o
 * selo e o lembrete de que a decisão é de quem concilia; a IA só explica, nunca
 * muda o status da linha.
 */
export function ExplicacaoDaDivergencia({
  linhaId,
  voltarPara,
}: {
  linhaId: string;
  /** A conciliação desta linha, para quando a linha deixou de existir. */
  voltarPara: string;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ etapa: "ocioso" });

  async function explicar() {
    setEstado({ etapa: "explicando" });
    try {
      const resposta = await explicarDivergencia(linhaId);
      if (resposta.ok) {
        setEstado({ etapa: "pronta", explicacao: resposta.dados });
        return;
      }
      if (resposta.status === 401) {
        router.push("/login");
        return;
      }
      setEstado({ etapa: "falhou", erro: resposta.erro, linhaMudou: resposta.status === 404 });
    } catch {
      setEstado({ etapa: "falhou", erro: FALHA, linhaMudou: false });
    }
  }

  const pronta = estado.etapa === "pronta" ? estado.explicacao : null;
  const aviso = pronta?.indisponibilidade ? AVISO[pronta.indisponibilidade] : undefined;

  return (
    <div className="det-causa">
      <Image
        src={pronta ? "/mascotes/mascote-explicando.png" : "/mascotes/mascote-lendo.png"}
        alt={pronta ? "Mascote Ledgr explicando" : "Mascote Ledgr lendo"}
        width={900}
        height={808}
        sizes="130px"
        style={{ flex: "none", width: 130, height: "auto" }}
      />
      <div style={{ flex: "1 1 340px", minWidth: 0 }}>
        <h6 style={{ margin: "0 0 8px" }}>O que provavelmente aconteceu</h6>

        {pronta ? (
          <>
            {pronta.geradaPorIa && (
              <span className="selo explicacao-selo">
                <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
                Gerada por IA · confira antes de decidir
              </span>
            )}
            <p className="det-causa-texto">{pronta.texto}</p>
            {aviso && <p className="explicacao-aviso">{aviso}</p>}
          </>
        ) : (
          <>
            <p className="det-causa-texto">
              O Ledgr lê os dois lados desta linha e explica, em linguagem simples, por que ela não
              casou.
            </p>
            {estado.etapa === "falhou" && (
              <p role="alert" className="explicacao-erro">
                {estado.erro}
              </p>
            )}
            <div className="explicacao-acoes">
              {estado.etapa === "falhou" && estado.linhaMudou ? (
                <Link href={voltarPara} className="btn btn-secondary">
                  Voltar para a conciliação
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void explicar()}
                  disabled={estado.etapa === "explicando"}
                  aria-busy={estado.etapa === "explicando"}
                >
                  <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
                  {estado.etapa === "explicando"
                    ? "Explicando…"
                    : estado.etapa === "falhou"
                      ? "Tentar de novo"
                      : "Explicar esta divergência"}
                </button>
              )}
              {estado.etapa === "explicando" && (
                <span role="status" className="explicacao-aviso">
                  Lendo os dois extratos. Pode levar alguns segundos.
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
