"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, logout } from "@/lib/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }
    setAutorizado(true);
  }, [router]);

  if (!autorizado) {
    return null;
  }

  function sair() {
    logout();
    router.replace("/login");
  }

  return (
    <div>
      <nav className="nav">
        <Link href="/dashboard" className="nav-brand" style={{ textDecoration: "none", color: "inherit" }}>
          Ledgr
        </Link>
        <Link href="/dashboard">Dashboard</Link>
        <button type="button" className="btn btn-ghost" onClick={sair}>
          Sair
        </button>
      </nav>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(16px, 3.5vw, 40px)" }}>
        {children}
      </main>
    </div>
  );
}
