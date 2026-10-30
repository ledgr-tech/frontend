import Image from "next/image";

/** A mão do mascote apontando para a direita, para a próxima ação ao lado dela. Enfeite: o botão diz tudo. */
export function MaoApontando({ className }: { className: string }) {
  return (
    <Image
      src="/mascotes/mao-apontando.webp"
      alt=""
      aria-hidden="true"
      width={1536}
      height={1024}
      sizes="88px"
      className={`mao-apontando ${className}`}
    />
  );
}
