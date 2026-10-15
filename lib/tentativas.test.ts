import { beforeEach, describe, expect, it } from "vitest";
import {
  BLOQUEIO_MS,
  LIMITE_TENTATIVAS,
  estaBloqueado,
  limparTentativas,
  registrarSenhaErrada,
} from "./tentativas";

// Quem confere a senha é o servidor; aqui é só a pausa do formulário depois de
// senhas erradas seguidas, que continua do lado do navegador.
describe("tentativas de login", () => {
  const agora = 1_000_000;

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("bloqueia na última senha errada permitida, até o prazo passar", () => {
    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      expect(registrarSenhaErrada({ agora })).toBe(false);
      expect(estaBloqueado({ agora })).toBe(false);
    }

    expect(registrarSenhaErrada({ agora })).toBe(true);
    expect(estaBloqueado({ agora: agora + 1000 })).toBe(true);
    expect(estaBloqueado({ agora: agora + BLOQUEIO_MS + 1 })).toBe(false);
  });

  it("recomeça a contagem do zero depois que o bloqueio vence", () => {
    for (let tentativa = 1; tentativa <= LIMITE_TENTATIVAS; tentativa++) {
      registrarSenhaErrada({ agora });
    }
    const depois = agora + BLOQUEIO_MS + 1;

    expect(registrarSenhaErrada({ agora: depois })).toBe(false);
    expect(estaBloqueado({ agora: depois })).toBe(false);
  });

  it("zera a contagem depois de uma entrada bem-sucedida", () => {
    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      registrarSenhaErrada({ agora });
    }
    limparTentativas();

    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      expect(registrarSenhaErrada({ agora })).toBe(false);
    }
    expect(estaBloqueado({ agora })).toBe(false);
  });
});
