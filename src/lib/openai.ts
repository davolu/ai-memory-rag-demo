import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
export const CHAT_MODEL = "gpt-4o-mini";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

// Embed a batch of texts in one request.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  // API preserves input order.
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[]);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
