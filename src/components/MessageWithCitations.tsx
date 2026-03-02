import type { SourceItem } from '../lib/api';

interface MessageWithCitationsProps {
  content: string;
  sources: SourceItem[];
  onCitationClick?: (index: number) => void;
  isStreaming?: boolean;
  streamingContent?: string;
}

// Split content by citation markers [1], [2], ... and render links
export function MessageWithCitations({
  content,
  sources,
  onCitationClick,
  isStreaming = false,
  streamingContent = '',
}: MessageWithCitationsProps) {
  const displayText = isStreaming ? streamingContent : content;
  // Match [1], [2], ... (citation indices)
  const parts = displayText.split(/(\[\d+\])/g);

  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match && onCitationClick) {
          const num = parseInt(match[1], 10);
          const sourceIndex = num - 1;
          const hasSource = sourceIndex >= 0 && sourceIndex < sources.length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => hasSource && onCitationClick(sourceIndex)}
              className={
                hasSource
                  ? 'mx-0.5 inline-flex align-baseline rounded px-1.5 py-0 text-sm font-medium text-indigo-400 underline decoration-indigo-500/50 underline-offset-2 hover:bg-indigo-500/20 hover:no-underline'
                  : 'mx-0.5 text-slate-400'
              }
              aria-label={hasSource ? `Source ${num}` : undefined}
            >
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
