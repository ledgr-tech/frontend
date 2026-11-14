const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * O endereço que vai ao Web Analytics da Vercel (S1-21): cada UUID vira `[id]` (empresa, conciliação,
 * linha) e a busca e o fragmento saem, porque levam `#token=` dos links de e-mail e `?pedido=` da
 * conexão. As visitas ficam agrupadas por tela, e nenhum id de cliente vai a terceiro.
 */
export function enderecoAnonimo(url: string): string | null {
  try {
    const endereco = new URL(url);
    return `${endereco.origin}${endereco.pathname.replace(UUID, "[id]")}`;
  } catch {
    return null;
  }
}
