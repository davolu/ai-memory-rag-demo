// Extract plain text from an uploaded file buffer based on its type.

export async function extractText(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const lower = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");

  if (isPdf) {
    // Import the library entry point directly to avoid pdf-parse's
    // index.js running a debug self-test against a bundled sample file.
    const mod: any = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = mod.default || mod;
    const data = await pdfParse(buffer);
    return (data.text || "").trim();
  }

  // txt / md / anything else textual
  return buffer.toString("utf8").trim();
}

export function isSupported(filename: string, mimeType: string): boolean {
  const lower = filename.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  );
}
