// Split raw text into overlapping chunks of roughly `targetTokens` tokens.
// We approximate tokens as ~4 chars (good enough for chunk-sizing), and split
// on paragraph / sentence boundaries to keep chunks coherent.

const CHARS_PER_TOKEN = 4;

export function chunkText(
  text: string,
  targetTokens = 600,
  overlapTokens = 100
): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];

  const maxChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  // Break into paragraphs, then greedily pack into chunks.
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const para of paragraphs) {
    // A single paragraph larger than the budget is hard-split by sentences.
    if (para.length > maxChars) {
      pushCurrent();
      current = "";
      const sentences = para.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [para];
      let buf = "";
      for (const s of sentences) {
        if ((buf + s).length > maxChars && buf) {
          chunks.push(buf.trim());
          buf = buf.slice(Math.max(0, buf.length - overlapChars));
        }
        buf += s;
      }
      if (buf.trim()) {
        current = buf.trim();
      }
      continue;
    }

    if ((current + "\n\n" + para).length > maxChars && current) {
      pushCurrent();
      // start next chunk with an overlap tail from the previous chunk
      const tail = current.slice(Math.max(0, current.length - overlapChars));
      current = tail + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  pushCurrent();

  return chunks;
}
