import { useState, useCallback, useEffect, useRef } from 'react';
import { FileText, Send, Trash2, MessageCircle, Upload } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import { SkeletonLoader } from './SkeletonLoader';
import { SourcePills } from './SourcePills';
import { SourcesPanel } from './SourcesPanel';
import { postQueryStream, getDocuments, deleteDocument, uploadDocument, type SourceItem } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
}

function nextId() {
  return crypto.randomUUID();
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setBackendUnavailable(false);
      const { documents: list } = await getDocuments();
      setDocuments(list);
    } catch {
      setDocuments([]);
      setBackendUnavailable(true);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onCitationClick = useCallback(() => setSourcesOpen(true), []);

  const handleDeleteDoc = useCallback(
    async (filename: string) => {
      if (deleting) return;
      setDeleting(filename);
      try {
        await deleteDocument(filename);
        await fetchDocuments();
      } catch {
        // ignore
      } finally {
        setDeleting(null);
      }
    },
    [deleting, fetchDocuments]
  );

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !file.name.toLowerCase().endsWith('.pdf') || uploading) return;
      setUploading(true);
      try {
        await uploadDocument(file);
        await fetchDocuments();
      } catch {
        // ignore
      } finally {
        setUploading(false);
      }
    },
    [uploading, fetchDocuments]
  );

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: question }]);
    setLoading(true);
    setSources([]);

    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', sources: [] },
    ]);

    let streamedContent = '';

    try {
      await postQueryStream(
        question,
        (delta) => {
          streamedContent += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: streamedContent } : m
            )
          );
        },
        (sourceList) => {
          setSources(sourceList);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, sources: sourceList } : m))
          );
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `Error: ${message}` } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <div className="flex h-screen bg-slate-950/80">
      {/* Sidebar: uploaded documents */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-white/10 bg-slate-900/70 backdrop-blur-sm">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <FileText className="h-4 w-4 text-indigo-400" />
            Documents
          </h2>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleUpload}
        />
        <div className="border-b border-white/10 p-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || backendUnavailable}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-300 disabled:opacity-50 disabled:hover:border-white/20 disabled:hover:bg-white/5"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload PDF'}
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {backendUnavailable ? (
            <li className="px-2 py-3 text-xs text-amber-400/90">
              Backend not running. Start it with <code className="rounded bg-white/10 px-1">npm run dev:backend</code> to list and upload documents.
            </li>
          ) : documents.length === 0 ? (
            <li className="px-2 py-3 text-xs text-slate-500">No documents yet. Upload a PDF above.</li>
          ) : (
            documents.map((name) => (
              <li
                key={name}
                className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-white/5"
              >
                <span className="min-w-0 truncate text-sm text-slate-300" title={name}>
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteDoc(name)}
                  disabled={deleting === name}
                  className="flex-shrink-0 rounded p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                  aria-label={`Delete ${name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <MessageCircle className="mx-auto h-12 w-12 text-indigo-400/80" />
              </div>
              <p className="text-slate-400">Ask anything about your documents.</p>
              <p className="text-sm text-slate-500">Responses support markdown and code blocks.</p>
            </div>
          )}

          <ul className="space-y-6">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    msg.role === 'user'
                      ? 'max-w-[85%] rounded-2xl border border-white/10 bg-indigo-500/20 px-4 py-3 shadow-lg backdrop-blur-sm'
                      : 'max-w-[90%] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg backdrop-blur-sm'
                  }
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap break-words text-slate-100">
                      {msg.content}
                    </p>
                  ) : (
                    <>
                      <MarkdownContent
                        content={msg.content}
                        sources={msg.sources ?? []}
                        onCitationClick={onCitationClick}
                      />
                      <SourcePills
                        sources={msg.sources ?? []}
                        onPillClick={(s) => {
                          setSources(s);
                          setSourcesOpen(true);
                        }}
                      />
                    </>
                  )}
                </div>
              </li>
            ))}

            {loading && (
              <li className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg backdrop-blur-sm">
                  <SkeletonLoader />
                </div>
              </li>
            )}
          </ul>
        </div>

        <div className="border-t border-white/10 bg-slate-900/50 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-xl backdrop-blur-sm"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 outline-none"
                disabled={loading}
                aria-label="Question"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-indigo-500 px-4 py-3 text-white transition hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500"
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </main>

      <SourcesPanel sources={sources} onClose={() => setSourcesOpen(false)} isOpen={sourcesOpen} />
    </div>
  );
}
