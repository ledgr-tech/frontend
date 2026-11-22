"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Building2, ChevronsUpDown, Star } from "lucide-react";
import LinkDoApp from "@/lib/link-do-app";
import { useEmpresaAtiva, useEmpresasDaConta, type EmpresaDaConta } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import { useRoteador } from "@/lib/roteador";
import { destinoDaTroca } from "@/lib/rotas";
import type { SituacaoDaEmpresa } from "@/lib/adaptadores";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { caracteresCnpj, formatarCnpj } from "../../../(auth)/cadastro/passos";
import { carregarEmpresas, marcarFavorita } from "./empresas/acoes";
import { ModalDaTela } from "./empresas/modal-da-tela";

/** Quantas empresas cabem numa página da janela (mentoria de 26/10, #223). */
export const POR_PAGINA = 20;

type Coluna = "razaoSocial" | "cnpj" | "situacao";

/** A linha da janela: a empresa do `GET /me` e, depois que o `GET /empresas` responde, a favorita e a situação (backend #157). */
type Linha = EmpresaDaConta & { favorita?: boolean; situacao?: SituacaoDaEmpresa };

export const SITUACAO: Record<SituacaoDaEmpresa, string> = {
  em_aberto: "Mês em aberto",
  fechado: "Mês fechado",
  sem_conciliacao: "Sem conciliação",
};

function valorDaColuna(linha: Linha, coluna: Coluna): string {
  return coluna === "situacao" ? (linha.situacao ? SITUACAO[linha.situacao] : "") : linha[coluna];
}
type Ordem = { coluna: Coluna; crescente: boolean };

