"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type ConversationRow = {
  phone: string;
  clientName?: string;
  funnelStage?: string;
  blocked: boolean;
  blockReason?: string;
  messageCount: number;
  updatedAt?: string;
  lastMessage?: string;
};

function formatListTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function avatarLabel(row: ConversationRow): string {
  if (row.clientName) return row.clientName.slice(0, 1).toUpperCase();
  return row.phone.slice(-2);
}

type Props = {
  selectedPhone?: string;
  search: string;
  blockedOnly?: boolean;
};

export function ChatListPanel({
  selectedPhone,
  search,
  blockedOnly = false,
}: Props) {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (q?: string, blocked?: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("search", q);
        if (blocked) params.set("blocked", "true");
        const qs = params.toString();
        const res = await fetch(
          `/api/admin/conversations${qs ? `?${qs}` : ""}`,
        );
        if (res.ok) {
          const data = await res.json();
          setRows(data.conversations ?? []);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => load(search, blockedOnly), 250);
    return () => clearTimeout(t);
  }, [search, blockedOnly, load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {loading && rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[#8696a0]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[#8696a0]">
          {blockedOnly ? "No blocked conversations" : "No conversations"}
        </p>
      ) : (
        <ul className="overflow-y-auto">
          {rows.map((row) => {
            const active = selectedPhone === row.phone;
            const title = row.clientName || row.phone;
            return (
              <li key={row.phone}>
                <Link
                  href={`/admin/chats/${encodeURIComponent(row.phone)}`}
                  className={`flex items-center gap-3 border-b border-[#222d34]/80 px-3 py-3.5 transition active:bg-[#2a3942] md:py-3 ${
                    active ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                      row.blocked
                        ? "bg-red-900/50 text-red-300"
                        : "bg-[#6b7b85] text-white"
                    }`}
                  >
                    {avatarLabel(row)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-normal text-[#e9edef]">
                        {title}
                      </span>
                      <span className="shrink-0 text-xs text-[#8696a0]">
                        {formatListTime(row.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-[#8696a0]">
                        {row.lastMessage || "No messages"}
                      </p>
                      {row.blocked ? (
                        <span
                          className="shrink-0 text-[10px] text-red-400"
                          title={row.blockReason}
                        >
                          blocked
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
