import { useState, useCallback } from 'react';
import { ChatPanel, type ChatMessage } from './components/ChatPanel';
import { postQuery } from './lib/api';
import { useStreamingText } from './hooks/useStreamingText';

function nextId() {
  return crypto.randomUUID();
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Awaited<ReturnType<typeof postQuery>>['sources']>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const lastAssistant = messages.filter((m) => m.role === 'assistant').at(-1);
  const streamingFullText = streamingMessageId && lastAssistant?.id === streamingMessageId ? lastAssistant.content : '';
  const streamingContent = useStreamingText(streamingFullText, !!streamingMessageId);

  const onCitationClick = useCallback((index: number) => {
    setSourcesOpen(true);
  }, []);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: question }]);
    setLoading(true);
    setSources([]);

    try {
      const data = await postQuery(question);
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: data.response,
          sources: data.sources,
        },
      ]);
      setSources(data.sources);
      setStreamingMessageId(assistantId);
      // Stop streaming state after animation would complete (roughly word count * 40ms)
      const wordCount = data.response.split(/\s+/).length;
      setTimeout(() => setStreamingMessageId(null), wordCount * 45 + 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: `Error: ${message}`,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-100">RAG Chat</h1>
          <p className="text-xs text-slate-500">Ask questions about your documents</p>
        </div>
      </header>
      <ChatPanel
        messages={messages}
        loading={loading}
        sources={sources}
        sourcesOpen={sourcesOpen}
        onCloseSources={() => setSourcesOpen(false)}
        onCitationClick={onCitationClick}
        streamingMessageId={streamingMessageId}
        streamingContent={streamingContent}
        input={input}
        onInputChange={setInput}
        onSend={send}
      />
    </div>
  );
}
