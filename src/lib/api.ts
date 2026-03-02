const API_BASE = '/api';

export interface SourceItem {
  chunk_id: string;
  filename: string;
  page: number | null;
  confidence: number;
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

/** Stream response: each line is JSON with optional "delta" (text chunk) or "sources" (array). */
export async function postQueryStream(
  question: string,
  onDelta: (text: string) => void,
  onSources: (sources: SourceItem[]) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Stream failed: ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as { delta?: string; sources?: SourceItem[] };
        if (obj.delta != null) onDelta(obj.delta);
        if (obj.sources != null) onSources(obj.sources);
      } catch {
        // skip malformed line
      }
    }
  }
  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer) as { delta?: string; sources?: SourceItem[] };
      if (obj.delta != null) onDelta(obj.delta);
      if (obj.sources != null) onSources(obj.sources);
    } catch {
      // skip
    }
  }
}

export async function getDocuments(): Promise<{ documents: string[] }> {
  const res = await fetch(`${API_BASE}/documents`);
  if (!res.ok) throw new Error('Failed to list documents');
  return res.json() as Promise<{ documents: string[] }>;
}

export async function deleteDocument(filename: string): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/documents?filename=${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json() as Promise<{ deleted: number }>;
}

export async function uploadDocument(file: File): Promise<{ filename: string; chunks: number }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: form,
  });
  const data = (await res.json()) as { filename?: string; chunks?: number; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return { filename: data.filename!, chunks: data.chunks ?? 0 };
}
