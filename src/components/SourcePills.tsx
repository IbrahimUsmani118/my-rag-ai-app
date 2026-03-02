import type { SourceItem } from '../lib/api';

interface SourcePillsProps {
  sources: SourceItem[];
  onPillClick?: (sources: SourceItem[]) => void;
}

/** Clickable pills at the bottom of an AI response: filename and page (and optional confidence). */
export function SourcePills({ sources, onPillClick }: SourcePillsProps) {
  if (!sources.length) return null;

  const handleClick = () => {
    onPillClick?.(sources);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
      {sources.map((s) => (
        <button
          key={s.chunk_id}
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-indigo-500/20 hover:border-indigo-500/30 hover:text-indigo-300"
          title={`${s.filename}${s.page != null ? ` · Page ${s.page}` : ''} · ${Math.round(s.confidence)}% match`}
        >
          <span className="max-w-[120px] truncate font-medium" title={s.filename}>
            {s.filename}
          </span>
          {s.page != null && (
            <span className="text-slate-500">p.{s.page}</span>
          )}
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            {Math.round(s.confidence)}%
          </span>
        </button>
      ))}
    </div>
  );
}
