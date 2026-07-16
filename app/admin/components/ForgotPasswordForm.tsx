"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setMessage(
        data.message ??
          "If an account exists for that email, a reset link has been sent.",
      );
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
        <h1 className="text-xl font-medium text-[#e9edef]">Reset password</h1>
        <p className="mt-1 text-sm text-[#8696a0]">
          We will email a reset link via Brevo
        </p>
      </div>

      <label className="block text-sm text-[#8696a0]">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="mt-1 w-full rounded-lg border border-[#222d34] bg-[#2a3942] px-3 py-2 text-[#e9edef] outline-none focus:border-[#00a884]"
        />
      </label>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[#00a884]" role="status">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white transition hover:bg-[#06cf9c] disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-[#8696a0]">
        <Link href="/admin/login" className="text-[#00a884] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
