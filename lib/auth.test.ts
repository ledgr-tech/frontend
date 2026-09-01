import { describe, it, expect, beforeEach } from "vitest";
import { login, getSession, logout } from "./auth";

describe("auth mock", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no session exists", () => {
    expect(getSession()).toBeNull();
  });

  it("stores a session on login and returns it from getSession", () => {
    login("financeiro@telhacerta.com.br");
    expect(getSession()).toEqual({ email: "financeiro@telhacerta.com.br" });
  });

  it("clears the session on logout", () => {
    login("financeiro@telhacerta.com.br");
    logout();
    expect(getSession()).toBeNull();
  });

  it("returns null when localStorage contains malformed JSON", () => {
    window.localStorage.setItem("ledgr_session", "not valid json {]");
    expect(getSession()).toBeNull();
  });
});
