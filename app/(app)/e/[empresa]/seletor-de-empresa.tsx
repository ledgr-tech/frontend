"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Building2, ChevronsUpDown, Star } from "lucide-react";
import LinkDoApp from "@/lib/link-do-app";
import { useEmpresaAtiva, useEmpresasDaConta, type EmpresaDaConta } from "@/lib/empresa-ativa";
import { gravarEmpresaRecente } from "@/lib/empresa-recente";
import { useRoteador } from "@/lib/roteador";
import { destinoDaTroca } from "@/lib/rotas";
import type { SituacaoDaEmpresa } from "@/lib/adaptadores";
import { formatarCnpj } from "../../../(auth)/cadastro/passos";
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
  const digitos = procurado.replace(/\D/g, "");
  return (
    empresa.razaoSocial.toLowerCase().includes(procurado) ||
    formatarCnpj(empresa.cnpj).includes(procurado) ||
    (digitos !== "" && empresa.cnpj.replace(/\D/g, "").includes(digitos))
  );
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
        title={ativa.razaoSocial}
        onClick={() => setAberto(true)}
      >
        <Building2 size={16} aria-hidden="true" className="seletor-topo-icone" />
        <span className="seletor-topo-nome">
          <span className="sr-only">Empresa:</span> {ativa.razaoSocial}
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
  const empresas: Linha[] = carregadas ?? daConta;
  const temFavoritas = empresas.some((empresa) => empresa.favorita !== undefined);
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

  async function alternarFavorita(empresa: Linha) {
    const favorita = !empresa.favorita;
    const marcar = (valor: boolean) =>
      setCarregadas((atuais) => atuais && atuais.map((outra) => (outra.id === empresa.id ? { ...outra, favorita: valor } : outra)));
    // muda na hora e desfaz se o backend recusar, para a estrela responder ao clique
    marcar(favorita);
    setErroDaFavorita(null);
    const resposta = await marcarFavorita(empresa.id, favorita);
    if (!resposta.ok) {
      marcar(!favorita);
      setErroDaFavorita(resposta.erro);
    }
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
                  <Cabeca coluna="situacao" ordem={ordem} onOrdenar={ordenar}>
                    Situação
                  </Cabeca>
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
                      {/* no celular a tabela fica numa coluna só, com o CNPJ embaixo do nome */}
                      {empresa.cnpj && <span className="seletor-janela-cnpj-celular">{formatarCnpj(empresa.cnpj)}</span>}
                    </td>
                    <td className="seletor-janela-cnpj">{empresa.cnpj ? formatarCnpj(empresa.cnpj) : "—"}</td>
                    <td>
                      <span className="seletor-janela-situacao">
                        {empresa.situacao && SITUACAO[empresa.situacao]}
                        {empresa.id === ativa.id && <span className="tag">Aberta agora</span>}
                      </span>
                    </td>
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
