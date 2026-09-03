"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login(email);
    router.push("/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={entrar}
        style={{ width: "100%", maxWidth: 424, display: "flex", flexDirection: "column", gap: 16 }}
      >
        <h1 style={{ margin: "0 0 14px", fontSize: 40, fontWeight: 400 }}>Bem-vinda de volta.</h1>
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            placeholder="financeiro@telhacerta.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-senha">Senha</label>
          <input
            id="login-senha"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" style={{ fontSize: 15.5 }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
