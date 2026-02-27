import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Plus, 
  MessageSquare, 
  History, 
  Settings, 
  MoreVertical, 
  Bot, 
  User,
  Loader2,
  Trash2,
  ChevronLeft,
  Menu,
  Share,
  Info,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Message, ChatSession } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (e) {
      console.error("Auth check failed", e);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Load sessions from localStorage
  useEffect(() => {
    if (!user) return;
    const savedSessions = localStorage.getItem(`chat_sessions_${user.email}`);
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) {
        setCurrentSessionId(parsed[0].id);
      } else {
        createNewSession();
      }
    } else {
      createNewSession();
    }

    const handleResize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [user]);

  // Save sessions to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(`chat_sessions_${user.email}`, JSON.stringify(sessions));
    }
  }, [sessions, user]);

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId && user) {
      fetchHistory(currentSessionId);
    }
  }, [currentSessionId, user]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/history/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      timestamp: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !currentSessionId || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Update session title if it's the first message
    if (messages.length === 0) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, title: input.slice(0, 30) + (input.length > 30 ? '...' : '') } : s
      ));
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: currentSessionId, 
          message: input,
          chatInput: input,
          text: input
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send message');

      setMessages(prev => [...prev, data]);
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `**Error:** ${error.message}\n\nPlease ensure your n8n workflow is active and the webhook URL is correct.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setSessions([]);
    setMessages([]);
    setCurrentSessionId(null);
  };

  if (isCheckingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={checkAuth} />;
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Sidebar - iPadOS Style */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-[280px] h-full glass border-r border-white/5 flex flex-col z-30 absolute md:relative"
          >
            <div className="p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Chats</h2>
              <button
                onClick={createNewSession}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors ios-button"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    setCurrentSessionId(session.id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ios-button",
                    currentSessionId === session.id 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <MessageSquare size={18} className={currentSessionId === session.id ? "text-white" : "text-zinc-500"} />
                  <span className="flex-1 truncate text-[15px] font-medium">{session.title}</span>
                  <Trash2 
                    size={14} 
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      currentSessionId === session.id ? "text-white/70 hover:text-white" : "text-zinc-600 hover:text-red-400"
                    )}
                    onClick={(e) => deleteSession(session.id, e)}
                  />
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md">
              <div 
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white cursor-pointer transition-colors rounded-xl hover:bg-white/5"
              >
                <User size={18} />
                <span className="text-sm font-medium truncate flex-1">{user.email}</span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase">Logout</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-zinc-950">
        {/* iOS Style Header */}
        <header className="h-16 flex items-center justify-between px-4 glass border-b border-white/5 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-full text-zinc-400 transition-colors ios-button"
            >
              <Menu size={20} />
            </button>
            
            {/* Dynamic Island Style Status */}
            <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">n8n Live</span>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h1 className="text-sm font-bold tracking-tight">n8n Assistant</h1>
            <span className="text-[10px] text-zinc-500 font-medium">Always Active</span>
          </div>

          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-white/10 rounded-full text-zinc-400 transition-colors ios-button">
              <Share size={18} />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-full text-zinc-400 transition-colors ios-button">
              <Info size={18} />
            </button>
          </div>
        </header>

        {/* Messages - iMessage Style */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/20"
              >
                <Sparkles size={40} className="text-white" />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">Hello, I'm your n8n Assistant</h2>
                <p className="text-zinc-500 max-w-xs mx-auto text-[15px]">How can I help you automate your day today?</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mt-8">
                {[
                  { label: 'Check my tasks', icon: '✅' },
                  { label: 'Generate a report', icon: '📊' },
                  { label: 'Summarize emails', icon: '✉️' },
                  { label: 'Help with coding', icon: '💻' }
                ].map(item => (
                  <button 
                    key={item.label}
                    onClick={() => { setInput(item.label); }}
                    className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl text-[14px] text-zinc-300 hover:bg-white/5 hover:border-white/10 transition-all text-left flex items-center gap-3 ios-button"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full space-y-6">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                  className={cn(
                    "flex w-full",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "flex flex-col gap-1.5 max-w-[85%]",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "px-4 py-2.5 rounded-[20px] shadow-sm",
                      msg.role === 'user' 
                        ? "bg-blue-600 text-white rounded-tr-[4px]" 
                        : "bg-zinc-800 text-zinc-100 rounded-tl-[4px]"
                    )}>
                      <div className="markdown-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    {msg.timestamp && (
                      <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-zinc-800 px-5 py-3 rounded-[20px] rounded-tl-[4px] flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* iOS Style Input Area */}
        <div className="p-4 md:p-8 glass border-t border-white/5">
          <form 
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto flex items-end gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Message"
                className="w-full bg-white/5 border border-white/10 rounded-[24px] px-5 py-3 pr-12 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600 resize-none max-h-32"
                style={{ height: '46px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "absolute right-1.5 bottom-1.5 p-2 rounded-full transition-all ios-button",
                  input.trim() && !isLoading
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-transparent text-zinc-700 cursor-not-allowed"
                )}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </form>
          <div className="flex justify-center mt-4">
            <div className="w-32 h-1 bg-white/10 rounded-full" />
          </div>
        </div>
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (e) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-black p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-[400px] space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 mx-auto mb-6">
            <Sparkles size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">n8n Chat</h1>
          <p className="text-zinc-500">Sign in to your automation hub</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl px-5 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
              required
            />
          </div>
          <div className="space-y-1">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl px-5 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
              required
            />
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm text-center font-medium"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-zinc-600 text-xs uppercase tracking-widest font-bold">
          Apple Design Language • PWA Ready
        </p>
      </motion.div>
    </div>
  );
}
