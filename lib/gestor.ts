/**
 * Justificar uma divergência e fechar ou reabrir o mês são do gestor da conta (#168, mentoria de
 * 19/10): o administrador, quem cadastrou a empresa (`administrador` do `GET /me`). Os outros da
 * equipe conferem linhas, mas não decidem pelo fechamento. A tela esconde os botões, as Server
 * Actions recusam, e o 403 do backend (backend #132) chega com o mesmo texto.
 */
export const SO_O_GESTOR_JUSTIFICA = "Só o gestor da conta justifica divergências.";
export const SO_O_GESTOR_FECHA = "Só o gestor da conta fecha e reabre o mês.";
