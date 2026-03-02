const API_BASE = '/api';

export interface SourceItem {
  chunk_id: string;
  filename: string;
  page: number | null;
  confidence: number;
  /** Original text snippet used for attribution (from Pinecone metadata). */
  text_snippet?: string;
}

export interface QueryResponse {
  response: string;
  chunk_ids: string[];
  sources: SourceItem[];
}

export async function postQuery(question: string): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Query failed: ${res.status}`);
  }
  return res.json() as Promise<QueryResponse>;
}
