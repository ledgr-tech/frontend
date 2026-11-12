import { createHash } from "node:crypto";
import type { FuncaoDaAjuda, PaginaDeAjuda } from "./paginas";

/** O que o assistente do backend lê da Central (backend #137): o texto, sem imagem nem vídeo. */
export type ConteudoDaAjuda = {
  versao: string;
  paginas: {
    id: string;
    titulo: string;
    onde: string;
    serve: string;
    funcoes: { id: string; titulo: string; faz: string; passos?: string[]; nota?: string }[];
  }[];
};

/**
 * A Central em JSON, no formato que o backend valida (`app/services/ajuda/conteudo.py` de lá). A versão
 * é o hash do próprio texto: muda só quando a Central muda, e o backend sabe que a cópia dele é velha.
 */
export function conteudoDaAjuda(paginas: PaginaDeAjuda[]): ConteudoDaAjuda {
  const texto = paginas.map((pagina) => ({
    id: pagina.id,
    titulo: pagina.titulo,
    onde: pagina.onde,
    serve: pagina.serve,
    funcoes: pagina.funcoes.map((funcao) => {
      const passos = passosEmTexto(funcao);
      return {
        id: funcao.id,
        titulo: funcao.titulo,
        faz: funcao.faz,
        ...(passos.length > 0 && { passos }),
        ...(funcao.nota && { nota: funcao.nota }),
      };
    }),
  }));
  const versao = createHash("sha256").update(JSON.stringify(texto)).digest("hex").slice(0, 12);
  return { versao, paginas: texto };
}

/** As colunas, os passos e as abas viram passos de texto: o formato que o backend valida não muda. O `link` fica de fora. */
function passosEmTexto(funcao: FuncaoDaAjuda): string[] {
  return [
    ...(funcao.itens ?? []).map((item) => `${item.titulo}: ${item.texto}`),
    ...(funcao.passos ?? []),
    ...(funcao.abas ?? []).flatMap((aba) =>
      aba.passos.map((passo) => `${aba.rotulo}, ${passo.titulo}: ${passo.texto} Deu certo quando ${passo.certo}`),
    ),
  ];
}
