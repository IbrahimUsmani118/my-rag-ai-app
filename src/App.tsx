import { ChatInterface } from './components/ChatInterface';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">RAG Chat</h1>
            <p className="text-xs text-slate-500">Ask questions about your documents</p>
          </div>
        </div>
      </header>
      <ChatInterface />
    </div>
  );
}
