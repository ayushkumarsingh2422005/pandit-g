"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminBackButton } from "./AdminBackButton";

type PaymentRow = {
  phone: string;
  paymentLinkId: string;
  shortUrl: string;
  amountInr: number;
  status: string;
  paidAt?: string;
  razorpayPaymentId?: string;
};

type Stats = { total: number; paidCount: number; totalInr: number };

export function PaymentsPanel() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "created">("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/payments");
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments ?? []);
          setStats(data.stats ?? null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = payments.filter((p) => {
    if (filter === "paid") return p.status === "paid";
    if (filter === "created") return p.status === "created";
    return true;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0b141a]">
      <header className="admin-safe-top flex shrink-0 items-center gap-2 border-b border-[#222d34] bg-[#202c33] px-2 py-3 md:px-6 md:py-4">
        <AdminBackButton />
        <div className="min-w-0">
          <h1 className="text-base text-[#e9edef] md:text-lg">Payments</h1>
          <p className="text-xs text-[#8696a0] md:text-sm">
            Razorpay links & revenue
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
        {stats ? (
          <div className="mb-4 grid grid-cols-3 gap-2 md:mb-6 md:gap-3">
            {[
              { label: "Total", value: stats.total },
              { label: "Paid", value: stats.paidCount, accent: true },
              { label: "Revenue", value: `₹${stats.totalInr}`, gold: true },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg bg-[#202c33] px-2 py-2 md:px-4 md:py-3"
              >
                <p className="text-[10px] text-[#8696a0] md:text-xs">
                  {card.label}
                </p>
                <p
                  className={`mt-0.5 text-lg font-medium md:mt-1 md:text-2xl ${
                    card.accent ? "text-[#00a884]" : "text-[#e9edef]"
                  }`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "paid", "created"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs capitalize md:px-4 md:text-sm ${
                filter === f
                  ? "bg-[#00a884] text-white"
                  : "bg-[#202c33] text-[#8696a0]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-[#8696a0]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#8696a0]">
            No payments
          </p>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="space-y-2 md:hidden">
              {filtered.map((row) => (
                <li
                  key={row.paymentLinkId}
                  className="rounded-lg bg-[#202c33] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/chats/${encodeURIComponent(row.phone)}`}
                      className="font-mono text-sm text-[#00a884]"
                    >
                      {row.phone}
                    </Link>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                        row.status === "paid"
                          ? "bg-[#005c4b]/40 text-[#00a884]"
                          : "bg-[#2a3942] text-[#8696a0]"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-[#e9edef]">₹{row.amountInr}</span>
                    <a
                      href={row.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#00a884]"
                    >
                      Open link
                    </a>
                  </div>
                  {row.paidAt ? (
                    <p className="mt-1 text-[11px] text-[#8696a0]">
                      Paid {new Date(row.paidAt).toLocaleString("en-IN")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-lg bg-[#111b21] md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#202c33] text-xs uppercase text-[#8696a0]">
                  <tr>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Paid at</th>
                    <th className="px-4 py-3">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.paymentLinkId}
                      className="border-t border-[#222d34] hover:bg-[#202c33]/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/chats/${encodeURIComponent(row.phone)}`}
                          className="font-mono text-[#00a884] hover:underline"
                        >
                          {row.phone}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#e9edef]">
                        ₹{row.amountInr}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            row.status === "paid"
                              ? "bg-[#005c4b]/40 text-[#00a884]"
                              : "bg-[#2a3942] text-[#8696a0]"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8696a0]">
                        {row.paidAt
                          ? new Date(row.paidAt).toLocaleString("en-IN")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={row.shortUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#8696a0] hover:text-[#00a884]"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
