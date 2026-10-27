/**
 * Fechar e reabrir o mês são do admin e do gestor (#168, #133; decisões de 21/10): o analista concilia
 * e justifica, mas não decide pelo fechamento (`lib/papel.ts`). A tela esconde os botões, as Server
 * Actions recusam, e o 403 do backend (backend #132) chega com o mesmo texto. Justificar é de todos:
 * quem aprova ou rejeita a justificativa é o admin ou o gestor, como quem fecha o mês.
 */
export const SO_O_GESTOR_FECHA = "Só o admin ou o gestor da conta fecham e reabrem o mês.";
export const SO_O_GESTOR_APROVA = "Só o admin ou o gestor da conta aprovam ou rejeitam justificativas.";
