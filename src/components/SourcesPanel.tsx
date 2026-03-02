import { X } from 'lucide-react';
import type { SourceItem } from '../lib/api';

interface SourcesPanelProps {
  sources: SourceItem[];
  onClose: () => void;
  isOpen: boolean;
}

export function SourcesPanel({ sources, onClose, isOpen }: SourcesPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full max-w-md border-l border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-xl"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.3)' }}
        aria-label="Sources"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-100">Sources</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              aria-label="Close sources"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto p-4 space-y-3">
            {sources.length === 0 ? (
              <li className="text-sm text-slate-500">No sources for this response.</li>
            ) : (
              sources.map((s, i) => (
                <li
                  key={s.chunk_id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-indigo-400">[{i + 1}]</span>
                    <span
                      className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400"
                      title="Confidence score"
                    >
                      {Math.round(s.confidence)}% certain
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-slate-200" title={s.filename}>
                    {s.filename}
                  </p>
                  {s.page != null && (
                    <p className="mt-1 text-xs text-slate-500">Page {s.page}</p>
                  )}
                  {s.text_snippet && (
                    <p className="mt-2 text-xs text-slate-400 line-clamp-3" title={s.text_snippet}>
                      {s.text_snippet}
                    </p>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>
    </>
  );
}
