import Image from "next/image";

/** O link ou pedido que passou da validade (senha, e-mail, convite, conexão): o mascote olha o relógio. */
export function MascoteDoRelogio() {
  return (
    <Image
      src="/mascotes/mascote-relogio.webp"
      alt=""
      width={1254}
      height={1254}
      sizes="104px"
      loading="eager"
      style={{ width: 104, height: "auto", display: "block", marginBottom: "clamp(10px, 2vh, 18px)" }}
    />
  );
}
