"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token")?.trim() ?? "",
    [searchParams],
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      router.replace("/admin/login");
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
        <h1 className="text-xl font-medium text-[#e9edef]">Set new password</h1>
        <p className="mt-1 text-sm text-[#8696a0]">
          Choose a new password for your admin account
        </p>
      </div>

      {!token ? (
        <p className="text-sm text-red-400" role="alert">
          Missing or invalid reset link. Request a new one from the forgot
          password page.
        </p>
      ) : null}

      <label className="block text-sm text-[#8696a0]">
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-[#222d34] bg-[#2a3942] px-3 py-2 text-[#e9edef] outline-none focus:border-[#00a884]"
        />
      </label>

      <label className="block text-sm text-[#8696a0]">
        Confirm password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
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
        disabled={loading || !token}
        className="w-full rounded-lg bg-[#00a884] py-2.5 font-medium text-white transition hover:bg-[#06cf9c] disabled:opacity-60"
      >
        {loading ? "Saving…" : "Update password"}
      </button>

      <p className="text-center text-sm text-[#8696a0]">
        <Link href="/admin/login" className="text-[#00a884] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
