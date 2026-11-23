"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { ehDataIso, MESES } from "@/lib/adaptadores";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { abrirConfiguracoes } from "@/lib/eventos";
import { comEmpresa } from "@/lib/rotas";
import { useRoteador } from "@/lib/roteador";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { useIntegracaoSistema, usePodeFechar } from "../../conta";
import { importarDoSistema, type FalhaDaImportacaoDoSistema } from "./ia/acoes";
import { ErrosImportacaoIa } from "./ia/erros-importacao-ia";

const ANO_MES_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

/** Mês anterior ao atual em São Paulo (decisão F1): conciliação normalmente fecha o mês que acabou. */
function mesAnterior(agora: Date): { ano: number; mes: number } {
  const [anoStr, mesStr] = ANO_MES_SP.format(agora).split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

/** Primeiro e último dia (`AAAA-MM-DD`) de um mês real. */
function limitesDoMes(ano: number, mes: number): { de: string; ate: string } {
  const mm = String(mes).padStart(2, "0");
  const ultimo = String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, "0");
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${ultimo}` };
}

function dataBr(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

const CODIGOS_TENTAR_DE_NOVO = new Set([
  "sistema_nao_respondeu",
  "sistema_indisponivel",
  "sistema_redirecionou",
  "sistema_endereco_nao_permitido",
]);

const CODIGOS_CONFERIR_URL = new Set(["sistema_redirecionou", "sistema_endereco_nao_permitido"]);

/**
 * Importação direta do extrato do sistema de gestão na Nova conciliação (backend #253):
 * aparece só no modo normal e quando `integracao_sistema_habilitada` vem true do `/me`.
 * Não configurada: atalho para Configurações › Integração (admin/gestor) ou aviso (analista).
 * Configurada: quadro inline curto com o mês (F1) e opção de período menor; sucesso leva em página
 * inteira para a revisão existente (`/conciliacoes/nova/ia/[id]`), evitando a interceptação #260.
 */
export function ImportarDoSistema({
  temArquivoBanco = false,
  hoje,
}: {
  /** Se o extrato do banco já foi escolhido, avisa que ir à revisão pede escolhê-lo de novo (F2). */
  temArquivoBanco?: boolean;
  /** Permite fixar a data atual em testes sem congelar timers do userEvent. */
  hoje?: Date;
}) {
  const { habilitada, configurada } = useIntegracaoSistema();
  const gerencia = usePodeFechar();
  const empresaAtiva = useEmpresaAtiva();
  const roteador = useRoteador();

  const inicial = mesAnterior(hoje ?? new Date());
  const limitesIniciais = limitesDoMes(inicial.ano, inicial.mes);
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(inicial.mes);
  const [ano, setAno] = useState(inicial.ano);
  const [periodoManual, setPeriodoManual] = useState(false);
  const [deManual, setDeManual] = useState(limitesIniciais.de);
  const [ateManual, setAteManual] = useState(limitesIniciais.ate);
  const [buscando, setBuscando] = useState(false);
  const [falha, setFalha] = useState<FalhaDaImportacaoDoSistema | null>(null);
  const travado = useRef(false);
  // se a pessoa sair da tela ou trocar de empresa durante a busca (até 15 s), não redireciona depois
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const idTitulo = useId();
  const idMes = useId();
  const idAno = useId();
  const idDe = useId();
  const idAte = useId();

  if (!habilitada) return null;

  const anos = Array.from({ length: 7 }, (_, i) => inicial.ano + 1 - i);
  const { de: deMes, ate: ateMes } = limitesDoMes(ano, mes);
  const de = periodoManual ? deManual : deMes;
  const ate = periodoManual ? ateManual : ateMes;

  function mudarMesOuAno(proximoAno: number, proximoMes: number) {
    setAno(proximoAno);
    setMes(proximoMes);
    const novos = limitesDoMes(proximoAno, proximoMes);
    setDeManual(novos.de);
    setAteManual(novos.ate);
    setFalha(null);
  }

  async function executarBusca() {
    if (travado.current) return;
    if (!ehDataIso(de) || !ehDataIso(ate) || de > ate) {
      setFalha({
        ok: false,
        status: 422,
        erro: "Escolha um período válido, com a data inicial igual ou anterior à data final.",
        erros: [],
        totalErros: 0,
      });
      return;
    }

    travado.current = true;
    setBuscando(true);
    setFalha(null);

    let resultado: Awaited<ReturnType<typeof importarDoSistema>>;
    try {
      resultado = await importarDoSistema(de, ate);
    } catch {
      resultado = { ok: false, status: 0, erro: SEM_SERVIDOR, erros: [], totalErros: 0 };
    }
    if (!vivo.current) return;

    if (resultado.ok) {
      // página inteira de propósito: na navegação do cliente, o painel do detalhe da linha
      // intercepta /conciliacoes/nova/ia como linha "ia" da conciliação "nova" (#260)
      const destino = comEmpresa(empresaAtiva?.id ?? "", `/conciliacoes/nova/ia/${resultado.dados.importacaoId}`);
      window.location.assign(destino);
      return;
    }

    travado.current = false;
    setBuscando(false);

    // 401 sem `codigo` é sessão expirada; um erro do ERP (ex.: 502 sistema_recusou_a_chave) nunca desloga
    if (!resultado.codigo && resultado.status === 401) {
      roteador.push("/login");
      return;
    }

    if (resultado.codigo === "sistema_resposta_grande_demais") {
      // se a busca veio do modo mês inteiro, sincroniza o período manual com o mês que estourou o limite
      if (!periodoManual) {
        setDeManual(deMes);
        setAteManual(ateMes);
      }
      setPeriodoManual(true);
    }
    setFalha(resultado);
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void executarBusca();
  }

  if (!configurada) {
    return (
      <section className="nova-sistema-card" aria-labelledby={idTitulo}>
        <h3 id={idTitulo} className="font-titulo">
          Importar de um sistema
        </h3>
        {gerencia ? (
          <>
            <p>Busque o extrato do sistema direto pelo mês da conciliação, sem baixar arquivo.</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => abrirConfiguracoes("integracao")}
            >
              Configurar a integração
            </button>
          </>
        ) : (
          <p>Peça a quem administra o Ledgr para configurar a integração.</p>
        )}
      </section>
    );
  }

  const codigo = falha?.codigo;
  const respostaInvalidaComErros = codigo === "sistema_resposta_invalida" && (falha?.erros.length ?? 0) > 0;

  return (
    <section className="nova-sistema-card" aria-labelledby={idTitulo}>
      <h3 id={idTitulo} className="font-titulo">
        Importar de um sistema
      </h3>
      <p>
        Busque o extrato do sistema direto pelo período da conciliação. Você confere as linhas antes de confirmar.
      </p>

      {!aberto ? (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setAberto(true);
            setFalha(null);
          }}
        >
          Importar de um sistema
        </button>
      ) : (
        <form className="nova-sistema-quadro" onSubmit={enviar} noValidate aria-label="Importar de um sistema">
          {!periodoManual ? (
            <div className="nova-sistema-periodo">
              <div className="field">
                <label htmlFor={idMes}>Mês</label>
                <select
                  id={idMes}
                  className="input"
                  value={mes}
                  disabled={buscando}
                  onChange={(evento) => mudarMesOuAno(ano, Number(evento.target.value))}
                >
                  {MESES.map((nome, indice) => (
                    <option key={nome} value={indice + 1}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={idAno}>Ano</label>
                <select
                  id={idAno}
                  className="input"
                  value={ano}
                  disabled={buscando}
                  onChange={(evento) => mudarMesOuAno(Number(evento.target.value), mes)}
                >
                  {anos.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </div>
              <p className="nova-sistema-dica">
                {`Período: ${dataBr(de)} a ${dataBr(ate)} · `}
                <button
                  type="button"
                  className="nova-link"
                  disabled={buscando}
                  onClick={() => {
                    setDeManual(deMes);
                    setAteManual(ateMes);
                    setPeriodoManual(true);
                    setFalha(null);
                  }}
                >
                  Escolher período menor
                </button>
              </p>
            </div>
          ) : (
            <div className="nova-sistema-periodo">
              <div className="field">
                <label htmlFor={idDe}>Data inicial</label>
                <input
                  id={idDe}
                  className="input"
                  type="date"
                  value={deManual}
                  disabled={buscando}
                  onChange={(evento) => {
                    setDeManual(evento.target.value);
                    setFalha(null);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor={idAte}>Data final</label>
                <input
                  id={idAte}
                  className="input"
                  type="date"
                  value={ateManual}
                  disabled={buscando}
                  onChange={(evento) => {
                    setAteManual(evento.target.value);
                    setFalha(null);
                  }}
                />
              </div>
              <p className="nova-sistema-dica">
                <button
                  type="button"
                  className="nova-link"
                  disabled={buscando}
                  onClick={() => {
                    setPeriodoManual(false);
                    setFalha(null);
                  }}
                >
                  Usar mês inteiro
                </button>
              </p>
            </div>
          )}

          {temArquivoBanco && (
            <p className="nova-sistema-dica">
              Você vai conferir os lançamentos em outra tela. Na volta, será preciso escolher o extrato do banco de novo.
            </p>
          )}

          <div className="cfg-form-botoes">
            <button type="submit" className="btn btn-primary" disabled={buscando}>
              {buscando ? "Buscando no sistema…" : "Buscar no sistema"}
              {!buscando && <ArrowRight aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={buscando}
              onClick={() => {
                setAberto(false);
                setFalha(null);
              }}
            >
              Cancelar
            </button>
          </div>

          {falha && (
            <div
              className={respostaInvalidaComErros ? "nova-sistema-erro-lista" : "nova-sistema-erro"}
              role={respostaInvalidaComErros ? undefined : "alert"}
            >
              {codigo === "sistema_recusou_a_chave" && (
                <>
                  <strong className="nova-sistema-erro-titulo">Chave recusada</strong>
                  <p>{falha.erro}</p>
                  {gerencia ? (
                    <div className="cfg-form-botoes">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => abrirConfiguracoes("integracao")}
                      >
                        Abrir Configurações › Integração
                      </button>
                    </div>
                  ) : (
                    <p>Avise quem administra o Ledgr para conferir a chave da integração.</p>
                  )}
                </>
              )}

              {codigo && CODIGOS_TENTAR_DE_NOVO.has(codigo) && (
                <>
                  <p>{falha.erro}</p>
                  <div className="cfg-form-botoes">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={buscando}
                      onClick={() => void executarBusca()}
                    >
                      Tentar de novo
                    </button>
                    {gerencia && CODIGOS_CONFERIR_URL.has(codigo) && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => abrirConfiguracoes("integracao")}
                      >
                        Conferir em Configurações › Integração
                      </button>
                    )}
                  </div>
                </>
              )}

              {codigo === "sistema_resposta_grande_demais" && (
                <>
                  <p>{falha.erro}</p>
                  <p>Ajuste as datas acima para um período menor e tente de novo.</p>
                </>
              )}

              {codigo === "sistema_resposta_invalida" &&
                (respostaInvalidaComErros ? (
                  <>
                    <strong className="nova-sistema-erro-titulo">JSON inválido</strong>
                    <ErrosImportacaoIa
                      erro={falha.erro}
                      erros={falha.erros}
                      totalErros={falha.totalErros}
                      nivelTitulo="h4"
                      orientacao="Confira os pontos abaixo na resposta do sistema de gestão e tente de novo, ou envie o arquivo CSV."
                    />
                  </>
                ) : (
                  <>
                    <strong className="nova-sistema-erro-titulo">JSON inválido</strong>
                    <p>{falha.erro}</p>
                  </>
                ))}

              {codigo === "integracao_nao_configurada" && (
                <>
                  <p>{falha.erro}</p>
                  {gerencia ? (
                    <div className="cfg-form-botoes">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => abrirConfiguracoes("integracao")}
                      >
                        Configurar a integração
                      </button>
                    </div>
                  ) : (
                    <p>Avise quem administra o Ledgr para configurar a integração.</p>
                  )}
                </>
              )}

              {(!codigo ||
                (codigo !== "sistema_recusou_a_chave" &&
                  !CODIGOS_TENTAR_DE_NOVO.has(codigo) &&
                  codigo !== "sistema_resposta_grande_demais" &&
                  codigo !== "sistema_resposta_invalida" &&
                  codigo !== "integracao_nao_configurada")) && <p>{falha.erro}</p>}

              <p className="nova-sistema-dica">Ou envie o arquivo CSV manualmente na folha acima.</p>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
