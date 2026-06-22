"use client";

import { useEffect, useRef, useState } from "react";
import {
  SendHorizontal,
  Loader2,
  FileText,
  Trash2,
  MessageSquareText,
  Sparkles,
  ChevronDown,
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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-8 py-5 backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-7">
        <div className="mx-auto max-w-3xl space-y-7">
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

      <div className="border-t bg-background/80 px-8 py-4 backdrop-blur">
        <form
          onSubmit={send}
          className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border bg-card p-1.5 shadow-soft transition-all focus-within:border-primary/40 focus-within:shadow-soft-lg"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your documents…"
            disabled={sending}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground/70">
          Recall only answers from your uploaded documents.
        </p>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex animate-fade-in-up gap-3.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-primary-foreground shadow-sm">
        <Sparkles className="h-4 w-4 animate-pulse" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
        <span>Thinking</span>
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70" />
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed bg-card/40 py-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-primary-foreground shadow-soft-lg">
        <MessageSquareText className="h-7 w-7" />
      </div>
      <p className="text-lg font-semibold tracking-tight">Ask your knowledge base anything</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
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
      <div className="flex animate-fade-in-up justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm shadow-primary/20">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in-up gap-3.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-primary-foreground shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm leading-relaxed shadow-soft">
          <Markdown>{message.content}</Markdown>
        </div>

        {sources.length > 0 && <SourcesSection sources={sources} />}
      </div>
    </div>
  );
}

function SourcesSection({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <FileText className="h-3 w-3" />
        {sources.length} source{sources.length > 1 ? "s" : ""}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* grid-rows trick: animates max height smoothly without fixed pixel values */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2">
            {sources.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card/70 p-3.5 transition-colors hover:border-primary/30 hover:bg-card"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-3 w-3" />
                    </span>
                    <span className="truncate">{s.filename}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {(s.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
