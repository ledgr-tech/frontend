import { COOKIE_DA_EMPRESA_RECENTE, ehUuid } from "./rotas";

/**
 * Lembra a última empresa usada, num cookie (não httpOnly, `SameSite=Lax`, um ano). Ele **só escolhe o
 * destino** do redirect das URLs sem empresa (`app/(sem-empresa)`); nunca vai ao backend, que recebe a
 * empresa da URL de cada aba. Um id que não é UUID não é gravado: o valor entra no cookie sem escape.
 */
export function gravarEmpresaRecente(id: string): void {
  if (!ehUuid(id) || typeof document === "undefined") return;
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_DA_EMPRESA_RECENTE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax${seguro}`;
}
