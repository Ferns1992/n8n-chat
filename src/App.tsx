import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2, Bot, User, Loader2, MessageSquare, Plus, Lock, LogIn, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  // Check if already authenticated
  // but we can check if we can fetch messages)
  useEffect(() => {
    if (isAuthenticated) {
      fetchMessages();
    }
  }, [isAuthenticated]);

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/messages');
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setMessages(data);
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      } else {
        console.error('Unexpected response from server:', await response.text());
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // For this demo/app, we'll use a simple password check
    // In a real app, this would be a backend call
    if (password === 'fabian') { 
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid password');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userContent }),
      });

      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setMessages(prev => [...prev, data.userMessage, data.assistantMessage]);
      } else {
        const errorText = await response.text();
        console.error('Failed to send message. Server returned:', errorText);
        // Optionally show an error message in the UI
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear your chat history?')) return;
    setIsDeleting(true);
    try {
      const response = await fetch('/api/messages', { method: 'DELETE' });
      if (response.ok) {
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white font-sans p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">n8n Chat Connect</h1>
            <p className="text-zinc-500 text-sm mt-2">Secure access to your automation workflows</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">
                Access Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
                />
              </div>
              {loginError && <p className="text-red-500 text-xs ml-1">{loginError}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20"
            >
              <LogIn size={20} />
              Sign In
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest">
              Enterprise Grade Security • n8n.io
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Bot size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">n8n Chat Connect</h1>
            <p className="text-xs text-zinc-500 font-medium">Connected to Workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={clearHistory}
            disabled={isDeleting || messages.length === 0}
            className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-red-400 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            title="Clear History"
          >
            {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
          </button>
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-400 transition-all active:scale-95"
            title="Logout"
          >
            <LogIn size={20} className="rotate-180" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8 space-y-8 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5">
              <MessageSquare size={32} className="text-zinc-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-medium text-zinc-200">Start a conversation</h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Connect your n8n workflows to this interface and start interacting with your automated agents.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 w-full">
              {['How does this work?', 'What can you do?', 'Help me with a workflow'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); }}
                  className="px-4 py-3 rounded-xl bg-zinc-900/50 border border-white/5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all text-left flex items-center justify-between group"
                >
                  {suggestion}
                  <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                    msg.role === 'assistant' ? 'bg-blue-600' : 'bg-zinc-800'
                  }`}>
                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed relative group ${
                      msg.role === 'assistant' 
                        ? 'bg-zinc-900/80 border border-white/5 text-zinc-200' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      <div className="markdown-body mb-1">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      <div className={`text-[9px] opacity-40 mt-1 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex gap-4"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <Bot size={16} />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 font-medium mr-1">Assistant is thinking</span>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-gradient-to-t from-black via-black to-transparent">
        <div className="max-w-3xl mx-auto relative">
          <form 
            onSubmit={handleSend}
            className="relative flex items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-zinc-900/80 border border-white/10 rounded-2xl px-6 py-4 pr-16 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600/50 transition-all placeholder-zinc-600 backdrop-blur-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-blue-600/20"
            >
              <Send size={20} />
            </button>
          </form>
          <p className="text-center text-[10px] text-zinc-600 mt-3">
            Powered by n8n • Persistent Session Memory Enabled
          </p>
        </div>
      </footer>
    </div>
  );
}
