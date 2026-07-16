"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChatListPanel } from "./ChatListPanel";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<"all" | "blocked">("all");

  const selectedPhone = useMemo(() => {
    const match = pathname.match(/^\/admin\/chats\/(.+)$/);
    if (!match) return undefined;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [pathname]);

  const isPayments = pathname.startsWith("/admin/payments");
  const isUsers = pathname.startsWith("/admin/users");
  const isChatDetail = Boolean(selectedPhone);
  const isSecondaryPane = isPayments || isUsers;

  /** Mobile: one pane at a time — list OR detail/payments/users (like WhatsApp app). */
  const showListMobile = !isChatDetail && !isSecondaryPane;
  const showMainMobile = isChatDetail || isSecondaryPane;

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-wa admin-shell flex overflow-hidden bg-[#111b21] text-[#e9edef]">
      {/* Left panel — chat list */}
      <aside
        className={`flex w-full flex-col border-[#222d34] bg-[#111b21] md:max-w-[420px] md:shrink-0 md:border-r ${
          showListMobile ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="admin-safe-top flex shrink-0 items-center justify-between bg-[#202c33] px-3 py-2.5 md:px-4 md:py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[#e9edef]">Pandit G</p>
            <p className="text-xs text-[#8696a0]">Admin</p>
          </div>
          <div className="flex items-center gap-0.5">
            <Link
              href="/admin/payments"
              title="Payments"
              className={`rounded-full p-2.5 transition ${
                isPayments
                  ? "bg-[#2a3942] text-[#00a884]"
                  : "text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"
              }`}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>
            <Link
              href="/admin/users"
              title="Portal users"
              className={`rounded-full p-2.5 transition ${
                isUsers
                  ? "bg-[#2a3942] text-[#00a884]"
                  : "text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"
              }`}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </Link>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="rounded-full p-2.5 text-[#8696a0] transition hover:bg-[#2a3942] hover:text-[#e9edef]"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-[#222d34] bg-[#111b21] px-3 py-2">
          <div className="flex items-center gap-2 rounded-lg bg-[#202c33] px-3 py-2">
            <svg
              className="h-4 w-4 shrink-0 text-[#8696a0]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-base text-[#e9edef] outline-none placeholder:text-[#8696a0] md:text-sm"
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-b border-[#222d34] px-3 py-2">
          <button
            type="button"
            onClick={() => setListFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs ${
              listFilter === "all"
                ? "bg-[#00a884] text-white"
                : "bg-[#202c33] text-[#8696a0]"
            }`}
          >
            All chats
          </button>
          <button
            type="button"
            onClick={() => setListFilter("blocked")}
            className={`rounded-full px-3 py-1.5 text-xs ${
              listFilter === "blocked"
                ? "bg-red-600 text-white"
                : "bg-[#202c33] text-[#8696a0]"
            }`}
          >
            Blocked
          </button>
        </div>

        {isSecondaryPane ? (
          <div className="hidden shrink-0 px-4 py-2 text-xs text-[#8696a0] md:block">
            <Link href="/admin/chats" className="text-[#00a884] hover:underline">
              ← Back to chats
            </Link>
          </div>
        ) : null}

        <ChatListPanel
          selectedPhone={selectedPhone}
          search={search}
          blockedOnly={listFilter === "blocked"}
        />
      </aside>

      {/* Right panel — chat / payments / empty (desktop only when no selection) */}
      <main
        className={`min-w-0 flex-1 flex-col bg-[#0b141a] ${
          showMainMobile ? "flex" : "hidden md:flex"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
