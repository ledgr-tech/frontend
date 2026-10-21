import Image from "next/image";

/**
 * O logo do Ledgr: o adesivo das três barras pintadas, sempre a mesma imagem
 * (`/mascotes/logo-barras.png`), no site, nas telas de acesso e no app. O
 * contorno branco do adesivo é o que o deixa legível também no tema escuro.
 * `sizes` diz a largura em que ele aparece, para o Next servir o tamanho certo.
 */
export function LogoBarras({
  className,
  sizes = "48px",
  loading,
  fetchPriority,
}: {
  className?: string;
  sizes?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high";
}) {
  return (
    <Image
      src="/mascotes/logo-barras.png"
      alt=""
      aria-hidden="true"
      width={1237}
      height={998}
      sizes={sizes}
      loading={loading}
      fetchPriority={fetchPriority}
      className={className}
    />
  );
}
