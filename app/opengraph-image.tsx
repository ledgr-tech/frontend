import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * A prévia de quando o link do Ledgr é colado no WhatsApp, no LinkedIn ou no
 * e-mail. Gerada no build (é estática) e usada por todas as páginas.
 *
 * As fontes vêm do Google Fonts no build, como as do `next/font`: o ImageResponse
 * só lê TTF, OTF ou WOFF, e o Google devolve TTF quando o pedido traz `text=`.
 * Sem rede, a imagem sai na fonte padrão em vez de quebrar o build.
 */

export const alt = "Ledgr: pare de conciliar extrato à mão.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROTULO = "CONCILIAÇÃO BANCÁRIA";
const TITULO = "Pare de conciliar extrato à mão.";
const TEXTO = "Concilie o extrato do banco com o extrato do seu sistema de gestão em minutos, sem planilha no meio.";

async function fonteDoGoogle(familia: string, texto: string): Promise<ArrayBuffer | null> {
  try {
    const opcoes = { cache: "force-cache" } as const;
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${familia}&text=${encodeURIComponent(texto)}`,
      opcoes,
    ).then((resposta) => resposta.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const resposta = await fetch(url, opcoes);
    return resposta.ok ? await resposta.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function imagem(caminho: string): Promise<string> {
  const bytes = await readFile(join(process.cwd(), "public", caminho));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export default async function ImagemDeCompartilhamento() {
  const [titulo, texto, marca, logo, mascote] = await Promise.all([
    fonteDoGoogle("Newsreader:opsz,wght@72,500", TITULO),
    fonteDoGoogle("Inter:wght@400", TEXTO),
    fonteDoGoogle("Inter:wght@700", `Ledgr${ROTULO}`),
    imagem("mascotes/logo-barras.png"),
    imagem("mascotes/mascote-apresenta.png"),
  ]);
  const fontes = [
    titulo && { name: "Newsreader", data: titulo, weight: 500 as const },
    texto && { name: "Inter", data: texto, weight: 400 as const },
    marca && { name: "Inter", data: marca, weight: 700 as const },
  ].filter((fonte) => !!fonte);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 48,
          padding: "0 72px",
          background: "#f3f2f2",
          color: "#201f1d",
          fontFamily: "Inter",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse só entende <img> */}
            <img src={logo} width={44} height={36} alt="" />
            <span style={{ fontSize: 34, fontWeight: 700 }}>Ledgr</span>
            <span style={{ marginLeft: 10, fontSize: 17, fontWeight: 700, letterSpacing: 2.5, color: "#7d5411" }}>
              {ROTULO}
            </span>
          </div>
          <div style={{ fontFamily: "Newsreader", fontSize: 82, fontWeight: 500, lineHeight: 1.02 }}>{TITULO}</div>
          <div style={{ fontSize: 27, lineHeight: 1.45, color: "#5b5855", maxWidth: 640 }}>{TEXTO}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse só entende <img> */}
        <img src={mascote} width={380} height={332} alt="" />
      </div>
    ),
    { ...size, fonts: fontes },
  );
}
