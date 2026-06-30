"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Message = { role: string; content: string; createdAt: string };

type Conversation = {
  phone: string;
  clientName?: string;
  funnelStage?: string;
  blocked: boolean;
  blockReason?: string;
  abuseStrikes?: number;
  messages: Message[];
  birthProfile?: Record<string, unknown>;
};

export default function AdminChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const phone = decodeURIComponent(params.phone as string);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState("");

  const encoded = encodeURIComponent(phone);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/conversations/${encoded}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setConversation(data.conversation);
    } catch {
      setError("Could not load chat");
    } finally {
      setLoading(false);
    }
  }, [encoded]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(
    action: string,
    extra?: Record<string, string>,
  ): Promise<boolean> {
    setActionLoading(true);
    setStatus("");
    try {
      const res = await fetch(`/api/admin/conversations/${encoded}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error ?? "Action failed");
        return false;
      }
      await load();
      return true;
    } catch {
      setStatus("Network error");
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function sendMessage() {
    const text = customMsg.trim();
    if (!text) return;
    const ok = await runAction("send", { message: text });
    if (ok) {
      setCustomMsg("");
      setStatus("Message sent via WhatsApp");
    }
  }

  async function clearChat() {
    if (
      !confirm(
        `Delete ALL data for ${phone}? They will start fresh on next message.`,
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations/${encoded}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/chats");
        router.refresh();
      } else {
        setStatus("Clear failed");
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Loading chat…
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="p-6">
        <p className="text-red-400">{error || "Not found"}</p>
        <Link href="/admin/chats" className="mt-4 inline-block text-coral">
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-6 py-4">
        <Link
          href="/admin/chats"
          className="text-sm text-zinc-500 hover:text-coral"
        >
          ← All chats
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-xl text-white">{conversation.phone}</h1>
            <p className="text-sm text-zinc-400">
              {conversation.clientName
                ? `${conversation.clientName} · `
                : ""}
              Stage: {conversation.funnelStage ?? "—"}
              {conversation.blocked ? " · Blocked" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {conversation.blocked ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => runAction("unblock")}
                className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-950"
              >
                Unblock
              </button>
            ) : (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => runAction("block", { reason: "admin_manual" })}
                className="rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950"
              >
                Block
              </button>
            )}
            <button
              type="button"
              disabled={actionLoading}
              onClick={clearChat}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Clear chat
            </button>
          </div>
        </div>
        {status ? (
          <p className="mt-2 text-sm text-gold">{status}</p>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {conversation.messages.length === 0 ? (
            <p className="text-center text-zinc-500">No messages stored</p>
          ) : (
            conversation.messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={`${msg.createdAt}-${i}`}
                  className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-zinc-800 text-zinc-100"
                        : "bg-coral/20 text-white"
                    }`}
                  >
                    <p className="font-hindi whitespace-pre-wrap">{msg.content}</p>
                    <p className="mt-1 text-[10px] opacity-50">
                      {isUser ? "User" : "Bot"} ·{" "}
                      {new Date(msg.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            placeholder="Custom WhatsApp message (Hindi / English)…"
            rows={2}
            className="font-hindi flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-coral"
          />
          <button
            type="button"
            disabled={actionLoading || !customMsg.trim()}
            onClick={sendMessage}
            className="shrink-0 self-end rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral/90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
