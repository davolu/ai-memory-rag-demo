import Link from "next/link";
import { Brain, FileText, MessageSquareText, ShieldCheck, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="h-5 w-5" />
          </span>
          Recall
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="mx-auto max-w-3xl px-6 pb-16 pt-16 text-center sm:pt-24">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Retrieval-Augmented Generation · grounded & cited
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Your private knowledge base, with a memory that lasts.
          </h1>
          <p className="mt-5 text-pretty text-lg text-muted-foreground">
            Upload your PDFs and notes. Ask questions in plain language. Recall finds the
            exact passages and answers grounded only in your documents — every answer
            comes with its sources.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">Create your account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid gap-5 sm:grid-cols-3">
            <Feature
              icon={<FileText className="h-5 w-5" />}
              title="Upload anything"
              body="Drop in PDF, TXT, or Markdown. We extract, chunk, and embed it into your personal vector store."
            />
            <Feature
              icon={<MessageSquareText className="h-5 w-5" />}
              title="Ask, get cited answers"
              body="Semantic search finds the most relevant passages, then the model answers using only those — with citations."
            />
            <Feature
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Private & persistent"
              body="Your documents and chat history are scoped to your account and persist across sessions. That's the memory."
            />
          </div>

          <div className="mt-10 flex items-start gap-3 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            <Quote className="h-5 w-5 shrink-0 text-primary" />
            <p>
              No hallucinations by design: when nothing relevant is found in your
              documents, Recall tells you it can&apos;t find it instead of making something
              up.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          Recall — AI Memory &amp; Knowledge Retrieval demo. Built with Next.js, pgvector
          &amp; OpenAI.
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-1.5 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
