import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("registrarSenhaErrada e limparTentativas não lançam quando o localStorage recusa a escrita", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cheio", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("cheio", "QuotaExceededError");
    });

    expect(() => registrarSenhaErrada({ agora })).not.toThrow();
    expect(() => limparTentativas()).not.toThrow();
    vi.restoreAllMocks();
  });
});
