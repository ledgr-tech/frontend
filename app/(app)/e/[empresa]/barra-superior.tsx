"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/lib/link-do-app";
import { useRoteador } from "@/lib/roteador";
import { SeletorDeEmpresa } from "./seletor-de-empresa";
import { MenuDeAjuda } from "./ajuda/menu-de-ajuda";
import { diasRestantes, fraseCurtaDoTeste, fraseDoTeste } from "@/lib/assinatura";
import { useAssinatura } from "./conta";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { useTeclaDeAtalho } from "@/lib/plataforma";
import { usePresenca } from "@/lib/troca-suave";
import { formatarMoeda } from "@/lib/mock-data";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { avisosDoMes, idsLidos, marcarLidos } from "./avisos";
import { carregarVisaoGeral, type VisaoGeral } from "./conciliacoes/acoes";
import { buscarLancamentos, type AchadoDaBusca, type PaginaDaBusca } from "./busca/acoes";
import { mesDaLista } from "./dashboard/lista";
import { data as formatarData } from "./saldo";

type LeituraDaBusca = {
  termo: string;
  empresaId: string | undefined;
  itens: AchadoDaBusca[];
  total: number;
  proximoOffset: number;
  lendoMais: boolean;
  erro: string | null;
};

function consultarBusca(termo: string, offset = 0) {
  return buscarLancamentos(termo, offset).catch(() => ({ ok: false as const, status: 0, erro: SEM_SERVIDOR }));
}

function proximoOffset(pagina: PaginaDaBusca): number {
  // a página conta também os itens malformados descartados pela action; não volta a buscá-los
  return pagina.offset + pagina.limit;
}

const BUSCA_VAZIA = "Nada encontrado. Tente o valor sem centavos, a data (13/10) ou parte do nome do fornecedor.";

type Leitura = { situacao: "lendo" } | { situacao: "falhou" } | { situacao: "pronta"; visao: VisaoGeral };

