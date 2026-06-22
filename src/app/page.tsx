import Link from "next/link";
import {
  Brain,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Quote,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      {/* Nav */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
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
      <main className="relative">
        <section className="mx-auto max-w-3xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Retrieval-Augmented Generation · grounded &amp; cited
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            Your private knowledge base,
            <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
              {" "}
              with a memory that lasts.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Upload your PDFs and notes. Ask questions in plain language. Recall finds the
            exact passages and answers grounded only in your documents — every answer
            comes with its sources.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Link>
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

          <div className="mt-6 flex items-start gap-3.5 rounded-2xl border bg-card p-6 text-sm leading-relaxed text-muted-foreground shadow-soft">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Quote className="h-4 w-4" />
            </span>
            <p>
              <span className="font-medium text-foreground">No hallucinations by design.</span>{" "}
              When nothing relevant is found in your documents, Recall tells you it
              can&apos;t find it instead of making something up.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative border-t">
        <div className="mx-auto max-w-6xl px-6 py-7 text-sm text-muted-foreground">
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
    <div className="group rounded-2xl border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="mb-1.5 font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
