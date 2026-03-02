import { MessageCircle, Send } from 'lucide-react';
import { SkeletonLoader } from './SkeletonLoader';
import { SourcesPanel } from './SourcesPanel';
import { MessageWithCitations } from './MessageWithCitations';
import type { SourceItem } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
}

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  sources: SourceItem[];
  sourcesOpen: boolean;
  onCloseSources: () => void;
  onCitationClick: (index: number) => void;
  streamingMessageId: string | null;
  streamingContent: string;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
}

export function ChatPanel({
  messages,
  loading,
  sources,
  sourcesOpen,
  onCloseSources,
  onCitationClick,
  streamingMessageId,
  streamingContent,
  input,
  onInputChange,
  onSend,
}: ChatPanelProps) {
  return (
    <div className="flex h-screen flex-col">
      {/* Glassmorphic chat area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <MessageCircle className="mx-auto h-12 w-12 text-indigo-400/80" />
              </div>
              <p className="text-slate-400">Ask anything about your documents.</p>
              <p className="text-sm text-slate-500">Responses are grounded in uploaded PDFs.</p>
            </div>
          )}

          <ul className="space-y-6">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
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
                    <MessageWithCitations
                      content={msg.content}
                      sources={msg.sources ?? []}
                      onCitationClick={onCitationClick}
                      isStreaming={streamingMessageId === msg.id}
                      streamingContent={
                        streamingMessageId === msg.id ? streamingContent : msg.content
                      }
                    />
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

        {/* Input area */}
        <div className="border-t border-white/10 bg-slate-900/50 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSend();
              }}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-xl backdrop-blur-sm"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
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

      <SourcesPanel sources={sources} onClose={onCloseSources} isOpen={sourcesOpen} />
    </div>
  );
}
