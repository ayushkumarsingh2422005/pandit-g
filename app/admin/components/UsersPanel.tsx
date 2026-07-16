"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminBackButton } from "./AdminBackButton";

type AdminRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export function UsersPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/auth"),
      ]);
      if (!usersRes.ok) {
        const data = await usersRes.json().catch(() => ({}));
        setError(data.error ?? "Failed to load users");
        return;
      }
      const data = await usersRes.json();
      setAdmins(data.admins ?? []);
      if (meRes.ok) {
        const me = await meRes.json();
        setCurrentId(me.admin?.id ?? null);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create user");
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setMessage("Admin user created");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!window.confirm(`Remove admin ${label}? They will lose panel access.`)) {
      return;
    }
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete user");
        return;
      }
      setMessage("Admin removed");
      await load();
    } catch {
      setError("Network error");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="admin-safe-top flex shrink-0 items-center gap-2 border-b border-[#222d34] bg-[#202c33] px-3 py-2.5 md:px-4">
        <AdminBackButton />
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-[#e9edef]">Portal users</p>
          <p className="text-xs text-[#8696a0]">
            Manage who can access this admin panel (invite only — no public signup)
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <form
            onSubmit={onCreate}
            className="space-y-3 rounded-lg border border-[#222d34] bg-[#202c33] p-4"
          >
            <h2 className="text-sm font-medium text-[#e9edef]">Add admin</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[#8696a0] sm:col-span-1">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-[#222d34] bg-[#2a3942] px-3 py-2 text-sm text-[#e9edef] outline-none focus:border-[#00a884]"
                />
              </label>
              <label className="block text-xs text-[#8696a0] sm:col-span-1">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-[#222d34] bg-[#2a3942] px-3 py-2 text-sm text-[#e9edef] outline-none focus:border-[#00a884]"
                />
              </label>
              <label className="block text-xs text-[#8696a0] sm:col-span-2">
                Temporary password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-[#222d34] bg-[#2a3942] px-3 py-2 text-sm text-[#e9edef] outline-none focus:border-[#00a884]"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#06cf9c] disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create admin"}
            </button>
          </form>

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

          <div className="overflow-hidden rounded-lg border border-[#222d34]">
            <div className="border-b border-[#222d34] bg-[#202c33] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#8696a0]">
              Admins ({admins.length})
            </div>
            {loading ? (
              <p className="px-4 py-6 text-sm text-[#8696a0]">Loading…</p>
            ) : admins.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#8696a0]">No admins found.</p>
            ) : (
              <ul className="divide-y divide-[#222d34] bg-[#111b21]">
                {admins.map((admin) => (
                  <li
                    key={admin.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#e9edef]">
                        {admin.name}
                        {admin.id === currentId ? (
                          <span className="ml-2 text-xs text-[#00a884]">(you)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-[#8696a0]">
                        {admin.email}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#667781]">
                        Added {new Date(admin.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={admin.id === currentId || admins.length <= 1}
                      onClick={() => onDelete(admin.id, admin.email)}
                      className="rounded-lg border border-[#3b4a54] px-3 py-1.5 text-xs text-[#e9edef] hover:bg-[#2a3942] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