// O tema e a conta (nome, empresa e Sair) moram no rodapé do menu lateral.
export function BarraSuperior({ contaInativa = false }: { contaInativa?: boolean }) {
  const assinatura = useAssinatura();
  const empresaId = useEmpresaAtiva()?.id;
  const diasDeTeste =
    assinatura?.situacao === "teste" && assinatura.testeTerminaEm ? diasRestantes(assinatura.testeTerminaEm, new Date()) : null;
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState<LeituraDaBusca | null>(null);
  const pedidoDaBusca = useRef(0);
  const pedidoDeMais = useRef<number | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const presencaDosAvisos = usePresenca(avisosAbertos);
  const [leitura, setLeitura] = useState<Leitura>({ situacao: "lendo" });
  const [lidos, setLidos] = useState<string[]>([]);
  const tecla = useTeclaDeAtalho();
  // qual resultado a seta está apontando; -1 = nenhum
  const [ativo, setAtivo] = useState(-1);
  const router = useRoteador();
  const buscaRef = useRef<HTMLInputElement>(null);
  const caixaBusca = useRef<HTMLDivElement>(null);
  const caixaAvisos = useRef<HTMLDivElement>(null);
  const botaoAvisos = useRef<HTMLButtonElement>(null);

  // Os avisos leem a conciliação mais recente, a mesma da visão geral.
  // ponytail: uma leitura por carga da página — a barra vive no layout e não
  // remonta ao trocar de tela, então uma conciliação nova só aparece aqui ao
  // recarregar. A busca é independente, pelo GET /busca em todas as conciliações.
  useEffect(() => {
    let vivo = true;
    carregarVisaoGeral()
      .then((resposta) => {
        if (!vivo) return;
        setLidos(idsLidos(empresaId));
        setLeitura(resposta.ok ? { situacao: "pronta", visao: resposta.dados } : { situacao: "falhou" });
      })
      .catch(() => vivo && setLeitura({ situacao: "falhou" }));
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  const visao = leitura.situacao === "pronta" ? leitura.visao : null;
  const avisos = useMemo(() => (visao ? avisosDoMes(visao) : []), [visao]);
  useEffect(() => {
    const pedido = pedidoDaBusca.current + 1;
    pedidoDaBusca.current = pedido;
    if (!termo.trim()) return;
    const timer = setTimeout(() => {
      setAtivo(-1);
      startTransition(async () => {
        const resposta = await consultarBusca(termo.trim());
        if (pedido !== pedidoDaBusca.current) return;
        setBusca({
          termo, empresaId, lendoMais: false,
          itens: resposta.ok ? resposta.dados.itens : [],
          total: resposta.ok ? resposta.dados.total : 0,
          proximoOffset: resposta.ok ? proximoOffset(resposta.dados) : 0,
          erro: resposta.ok ? null : resposta.erro,
        });
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      // a Server Action não se cancela: uma resposta de outra empresa/termo não pode entrar
      ++pedidoDaBusca.current;
    };
  }, [termo, empresaId]);

  // ⌘K / Ctrl+K põe o foco na busca, como o atalho que a caixa anuncia.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() === "k" && (evento.metaKey || evento.ctrlKey)) {
        evento.preventDefault();
        buscaRef.current?.focus();
      }
      if (evento.key === "Escape") {
        setBuscaAberta(false);
        setAvisosAbertos(false);
        // fechado de dentro, o foco volta ao botão em vez de cair no <body> (AC-02)
        if (caixaAvisos.current?.contains(document.activeElement)) botaoAvisos.current?.focus();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!caixaBusca.current?.contains(alvo)) setBuscaAberta(false);
      if (!caixaAvisos.current?.contains(alvo)) setAvisosAbertos(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const atual = busca?.termo === termo && busca.empresaId === empresaId ? busca : null;
  const achados = atual?.itens ?? [];

  function verMais() {
    if (!atual || atual.lendoMais || atual.proximoOffset >= atual.total || pedidoDeMais.current === pedidoDaBusca.current) return;
    const pedido = ++pedidoDaBusca.current;
    pedidoDeMais.current = pedido;
    setBusca({ ...atual, lendoMais: true, erro: null });
    startTransition(async () => {
      const resposta = await consultarBusca(termo.trim(), atual.proximoOffset);
      if (pedidoDeMais.current === pedido) pedidoDeMais.current = null;
      if (pedido !== pedidoDaBusca.current) return;
      setBusca(resposta.ok ? {
        ...atual,
        // uma inserção entre páginas pode repetir uma linha; ela não aparece duas vezes
        itens: [...new Map([...atual.itens, ...resposta.dados.itens].map((item) => [item.id, item])).values()],
        total: resposta.dados.total,
        proximoOffset: proximoOffset(resposta.dados),
        lendoMais: false,
        erro: null,
      } : { ...atual, lendoMais: false, erro: resposta.erro });
    });
  }

  const naoLidos = avisos.filter((aviso) => !lidos.includes(aviso.id)).length;

  function lerTodos() {
    const ids = avisos.map((aviso) => aviso.id);
    marcarLidos(ids, empresaId);
    setLidos(ids);
  }

  const painelAberto = buscaAberta && termo.trim() !== "";
  const lendoBusca = painelAberto && atual === null;
  const anuncioDaBusca = !painelAberto ? "" : lendoBusca ? "Buscando…" : atual?.lendoMais ? "Buscando mais…"
    : atual?.erro ?? (achados.length > 0 ? `${achados.length} ${achados.length === 1 ? "resultado" : "resultados"}` : "Nada encontrado");

  function aoTeclarNaBusca(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (!painelAberto || achados.length === 0) return;
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAtivo((i) => (i + 1) % achados.length);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAtivo((i) => (i <= 0 ? achados.length - 1 : i - 1));
    } else if (evento.key === "Enter" && ativo >= 0 && achados[ativo]) {
      evento.preventDefault();
      const alvo = achados[ativo];
      setBuscaAberta(false);
      router.push(alvo.href);
    }
  }

  return (
    <div className="app-topo">
      <div className="app-busca-envelope" ref={caixaBusca}>
        <div className="app-busca">
          <span aria-hidden="true" className="app-busca-lupa">
            ⌕
          </span>
          <input
            ref={buscaRef}
            type="text"
            role="combobox"
            className="input app-busca-campo"
            aria-label="Buscar lançamento"
            aria-expanded={painelAberto}
            aria-controls="busca-resultados"
            aria-autocomplete="list"
            aria-activedescendant={
              painelAberto && ativo >= 0 && achados[ativo] ? `busca-opcao-${ativo}` : undefined
            }
            onKeyDown={aoTeclarNaBusca}
            placeholder="Buscar valor, fornecedor ou data…"
            value={termo}
            onChange={(evento) => {
              ++pedidoDaBusca.current;
              setTermo(evento.target.value);
              setBusca(null);
              setBuscaAberta(true);
              setAtivo(-1);
            }}
            onFocus={() => setBuscaAberta(true)}
          />
          <span aria-hidden="true" className="app-busca-atalho">
            {tecla === "⌘" ? "⌘K" : "Ctrl K"}
          </span>
        </div>

        {/* já montado antes da primeira tecla: o leitor de tela ouve também o primeiro resultado */}
        <p role="status" className="sr-only">{anuncioDaBusca}</p>

        {painelAberto && (
          <div className="app-painel app-busca-painel">
            {lendoBusca && <p className="app-busca-vazio">Buscando…</p>}
            {atual?.erro && <p className="app-busca-vazio">{atual.erro}</p>}
            {atual && !atual.erro && achados.length === 0 && <p className="app-busca-vazio">{BUSCA_VAZIA}</p>}
            <div id="busca-resultados" role="listbox" aria-label="Resultados da busca" aria-busy={lendoBusca || atual?.lendoMais || undefined}>
              {achados.map((achado, i) => (
                <Link
                  key={achado.id}
                  id={`busca-opcao-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  data-ativo={i === ativo ? "true" : undefined}
                  href={achado.href}
                  className="app-busca-achado"
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => setBuscaAberta(false)}
                >
                  <span className="app-busca-achado-titulo">{achado.descricao}</span>
                  <span className="app-busca-achado-detalhe">
                    {formatarData(achado.data)} · {formatarMoeda(achado.valor)}
                    {achado.competencia && <> · <span className="tag tag-outline">{mesDaLista(achado.competencia)}</span></>}
                  </span>
                </Link>
              ))}
            </div>
            {atual && atual.proximoOffset < atual.total && (
              <button type="button" className="btn btn-ghost app-busca-mais" style={{ margin: "8px 16px" }} disabled={atual.lendoMais} onClick={verMais}>
                {atual.lendoMais ? "Buscando mais…" : "Ver mais"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* o teste de 14 dias (spec 2026-10-15-primeiro-uso, parte 2); sem a informação, nada. No
          celular vai a frase curta, para caber na linha do "?" e de Avisos; o leitor de tela ouve a inteira */}
      {diasDeTeste !== null && (
        <SeloDoTeste href="/assinatura" frase={fraseDoTeste(diasDeTeste)} curta={fraseCurtaDoTeste(diasDeTeste)} />
      )}
      {assinatura && assinatura.situacao in SELOS_DE_RISCO && (
        <SeloDoTeste href="/assinatura" risco {...SELOS_DE_RISCO[assinatura.situacao as keyof typeof SELOS_DE_RISCO]} />
      )}
      {/* a conta inativa (backend #156): só depois de uma escrita recusada, que é quando a tela sabe */}
      {contaInativa && (
        <a
          href="mailto:ledgrtech@gmail.com?subject=Reativar%20a%20conta"
          className="selo selo-risco app-teste"
          aria-label="Conta inativa · falar com o Ledgr"
        >
          <span className="app-teste-longo">Conta inativa · falar com o Ledgr</span>
          <span className="app-teste-curto" aria-hidden="true">
            Conta inativa
          </span>
        </a>
      )}

      <MenuDeAjuda />

      {/* a empresa da aba, ao lado de Avisos (#223): na barra lateral o nome cortava */}
      <SeletorDeEmpresa />

      <div className="app-avisos-envelope" ref={caixaAvisos}>
        <button
          ref={botaoAvisos}
          type="button"
          className="app-avisos-botao"
          aria-haspopup="dialog"
          aria-expanded={avisosAbertos}
          aria-controls={avisosAbertos ? "painel-avisos" : undefined}
          onClick={() => setAvisosAbertos((aberto) => !aberto)}
        >
          <span>Avisos</span>
          {/* o espaço separa "Avisos" da conta no nome que o leitor de tela lê */}
          {" "}
          {/* a conta só depois da leitura: um zero antes dela seria chute */}
          {visao && (
            <span className={naoLidos > 0 ? "app-avisos-conta app-avisos-conta-ativa" : "app-avisos-conta"}>
              {naoLidos}
            </span>
          )}
        </button>

        {presencaDosAvisos.montado && (
          <div id="painel-avisos" role="dialog" aria-label="Avisos" className="app-painel app-avisos-painel" data-saindo={presencaDosAvisos.saindo || undefined}>
            <div className="app-avisos-topo">
              <span className="app-avisos-titulo">Avisos</span>
              {naoLidos > 0 && (
                <button type="button" className="btn btn-ghost app-avisos-ler" onClick={lerTodos}>
                  Marcar como lidos
                </button>
              )}
            </div>
            {leitura.situacao === "lendo" && <p className="app-avisos-vazio">Lendo a última conciliação…</p>}
            {leitura.situacao === "falhou" && (
              <p className="app-avisos-vazio" role="alert">
                Não foi possível ler os avisos agora.
              </p>
            )}
            {visao && avisos.length === 0 && <p className="app-avisos-vazio">Nenhum aviso agora.</p>}
            {avisos.map((aviso) => (
              <Link
                key={aviso.id}
                href={aviso.href}
                className="app-aviso app-aviso-link"
                data-lido={lidos.includes(aviso.id) ? "true" : undefined}
                onClick={() => setAvisosAbertos(false)}
              >
                <span className={`app-aviso-ponto app-aviso-ponto-${aviso.tom}`} aria-hidden="true" />
                <span className="app-aviso-corpo">
                  <span className="app-aviso-titulo">{aviso.titulo}</span>
                  <span className="app-aviso-texto">{aviso.texto}</span>
                  <span className="app-aviso-quando">{aviso.quando}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** O que a conta precisa resolver na Assinatura (backend #180), em tom de risco. */
const SELOS_DE_RISCO = {
  teste_encerrado: { frase: "Seu teste acabou · assinar um plano", curta: "Teste acabou" },
  assinatura_encerrada: { frase: "Assinatura encerrada · assinar de novo", curta: "Encerrada" },
  pagamento_pendente: { frase: "Pagamento pendente", curta: "Pagamento" },
};

function SeloDoTeste({ href, frase, curta, risco = false }: { href: string; frase: string; curta: string; risco?: boolean }) {
  return (
    <Link href={href} className={risco ? "selo selo-risco app-teste" : "selo app-teste"} aria-label={frase}>
      <span className="app-teste-longo">{frase}</span>
      <span className="app-teste-curto" aria-hidden="true">
        {curta}
      </span>
    </Link>
  );
}
