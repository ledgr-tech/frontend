"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { MensagemErro } from "../_compartilhado/mensagem-erro";
import {
  autorizarConexao,
  carregarPedidoDeConexao,
  recusarConexao,
  type PedidoDeConexao,
} from "../../(app)/e/[empresa]/conexoes-mcp/acoes";

const estiloTitulo: CSSProperties = {
  margin: "0 0 clamp(8px, 1.5vh, 14px)",
  fontSize: "clamp(26px, 3.2vw, 34px)",
  fontWeight: 400,
  lineHeight: 1.15,
  letterSpacing: "-0.016em",
  textWrap: "balance",
};

const estiloTexto: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 15,
  lineHeight: 1.6,
  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
};

type Estado =
  | { situacao: "carregando" }
  | { situacao: "invalido"; erro: string }
  | { situacao: "pronto"; pedido: PedidoDeConexao };

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function cnpjFormatado(cnpj: string): string {
  return cnpj.length === 14 ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : cnpj;
}

/**
 * Quem está pedindo (o nome que o cliente deu e, em destaque, o host para onde o código volta), o que
 * poderá ler (só leitura) e de qual empresa. Autorizar e recusar mandam o navegador de volta ao cliente.
 * O analista só pode recusar: autorizar é do admin e do gestor.
 */
export function Consentimento({
  pedido,
  email,
  podeAutorizar,
}: {
  pedido: string | null;
  email: string;
  podeAutorizar: boolean;
}) {
  const [estado, setEstado] = useState<Estado>(
    pedido ? { situacao: "carregando" } : { situacao: "invalido", erro: "Este endereço não tem um pedido de conexão." },
  );
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"autorizar" | "recusar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // um envio por vez: o pedido é de uso único, e o segundo clique só veria o 404
  const travado = useRef(false);
  const idErro = useId();
  const idEmpresas = useId();

  useEffect(() => {
    if (!pedido) return;
    let vivo = true;
    carregarPedidoDeConexao(pedido)
      .then((resposta) => {
        if (!vivo) return;
        if (!resposta.ok) {
          setEstado({ situacao: "invalido", erro: resposta.erro });
          return;
        }
        setEstado({ situacao: "pronto", pedido: resposta.dados });
        // com uma empresa só, ela já vem marcada; com mais, a pessoa escolhe
        if (resposta.dados.empresas.length === 1) setEmpresa(resposta.dados.empresas[0].id);
      })
      .catch(() => vivo && setEstado({ situacao: "invalido", erro: "Não foi possível falar com o servidor." }));
    return () => {
      vivo = false;
    };
  }, [pedido]);

  async function decidir(acao: "autorizar" | "recusar") {
    if (!pedido || travado.current) return;
    if (acao === "autorizar" && !empresa) {
      setErro("Escolha a empresa que a conexão vai ler.");
      return;
    }
    travado.current = true;
    setEnviando(acao);
    setErro(null);
    let resposta: Awaited<ReturnType<typeof autorizarConexao>>;
    try {
      resposta = acao === "autorizar" ? await autorizarConexao(pedido, empresa!) : await recusarConexao(pedido);
    } catch {
      resposta = { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
    }
    if (resposta.ok) {
      // volta ao ChatGPT ou ao Claude, com o código ou com a recusa; a tela fica travada até sair
      window.location.assign(resposta.dados.destino);
      return;
    }
    travado.current = false;
    setEnviando(null);
    if (resposta.status === 404) {
      setEstado({ situacao: "invalido", erro: resposta.erro });
      return;
    }
    setErro(resposta.erro);
  }

  if (estado.situacao === "carregando") {
    return (
      <MolduraAuth rotulo="Conexão">
        <p style={estiloTexto} role="status">
          Conferindo o pedido de conexão…
        </p>
      </MolduraAuth>
    );
  }

  if (estado.situacao === "invalido") {
    return (
      <MolduraAuth rotulo="Conexão">
        <div style={{ width: "100%", maxWidth: 424 }}>
          <h1 style={estiloTitulo}>Pedido indisponível.</h1>
          <p style={estiloTexto}>{estado.erro}</p>
          <Link href="/visao-geral" className="btn btn-secondary btn-block">
            Ir para o Ledgr
          </Link>
        </div>
      </MolduraAuth>
    );
  }

  const { pedido: dados } = estado;
  return (
    <MolduraAuth rotulo="Conexão" larguraConteudo={480}>
      <div className="consent" style={{ width: "100%", maxWidth: 480 }}>
        <h1 style={estiloTitulo}>{`Conectar o ${dados.cliente} ao Ledgr`}</h1>
        <p style={estiloTexto}>
          {"O pedido vem de "}
          <strong className="consent-host">{dados.origem.host || "um endereço sem nome"}</strong>
          {`. Você está no Ledgr como ${email}.`}
        </p>
        {dados.origem.loopback && (
          <p className="consent-alerta" role="note">
            Este pedido vem de um programa no seu próprio computador. Qualquer programa instalado pode se apresentar com
            esse nome: só autorize se foi você quem começou esta conexão agora.
          </p>
        )}

        <div className="consent-bloco">
          <span className="consent-rotulo">O que poderá fazer</span>
          <p>{dados.descricaoEscopo}</p>
          <p>Só leitura: não confere, não justifica, não fecha mês e não muda nada no Ledgr.</p>
        </div>

        {podeAutorizar ? (
          <fieldset className="consent-bloco consent-empresas" aria-describedby={erro ? idErro : undefined}>
            <legend id={idEmpresas} className="consent-rotulo">
              De qual empresa
            </legend>
            {dados.empresas.map((opcao) => (
              <label key={opcao.id} className="consent-empresa">
                <input
                  type="radio"
                  name="empresa"
                  value={opcao.id}
                  checked={empresa === opcao.id}
                  disabled={enviando !== null}
                  onChange={() => setEmpresa(opcao.id)}
                />
                <span>
                  {opcao.razaoSocial}
                  <span className="consent-cnpj">{cnpjFormatado(opcao.cnpj)}</span>
                </span>
              </label>
            ))}
            <p className="consent-nota">Uma conexão lê uma empresa só. Para outra, conecte de novo.</p>
          </fieldset>
        ) : (
          <p className="consent-alerta" role="note">
            Só o admin ou o gestor da conta autorizam conexões com assistentes de IA. Peça a um deles, ou recuse.
          </p>
        )}

        {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}

        <div className="consent-botoes">
          {podeAutorizar && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={enviando !== null}
              aria-busy={enviando === "autorizar" || undefined}
              onClick={() => void decidir("autorizar")}
            >
              {enviando === "autorizar" ? "Autorizando…" : "Autorizar"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={enviando !== null}
            aria-busy={enviando === "recusar" || undefined}
            onClick={() => void decidir("recusar")}
          >
            {enviando === "recusar" ? "Recusando…" : "Recusar"}
          </button>
        </div>
        <p className="consent-nota">
          {`Este pedido vale até ${hora(dados.expiraEm)}. Depois de autorizar, a conexão aparece em Configurações › Conexões, onde você pode revogá-la a qualquer momento.`}
        </p>
      </div>
    </MolduraAuth>
  );
}
