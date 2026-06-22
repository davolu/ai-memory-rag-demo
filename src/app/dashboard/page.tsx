"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Doc = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: "processing" | "ready" | "error";
  error: string | null;
  chunk_count: number;
  created_at: string;
};

// An in-flight upload tracked per file before it lands in the documents list.
type Pending = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "error" | "duplicate";
  error?: string;
  note?: string;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

let pendingCounter = 0;

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documents);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Upload a single file, tracking its own status by pending id.
  const uploadOne = useCallback(
    async (file: File, pid: string) => {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPending((p) =>
            p.map((x) =>
              x.id === pid
                ? { ...x, status: "error", error: data.error || "Upload failed." }
                : x
            )
          );
          return;
        }
        if (data.duplicate) {
          // Already in the library — keep a dismissible "already uploaded" note.
          setPending((p) =>
            p.map((x) =>
              x.id === pid
                ? { ...x, status: "duplicate", note: data.message || "Already uploaded." }
                : x
            )
          );
          return;
        }
        // Success: the doc now exists server-side; drop the pending chip.
        setPending((p) => p.filter((x) => x.id !== pid));
      } catch {
        setPending((p) =>
          p.map((x) =>
            x.id === pid ? { ...x, status: "error", error: "Upload failed." } : x
          )
        );
      }
    },
    []
  );

  // Accept many files at once; process them in parallel without blocking the UI.
  const uploadMany = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const entries: Pending[] = files.map((f) => ({
        id: `p${pendingCounter++}`,
        name: f.name,
        size: f.size,
        status: "uploading",
      }));
      setPending((p) => [...entries, ...p]);

      await Promise.allSettled(
        files.map((file, i) => uploadOne(file, entries[i].id))
      );
      // Refresh the persisted list once all requests have settled.
      load();
    },
    [uploadOne, load]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) uploadMany(files);
    },
    [uploadMany]
  );

  async function remove(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load();
  }

  const uploadingCount = pending.filter((p) => p.status === "uploading").length;

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-4 py-5 backdrop-blur sm:px-8">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Documents</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload PDFs, text, or Markdown — one or many at once. We chunk, embed, and store
          them in your private vector store.
        </p>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-7">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 ${
            dragOver
              ? "scale-[1.01] border-primary bg-primary/5 shadow-soft"
              : "border-border bg-card/40 hover:border-primary/50 hover:bg-accent/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length) uploadMany(files);
              e.target.value = "";
            }}
          />
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
            {uploadingCount > 0 ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <FileUp className="h-6 w-6" />
            )}
          </div>
          <p className="text-[15px] font-semibold tracking-tight">
            {uploadingCount > 0
              ? `Processing ${uploadingCount} file${uploadingCount > 1 ? "s" : ""}…`
              : "Drag & drop files, or click to browse"}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            PDF, TXT, or MD · up to 10 MB each · multiple files supported
          </p>
        </div>

        {/* Per-file upload progress / errors */}
        {pending.length > 0 && (
          <ul className="mt-4 space-y-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex animate-fade-in-up items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3 shadow-soft"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.status === "duplicate"
                        ? p.note
                        : `${formatBytes(p.size)}${
                            p.status === "error" && p.error ? ` · ${p.error}` : ""
                          }`}
                    </p>
                  </div>
                </div>
                {p.status === "uploading" ? (
                  <Badge variant="warning">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Uploading
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    {p.status === "duplicate" ? (
                      <Badge variant="default">Already uploaded</Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" /> Failed
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Dismiss"
                      onClick={() =>
                        setPending((arr) => arr.filter((x) => x.id !== p.id))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* List */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Your documents
            </h2>
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/40 py-14 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <p className="font-semibold tracking-tight">No documents yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload your first files to start building your knowledge base.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-soft transition-all duration-200 hover:border-primary/30 hover:shadow-soft-lg"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(doc.size_bytes)}
                        {doc.status === "ready" && ` · ${doc.chunk_count} chunks`}
                        {doc.status === "error" && doc.error && ` · ${doc.error}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={doc.status} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(doc.id)}
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Doc["status"] }) {
  if (status === "ready") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive">
        <AlertCircle className="mr-1 h-3 w-3" /> Error
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processing
    </Badge>
  );
}
