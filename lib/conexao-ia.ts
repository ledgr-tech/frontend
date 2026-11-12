/**
 * A conexão do Ledgr com o ChatGPT e o Claude (backend #136): o que o painel de Conexões, a Central de ajuda
 * e a landing dizem igual.
 */
export type IaDaConexao = "chatgpt" | "claude";

export const NOME_DA_IA: Record<IaDaConexao, string> = { chatgpt: "ChatGPT", claude: "Claude" };

// a ajuda oficial de quem desenha esses menus, para quando o caminho dos passos mudar
export const DOCUMENTACAO_DA_IA: Record<IaDaConexao, string> = {
  chatgpt: "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt",
  claude: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
};

/** O que aparece no lugar do endereço quando o servidor não sabe a API (um preview, um teste). */
export const ENDERECO_SEM_BASE = "<endereço do conector>";

/**
 * O endereço que se cola na IA. Só no servidor: lê `LEDGR_API_URL`.
 * ponytail: o conector fica em `/mcp` do mesmo backend (o `MCP_URL_PUBLICA` padrão); se o backend mudar o
 * caminho ou o host, este passa a ser uma variável própria
 */
export function enderecoDoConector(base: string | undefined = process.env.LEDGR_API_URL): string | null {
  return base ? `${base.replace(/\/+$/, "")}/mcp` : null;
}
