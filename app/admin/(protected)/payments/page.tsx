"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PaymentRow = {
  phone: string;
  paymentLinkId: string;
  shortUrl: string;
  amountInr: number;
  status: string;
  contactName?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  paidAt?: string;
};

type Stats = { total: number; paidCount: number; totalInr: number };

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "created">("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/payments");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPayments(data.payments ?? []);
        setStats(data.stats ?? null);
      } catch {
        setPayments([]);
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
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Payments</h1>
        <p className="text-sm text-zinc-400">Razorpay payment links & status</p>
      </header>

      {stats ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase text-zinc-500">Total links</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase text-zinc-500">Paid</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">
              {stats.paidCount}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase text-zinc-500">Revenue (paid)</p>
            <p className="mt-1 text-2xl font-semibold text-gold">
              ₹{stats.totalInr}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex gap-2">
        {(["all", "paid", "created"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              filter === f
                ? "bg-coral/20 text-coral"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Paid at</th>
              <th className="px-4 py-3">Payment ID</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No payments
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.paymentLinkId} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/chats/${encodeURIComponent(row.phone)}`}
                      className="font-mono text-coral hover:underline"
                    >
                      {row.phone}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-200">₹{row.amountInr}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        row.status === "paid"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {row.paidAt
                      ? new Date(row.paidAt).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                    {row.razorpayPaymentId ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={row.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Link
                    </a>
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
