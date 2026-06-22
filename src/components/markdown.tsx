"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders assistant answers as proper markdown (bold, headings, lists, tables,
// links, code) with calm Tailwind `prose` styling.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary prose-p:my-2 prose-headings:mb-2 prose-headings:mt-3 prose-ul:my-2 prose-ol:my-2 prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
