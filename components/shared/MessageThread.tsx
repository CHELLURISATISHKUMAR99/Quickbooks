"use client";

import { useState } from "react";
import type { MessageRow, SenderRole } from "@/types";
import { timeAgo } from "@/lib/utils/format";

export function MessageThread({
  clientId,
  initial,
  sendAs,
}: {
  clientId: string;
  initial: MessageRow[];
  sendAs: SenderRole;
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initial);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, body: body.trim() }),
    });
    const json = (await res.json()) as { success: boolean; data?: MessageRow };
    if (json.success && json.data) {
      setMessages((prev) => [...prev, json.data!]);
      setBody("");
    }
    setSending(false);
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden flex flex-col" style={{ minHeight: 500 }}>
      <div className="flex-1 p-4 space-y-3 overflow-auto">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-8">
            No messages yet. Say hi.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_role === sendAs;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-brand text-white"
                    : "bg-neutral-100 text-neutral-800"
                }`}
              >
                <div>{m.body}</div>
                <div
                  className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-neutral-500"}`}
                >
                  {timeAgo(m.sent_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-neutral-200 p-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type a message…"
          className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !body.trim()}
          className="bg-brand text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
