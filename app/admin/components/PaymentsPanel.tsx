"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
      <header className="shrink-0 border-b border-[#222d34] bg-[#202c33] px-6 py-4">
        <h1 className="text-lg text-[#e9edef]">Payments</h1>
        <p className="text-sm text-[#8696a0]">Razorpay links & revenue</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {stats ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Total links", value: stats.total },
              { label: "Paid", value: stats.paidCount, accent: true },
              { label: "Revenue", value: `₹${stats.totalInr}`, gold: true },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg bg-[#202c33] px-4 py-3"
              >
                <p className="text-xs text-[#8696a0]">{card.label}</p>
                <p
                  className={`mt-1 text-2xl font-medium ${
                    card.accent
                      ? "text-[#00a884]"
                      : card.gold
                        ? "text-[#e9edef]"
                        : "text-[#e9edef]"
                  }`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mb-4 flex gap-2">
          {(["all", "paid", "created"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                filter === f
                  ? "bg-[#00a884] text-white"
                  : "bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg bg-[#111b21]">
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
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-[#8696a0]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-[#8696a0]"
                  >
                    No payments
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
