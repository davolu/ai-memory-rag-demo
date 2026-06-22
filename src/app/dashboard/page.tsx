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

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Upload failed.");
        }
      } catch {
        setError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        load();
      }
    },
    [load]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [upload]
  );

  async function remove(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-8 py-5">
        <h1 className="text-xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Upload PDFs, text, or Markdown. We chunk, embed, and store them in your private
          vector store.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <FileUp className="h-6 w-6" />
            )}
          </div>
          <p className="font-medium">
            {uploading ? "Processing your document…" : "Drag & drop a file, or click to browse"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF, TXT, or MD · up to 10 MB
          </p>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
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
            <div className="rounded-xl border border-dashed py-12 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No documents yet</p>
              <p className="text-sm text-muted-foreground">
                Upload your first file to start building your knowledge base.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
