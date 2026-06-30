"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }

      router.replace("/admin/chats");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-4 rounded-lg border border-[#222d34] bg-[#202c33] p-8 shadow-xl"
    >
      <div className="mb-2 text-center">
        <h1 className="text-xl font-medium text-[#e9edef]">Pandit G Admin</h1>
        <p className="mt-1 text-sm text-[#8696a0]">Sign in to manage chats</p>
      </div>

      <label className="block text-sm text-[#8696a0]">
        Admin ID
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          autoComplete="username"
          required
          className="mt-1 w-full rounded-lg border border-[#222d34] bg-[#2a3942] px-3 py-2 text-[#e9edef] outline-none focus:border-[#00a884]"
        />
      </label>

      <label className="block text-sm text-[#8696a0]">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-[#222d34] bg-[#2a3942] px-3 py-2 text-[#e9edef] outline-none focus:border-[#00a884]"
        />
      </label>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white transition hover:bg-[#06cf9c] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
