"use client";

import { useEffect, useRef, useState } from "react";
import {
  SendHorizontal,
  Loader2,
  FileText,
  Trash2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";

type Source = {
  documentId: string;
  filename: string;
  snippet: string;
  score: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null;
  created_at?: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
      setLoadingHistory(false);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: question,
      sources: null,
    };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((m) => [...m, data.message]);
      } else {
        setMessages((m) => [
          ...m,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: data.error || "Something went wrong.",
            sources: null,
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Network error. Please try again.",
          sources: null,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold">Chat</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions — answers are grounded only in your documents, with sources.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {loadingHistory ? (
            <div className="flex justify-center pt-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}

          {sending && <Thinking />}
        </div>
      </div>

      <div className="border-t px-8 py-4">
        <form onSubmit={send} className="mx-auto flex max-w-3xl items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your documents…"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span>Thinking</span>
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MessageSquareText className="h-6 w-6" />
      </div>
      <p className="font-medium">Ask your knowledge base anything</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Upload documents first, then ask a question. Every answer cites the exact passages
        it used — and if nothing matches, it&apos;ll tell you instead of guessing.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const sources = message.sources ?? [];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm leading-relaxed">
          <Markdown>{message.content}</Markdown>
        </div>

        {sources.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sources
            </p>
            {sources.map((s, i) => (
              <div key={i} className="rounded-lg border bg-card/60 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{s.filename}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {(s.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.snippet}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
