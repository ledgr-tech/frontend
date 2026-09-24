import { Database, Landmark } from "lucide-react";

export type Origem = "banco" | "sistema";

/**
 * De onde o extrato veio: o prédio do banco ou a base de dados do sistema de
 * gestão. Sempre ao lado de um texto que já diz a origem, então fica fora do
 * leitor de tela.
 *
 * ponytail: ícone genérico porque a API só diz "banco" ou "sistema". O OFX traz o
 * código do banco (BANKID), mas o backend não o devolve; quando devolver, dá para
 * trocar o prédio pelo logo do banco aqui.
 */
export function IconeOrigem({ origem, tamanho = 17 }: { origem: Origem; tamanho?: number }) {
  const Icone = origem === "banco" ? Landmark : Database;
  return (
    <Icone
      size={tamanho}
      strokeWidth={1.5}
      aria-hidden="true"
      data-origem={origem}
      className="icone-origem"
    />
  );
}