function Cabeca({ coluna, ordem, onOrdenar, children }: { coluna: Coluna; ordem: Ordem; onOrdenar: (coluna: Coluna) => void; children: string }) {
  const ativa = ordem.coluna === coluna;
  return (
    <th scope="col" aria-sort={ativa ? (ordem.crescente ? "ascending" : "descending") : "none"}>
      <button type="button" className="th-ordena" onClick={() => onOrdenar(coluna)}>
        {children}
        <span className="th-ordena-seta" aria-hidden="true">
          {ativa ? (ordem.crescente ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

/** A busca da janela e da tela Empresas: pela razão social ou pelo CNPJ, com ou sem a máscara. */
export function combina(empresa: { razaoSocial: string; cnpj: string }, termo: string): boolean {
  const procurado = termo.trim().toLowerCase();
  if (!procurado) return true;
  // o CNPJ pode ter letras (o alfanumérico), mas só um termo com dígito procura nele: "Ana" é nome
  const cnpjProcurado = caracteresCnpj(termo);
  // o maior trecho de dígitos seguidos (a máscara . / - pode ficar no meio): "Posto 12 Rua 345" não vira 12345
  const digitos = (termo.match(/\d[\d./-]*\d|\d/g) ?? [])
    .map((trecho) => trecho.replace(/\D/g, ""))
    .reduce((maior, atual) => (atual.length > maior.length ? atual : maior), "");
  const cnpj = caracteresCnpj(empresa.cnpj);
  return (
    empresa.razaoSocial.toLowerCase().includes(procurado) ||
    (/\d/.test(cnpjProcurado) && cnpj.includes(cnpjProcurado)) ||
    // "cnpj 12345", "Loja 12.345": o trecho numérico procura no CNPJ; "Empresa 4" e "AB12" seguem só nome
    (digitos.length >= 5 && cnpj.includes(digitos))
  );
}

/**
 * A estrela muda na hora e só a resposta do último clique decide. Uma falha volta ao último valor que o
 * backend confirmou, não ao contrário do clique: com dois cliques que falham, isso seria um valor que
 * nunca foi gravado.
 */
export function useFavoritaOtimista() {
  const versoes = useRef(new Map<string, number>());
  const confirmadas = useRef(new Map<string, { versao: number; favorita: boolean }>());
  // a versão do último clique que já voltou com falha: depois dela, um ok mais antigo é o que ficou gravado
  const falhou = useRef(new Map<string, number>());

  /** Antes de mudar a estrela: `antes` é o que ela mostrava, confirmado se nada estava a caminho. */
  function comecar(id: string, antes: boolean): number {
    if (!confirmadas.current.has(id)) confirmadas.current.set(id, { versao: 0, favorita: antes });
    const versao = (versoes.current.get(id) ?? 0) + 1;
    versoes.current.set(id, versao);
    return versao;
  }

  /** Depois da resposta. Devolve o valor para onde a estrela vai, ou null quando fica como está. */
  function terminar(id: string, versao: number, favorita: boolean, ok: boolean): boolean | null {
    const ultima = versoes.current.get(id);
    if (ok) {
      // a ordem é a dos cliques, não a da chegada: um ok antigo não apaga a confirmação mais nova
      if (versao <= (confirmadas.current.get(id)?.versao ?? 0)) return null;
      confirmadas.current.set(id, { versao, favorita });
      // um ok antigo que chega depois da falha do último clique: o backend ficou com este valor
      return versao !== ultima && falhou.current.get(id) === ultima ? favorita : null;
    }
    if (versao !== ultima) return null;
    falhou.current.set(id, versao);
    return confirmadas.current.get(id)?.favorita ?? !favorita;
  }

  async function alternar(
    empresa: { id: string; favorita?: boolean },
    marcar: (favorita: boolean) => void,
    avisar: (erro: string | null) => void,
  ) {
    const favorita = !empresa.favorita;
    const versao = comecar(empresa.id, !favorita);
    marcar(favorita);
    avisar(null);
    const resposta = await marcarFavorita(empresa.id, favorita).catch(
      (): Awaited<ReturnType<typeof marcarFavorita>> => ({ ok: false, status: 0, erro: SEM_SERVIDOR }),
    );
    // um clique mais novo já decidiu a estrela: a resposta deste não desfaz nem avisa
    const volta = terminar(empresa.id, versao, favorita, resposta.ok);
    if (volta === null) return;
    marcar(volta);
    if (!resposta.ok) avisar(resposta.erro);
  }

  return { comecar, terminar, alternar };
}

/**
 * O seletor de empresa no topo da tela, ao lado de Avisos (mentoria de 26/10, #223; antes ficava na barra
 * lateral, que cortava o nome). Mostra a empresa da aba e abre uma janela com a tabela das empresas da
 * conta: busca por razão social ou CNPJ, ordem pelas colunas e 20 por página. Trocar leva à mesma tela da
 * outra empresa (de uma tela com id, à raiz da seção) e lembra a escolha no cookie que só serve de destino
 * das URLs sem empresa. Ao abrir, a janela mostra as empresas do `GET /me` e lê o `GET /empresas`, que traz
 * as favoritas da pessoa (sempre no topo, com a estrela para marcar) e a situação do mês (backend #157);
 * sem ele (backend anterior, ou se falhar) fica como estava.
 */
export function SeletorDeEmpresa() {
  const ativa = useEmpresaAtiva();
  const [aberto, setAberto] = useState(false);
  if (!ativa) return null;

  return (
    <>
      <button
        type="button"
        className="seletor-topo-botao"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title={ativa.razaoSocial || undefined}
        onClick={() => setAberto(true)}
      >
        <Building2 size={16} aria-hidden="true" className="seletor-topo-icone" />
        <span className="seletor-topo-nome">
          {/* sem o GET /me não há nome: o botão diz o que faz, em vez de ficar só com o ícone (#388) */}
          {ativa.razaoSocial ? (
            <>
              <span className="sr-only">Empresa:</span> {ativa.razaoSocial}
            </>
          ) : (
            "Trocar de empresa"
          )}
        </span>
        <ChevronsUpDown size={15} aria-hidden="true" className="seletor-topo-seta" />
      </button>
      {aberto && <JanelaDeEmpresas ativa={ativa} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function JanelaDeEmpresas({ ativa, aoFechar }: { ativa: EmpresaDaConta; aoFechar: () => void }) {
  const daConta = useEmpresasDaConta();
  const [carregadas, setCarregadas] = useState<Linha[] | null>(null);
  const [erroDaFavorita, setErroDaFavorita] = useState<string | null>(null);
  const favoritaOtimista = useFavoritaOtimista();
  const empresas: Linha[] = carregadas ?? daConta;
  const temFavoritas = empresas.some((empresa) => empresa.favorita !== undefined);
  // sem a situação do mês (backend antes do #157, ou o GET /empresas falhou) a coluna ficaria vazia (#388)
  const temSituacao = empresas.some((empresa) => empresa.situacao !== undefined);
  const roteador = useRoteador();
  const caminho = usePathname();
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "razaoSocial", crescente: true });
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    let vale = true;
    carregarEmpresas().then((resposta) => {
      if (vale && resposta.ok) setCarregadas(resposta.dados);
    });
    return () => {
      vale = false;
    };
  }, []);

  const ordenadas = useMemo(() => {
    const sentido = ordem.crescente ? 1 : -1;
    return empresas
      .filter((empresa) => combina(empresa, busca))
      .sort(
        (a, b) =>
          // as favoritas sempre primeiro; a ordem escolhida vale dentro de cada grupo, como no backend
          Number(Boolean(b.favorita)) - Number(Boolean(a.favorita)) ||
          sentido * valorDaColuna(a, ordem.coluna).localeCompare(valorDaColuna(b, ordem.coluna), "pt-BR", { sensitivity: "base" }),
      );
  }, [empresas, busca, ordem]);
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = ordenadas.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);

  function escolher(empresa: EmpresaDaConta) {
    aoFechar();
    if (empresa.id === ativa.id) return;
    gravarEmpresaRecente(empresa.id);
    roteador.push(destinoDaTroca(caminho, empresa.id));
  }

  function alternarFavorita(empresa: Linha) {
    return favoritaOtimista.alternar(
      empresa,
      (valor) => setCarregadas((atuais) => atuais && atuais.map((outra) => (outra.id === empresa.id ? { ...outra, favorita: valor } : outra))),
      setErroDaFavorita,
    );
  }

  function ordenar(coluna: Coluna) {
    setOrdem((atual) => ({ coluna, crescente: atual.coluna === coluna ? !atual.crescente : true }));
    setPagina(0);
  }

  return (
    <ModalDaTela titulo="Trocar de empresa" aoFechar={aoFechar}>
      <div className="seletor-janela">
        <input
          type="search"
          className="input"
          aria-label="Buscar por razão social ou CNPJ"
          placeholder="Buscar por razão social ou CNPJ"
          autoComplete="off"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
            setPagina(0);
          }}
        />
        {erroDaFavorita && (
          <p role="alert" className="seletor-janela-vazio">
            {erroDaFavorita}
          </p>
        )}
        {visiveis.length === 0 ? (
          <p className="seletor-janela-vazio">Nenhuma empresa encontrada.</p>
        ) : (
          <div className="dash-tabela-rolagem">
            <table className="table seletor-janela-tabela">
              <thead>
                <tr>
                  <Cabeca coluna="razaoSocial" ordem={ordem} onOrdenar={ordenar}>
                    Empresa
                  </Cabeca>
                  <Cabeca coluna="cnpj" ordem={ordem} onOrdenar={ordenar}>
                    CNPJ
                  </Cabeca>
                  {temSituacao && (
                    <Cabeca coluna="situacao" ordem={ordem} onOrdenar={ordenar}>
                      Situação
                    </Cabeca>
                  )}
                  {temFavoritas && (
                    <th scope="col" className="seletor-janela-favorita">
                      <span className="sr-only">Favorita</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((empresa) => (
                  <tr key={empresa.id} aria-current={empresa.id === ativa.id || undefined}>
                    <td>
                      <button type="button" className="seletor-janela-escolher" onClick={() => escolher(empresa)}>
                        {empresa.razaoSocial}
                      </button>
                      {!temSituacao && empresa.id === ativa.id && (
                        <>
                          {" "}
                          <span className="tag tag-accent">Aberta agora</span>
                        </>
                      )}
                      {/* no celular a tabela fica numa coluna só, com o CNPJ embaixo do nome */}
                      {empresa.cnpj && <span className="seletor-janela-cnpj-celular">{formatarCnpj(empresa.cnpj)}</span>}
                    </td>
                    <td className="seletor-janela-cnpj">{empresa.cnpj ? formatarCnpj(empresa.cnpj) : "—"}</td>
                    {temSituacao && (
                      <td>
                        <span className="seletor-janela-situacao">
                          {empresa.situacao && SITUACAO[empresa.situacao]}
                          {empresa.id === ativa.id && <span className="tag tag-accent">Aberta agora</span>}
                        </span>
                      </td>
                    )}
                    {temFavoritas && (
                      <td className="seletor-janela-favorita">
                        <button
                          type="button"
                          className="seletor-janela-estrela"
                          aria-pressed={Boolean(empresa.favorita)}
                          aria-label={`Favorita: ${empresa.razaoSocial}`}
                          title={empresa.favorita ? "Tirar das favoritas" : "Favoritar"}
                          onClick={() => alternarFavorita(empresa)}
                        >
                          <Star size={16} aria-hidden="true" fill={empresa.favorita ? "currentColor" : "none"} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="seletor-janela-rodape">
          {totalPaginas > 1 ? (
            <div className="seletor-janela-paginas">
              <button type="button" className="btn btn-secondary" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>
                Anterior
              </button>
              <span className="paginacao-conta">
                {paginaAtual + 1} / {totalPaginas}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={paginaAtual >= totalPaginas - 1}
                onClick={() => setPagina(paginaAtual + 1)}
              >
                Próxima
              </button>
            </div>
          ) : (
            <span />
          )}
          <LinkDoApp href="/empresas" className="btn btn-ghost" onClick={aoFechar}>
            <Building2 size={16} aria-hidden="true" />
            Gerenciar empresas
          </LinkDoApp>
        </div>
      </div>
    </ModalDaTela>
  );
}
