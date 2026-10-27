// refaz só o vídeo a partir dos quadros já gravados (quadros.json): FFMPEG=... node encode.mjs <pasta-de-quadros> <saida.webm>
import { spawn } from "node:child_process";
import fs from "node:fs";
const [pasta, saida] = process.argv.slice(2);
const quadros = JSON.parse(fs.readFileSync(`${pasta}/quadros.json`, "utf8"));
const FPS = 30;
const ff = spawn(process.env.FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "pipe:0",
  "-vf", "crop=iw*1345/1360:ih:0:0,scale=1898:1200:flags=lanczos,format=yuv420p", "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-row-mt", "1", "-an", saida], { stdio: ["pipe", "inherit", "inherit"] });
const fim = new Promise((r) => ff.on("close", r));
const t0 = quadros[0].t;
const total = Math.ceil((quadros.at(-1).t - t0 + 0.5) * FPS);
let j = 0;
for (let k = 0; k < total; k++) {
  while (j + 1 < quadros.length && quadros[j + 1].t - t0 <= k / FPS) j++;
  if (!ff.stdin.write(fs.readFileSync(quadros[j].arq))) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
console.log("quadros:", quadros.length, "saída:", total, "ffmpeg:", await fim);
