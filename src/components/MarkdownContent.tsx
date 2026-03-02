import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { SourceItem } from '../lib/api';

interface MarkdownContentProps {
  content: string;
  sources?: SourceItem[];
  onCitationClick?: (index: number) => void;
  className?: string;
}

const sharedComponents: Components = {
  pre({ children, ...props }) {
    return (
      <pre
        className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-slate-800/80 p-4 text-sm"
        {...props}
      >
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }) {
    const isInline = !className?.includes('language-');
    if (isInline) {
      return (
        <code
          className="rounded bg-slate-700/80 px-1.5 py-0.5 font-mono text-sm text-slate-200"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`font-mono text-sm text-slate-200 ${className ?? ''}`} {...props}>
        {children}
      </code>
    );
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  ul({ children }) {
    return <ul className="my-2 list-disc pl-6 space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-2 list-decimal pl-6 space-y-1">{children}</ol>;
  },
  h1({ children }) {
    return <h1 className="mt-4 mb-2 text-lg font-bold text-slate-100">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mt-3 mb-1.5 text-base font-semibold text-slate-100">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mt-2 mb-1 text-sm font-semibold text-slate-100">{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-indigo-500/50 pl-4 my-2 text-slate-400">
        {children}
      </blockquote>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 underline hover:text-indigo-300"
      >
        {children}
      </a>
    );
  },
};

/** Renders markdown and code blocks; citation patterns [1], [2] become clickable buttons. */
export function MarkdownContent({
  content,
  sources = [],
  onCitationClick,
  className = '',
}: MarkdownContentProps) {
  const parts = content.split(/(\[\d+\])/g);

  return (
    <div className={`prose prose-invert max-w-none text-slate-200 ${className}`}>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m && onCitationClick) {
          const num = parseInt(m[1], 10);
          const hasSource = num >= 1 && num <= sources.length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => hasSource && onCitationClick(num - 1)}
              className={
                hasSource
                  ? 'mx-0.5 align-baseline rounded px-1.5 py-0 text-sm font-medium text-indigo-400 underline decoration-indigo-500/50 underline-offset-2 hover:bg-indigo-500/20 hover:no-underline'
                  : 'mx-0.5 text-slate-500'
              }
              aria-label={hasSource ? `Source ${num}` : undefined}
            >
              {part}
            </button>
          );
        }
        if (!part) return null;
        return (
          <span key={i} className="inline [&>*:first-child]:inline [&>*:first-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedComponents}>
              {part}
            </ReactMarkdown>
          </span>
        );
      })}
    </div>
  );
}
