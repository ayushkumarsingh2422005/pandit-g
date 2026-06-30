"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ConversationRow = {
  phone: string;
  clientName?: string;
  funnelStage?: string;
  blocked: boolean;
  messageCount: number;
  updatedAt?: string;
  lastMessage?: string;
};

export default function AdminChatsPage() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/admin/conversations${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRows(data.conversations ?? []);
    } catch {
      setError("Could not load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">WhatsApp Chats</h1>
          <p className="text-sm text-zinc-400">
            View, clear, block, or message any user
          </p>
        </div>
        <input
          type="search"
          placeholder="Search phone or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-coral"
        />
      </header>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Msgs</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No conversations yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.phone} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-mono text-zinc-200">
                    {row.phone}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {row.clientName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {row.funnelStage ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.blocked ? (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                        Blocked
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{row.messageCount}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {row.updatedAt
                      ? new Date(row.updatedAt).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/chats/${encodeURIComponent(row.phone)}`}
                      className="text-coral hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
