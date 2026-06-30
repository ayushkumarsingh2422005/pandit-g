"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  editedAt?: string;
};

type Conversation = {
  phone: string;
  clientName?: string;
  funnelStage?: string;
  blocked: boolean;
  blockReason?: string;
  abuseStrikes?: number;
  blockedAt?: string;
  messages: Message[];
};

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBlockReason(reason?: string): string {
  if (!reason) return "blocked";
  return reason.replace(/_/g, " ");
}

type Props = { phone: string };

export function ChatDetailPanel({ phone }: Props) {
  const router = useRouter();
  const encoded = encodeURIComponent(phone);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [customMsg, setCustomMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations/${encoded}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConversation(data.conversation);
    } catch {
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [encoded]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

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
        setStatus("Action failed");
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
      setStatus("Sent");
      setTimeout(() => setStatus(""), 2000);
    }
  }

  async function deleteChat() {
    if (
      !confirm(
        `Delete entire chat for ${phone}? This clears all messages and resets the AI context.`,
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
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function saveEdit(messageId: string) {
    const content = editDraft.trim();
    if (!content) return;
    const ok = await runAction("edit_message", { messageId, content });
    if (ok) {
      setEditingId(null);
      setEditDraft("");
    }
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("Delete this message from chat history?")) return;
    await runAction("delete_message", { messageId });
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#8696a0]">
        Loading chat…
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#8696a0]">
        Chat not found
      </div>
    );
  }

  const displayName = conversation.clientName || conversation.phone;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#222d34] bg-[#202c33] px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm text-white ${
              conversation.blocked ? "bg-red-900/60" : "bg-[#6b7b85]"
            }`}
          >
            {(conversation.clientName || phone).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] text-[#e9edef]">
              {displayName}
            </h1>
            <p className="truncate text-xs text-[#8696a0]">
              {conversation.phone}
              {conversation.funnelStage
                ? ` · ${conversation.funnelStage}`
                : ""}
              {conversation.blocked
                ? ` · ${formatBlockReason(conversation.blockReason)}`
                : ""}
              {typeof conversation.abuseStrikes === "number" &&
              conversation.abuseStrikes > 0
                ? ` · ${conversation.abuseStrikes} strike(s)`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {conversation.blocked ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => runAction("unblock")}
              className="rounded px-3 py-1.5 text-xs text-[#00a884] hover:bg-[#2a3942]"
            >
              Unblock
            </button>
          ) : (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => runAction("block", { reason: "admin_manual" })}
              className="rounded px-3 py-1.5 text-xs text-red-400 hover:bg-[#2a3942]"
            >
              Block
            </button>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={deleteChat}
            className="rounded px-3 py-1.5 text-xs text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"
          >
            Delete chat
          </button>
        </div>
      </header>

      <div
        className="admin-chat-bg min-h-0 flex-1 overflow-y-auto px-[6%] py-3"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          {conversation.messages.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#8696a0]">
              No messages yet
            </p>
          ) : (
            conversation.messages.map((msg) => {
              const isUser = msg.role === "user";
              const isEditing = editingId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`group flex ${isUser ? "justify-start" : "justify-end"}`}
                >
                  <div className="relative max-w-[70%]">
                    {isEditing ? (
                      <div className="rounded-lg bg-[#2a3942] p-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          className="font-hindi w-full resize-none rounded bg-[#111b21] p-2 text-sm text-[#e9edef] outline-none"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft("");
                            }}
                            className="rounded px-2 py-1 text-xs text-[#8696a0]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading || !editDraft.trim()}
                            onClick={() => saveEdit(msg.id)}
                            className="rounded bg-[#00a884] px-2 py-1 text-xs text-white"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`relative rounded-lg px-2 py-1.5 shadow-sm ${
                            isUser
                              ? "rounded-tl-none bg-[#202c33] text-[#e9edef]"
                              : "rounded-tr-none bg-[#005c4b] text-[#e9edef]"
                          }`}
                        >
                          <p className="font-hindi whitespace-pre-wrap pr-14 text-[14.2px] leading-[19px]">
                            {msg.content}
                          </p>
                          <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[11px] text-[#8696a0]">
                            {msg.editedAt ? (
                              <span className="italic">edited</span>
                            ) : null}
                            {formatMsgTime(msg.createdAt)}
                          </span>
                        </div>
                        <div
                          className={`absolute top-0 flex gap-0.5 opacity-0 transition group-hover:opacity-100 ${
                            isUser ? "right-0 translate-x-full pl-1" : "left-0 -translate-x-full pr-1"
                          }`}
                        >
                          <button
                            type="button"
                            title="Edit message"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(msg.id);
                              setEditDraft(msg.content);
                            }}
                            className="rounded bg-[#2a3942] p-1.5 text-[#8696a0] hover:text-[#e9edef]"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Delete message"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMessage(msg.id);
                            }}
                            className="rounded bg-[#2a3942] p-1.5 text-red-400 hover:text-red-300"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-[#222d34] bg-[#202c33] px-4 py-3">
        {status ? (
          <p className="mb-2 text-center text-xs text-[#00a884]">{status}</p>
        ) : null}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message"
            rows={1}
            className="font-hindi max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border-none bg-[#2a3942] px-4 py-2.5 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
          />
          <button
            type="button"
            disabled={actionLoading || !customMsg.trim()}
            onClick={sendMessage}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white transition hover:bg-[#06cf9c] disabled:opacity-40"
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M1.101 21.757 23.8 12.024 1.101 2.291l.011 7.32 16.893 2.413-16.893 2.413-.011 7.32z" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
