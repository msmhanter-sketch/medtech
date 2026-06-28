"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

const STORAGE_KEY = "msp_admin_ok";
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ADMIN_PASSWORD) {
      setUnlocked(true);
      return;
    }
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  if (unlocked) return <>{children}</>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setError(null);
    } else {
      setError("Неверный пароль");
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-3">
          <Lock size={22} className="text-[var(--accent)]" />
          <h1 className="text-lg font-bold">Админ-панель</h1>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          className="mb-4 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        <button type="submit" className="btn-primary w-full justify-center rounded-xl">
          Войти
        </button>
      </form>
    </div>
  );
}
