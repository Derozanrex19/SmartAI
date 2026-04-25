import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, X, Sparkles, Send, Loader2, MessageSquare, Mail, Clock } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import MessageCard from '../components/MessageCard';
import { supabase } from '../lib/supabase';

interface DbMessage {
  id: string;
  ticket_id: string;
  first_name: string;
  last_name: string;
  email: string;
  category: string;
  message: string;
  priority: string;
  created_at: string;
  ai_sentiment: string | null;
  ai_category: string | null;
  ai_confidence: number | null;
  ai_draft: string | null;
  final_response: string | null;
}

interface UiMessage {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  category: string;
  customerCategory: string;
  message: string;
  priority: string;
  timestamp: string;
  sentiment: string | null;
  aiCategory: string | null;
  confidence: number | null;
  aiDraft: string | null;
  finalResponse: string | null;
}

interface AiWebhookResponse {
  sentiment?: string;
  category?: string;
  confidence?: number;
  draft_response?: string;
}

interface SendEmailResponse {
  ok?: boolean;
  provider?: string;
  deliveryStatus?: 'queued' | 'sent' | 'failed';
  messageId?: string | null;
}

const VALID_CATEGORIES = ['technical', 'billing', 'feedback', 'other'] as const;
const VALID_SENTIMENTS = ['frustrated', 'neutral', 'happy'] as const;

function normalizeCategory(value: string | undefined, fallbackMessage: string): string {
  const raw = (value || '').trim().toLowerCase();
  if ((VALID_CATEGORIES as readonly string[]).includes(raw)) {
    return raw;
  }

  const message = fallbackMessage.toLowerCase();
  if (/(charge|refund|invoice|payment|billing|subscription|price|credit card)/.test(message)) return 'billing';
  if (/(bug|error|crash|upload|login|technical|issue|fail|broken|not working)/.test(message)) return 'technical';
  if (/(feature|feedback|suggest|love|great|improve|idea)/.test(message)) return 'feedback';
  return 'other';
}

function normalizeSentiment(value: string | undefined, fallbackMessage: string): string {
  const raw = (value || '').trim().toLowerCase();
  if ((VALID_SENTIMENTS as readonly string[]).includes(raw)) {
    return raw;
  }

  const message = fallbackMessage.toLowerCase();
  if (/(angry|frustrat|terrible|hate|worst|not working|urgent|complain|sucks)/.test(message)) return 'frustrated';
  if (/(love|great|awesome|thanks|happy|excellent)/.test(message)) return 'happy';
  return 'neutral';
}

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toTitleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function suggestedPriorityFromSentiment(sentiment: string | null): 'Low' | 'Medium' | 'High' | 'Pending' {
  if (!sentiment) return 'Pending';
  if (sentiment.toLowerCase() === 'frustrated') return 'High';
  if (sentiment.toLowerCase() === 'neutral') return 'Medium';
  if (sentiment.toLowerCase() === 'happy') return 'Low';
  return 'Medium';
}

export default function Dashboard() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<UiMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'queued'>('idle');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;

  const loadMessages = async () => {
    setIsLoading(true);
    setLoadError('');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setIsLoading(false);
      navigate('/login');
      return;
    }

    setCurrentUser(authData.user);

    const { data, error } = await supabase
      .from('messages')
      .select('id,ticket_id,first_name,last_name,email,category,message,priority,created_at,ai_sentiment,ai_category,ai_confidence,ai_draft,final_response')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(error.message || 'Unable to load messages.');
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const formatted = ((data || []) as DbMessage[]).map((msg) => ({
      id: msg.ticket_id || msg.id,
      firstName: msg.first_name,
      lastName: msg.last_name,
      email: msg.email,
      category: msg.ai_category ? toTitleCase(msg.ai_category) : 'Pending AI',
      customerCategory: toTitleCase(msg.category),
      message: msg.message,
      priority: toTitleCase(msg.priority),
      timestamp: msg.created_at,
      sentiment: msg.ai_sentiment ? toTitleCase(msg.ai_sentiment) : null,
      aiCategory: msg.ai_category ? toTitleCase(msg.ai_category) : null,
      confidence: msg.ai_confidence,
      aiDraft: msg.ai_draft,
      finalResponse: msg.final_response
    }));

    setMessages(formatted);
    setIsLoading(false);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleGenerateResponse = async () => {
    if (!selectedMessage) return;

    if (!n8nWebhookUrl) {
      setLoadError('Missing VITE_N8N_WEBHOOK_URL in your environment config.');
      return;
    }

    setIsGenerating(true);
    setLoadError('');

    const payload = {
      ticketId: selectedMessage.id,
      firstName: selectedMessage.firstName,
      lastName: selectedMessage.lastName,
      email: selectedMessage.email,
      category: 'unspecified',
      priority: selectedMessage.priority,
      message: selectedMessage.message
    };

    try {
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook call failed with status ${response.status}`);
      }

      const aiData = await response.json() as AiWebhookResponse;
      const sentiment = normalizeSentiment(aiData.sentiment, selectedMessage.message);
      const aiCategory = normalizeCategory(aiData.category, selectedMessage.message);
      const confidence = normalizeConfidence(aiData.confidence);
      const generatedDraft = aiData.draft_response || '';

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          ai_sentiment: sentiment,
          ai_category: aiCategory,
          ai_confidence: confidence,
          ai_draft: generatedDraft,
          ai_processed_at: new Date().toISOString(),
          ai_error: null,
          status: 'ai_ready'
        })
        .eq('ticket_id', selectedMessage.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setAiDraft(generatedDraft);
      setSelectedMessage((current) => {
        if (!current) return current;
        return {
          ...current,
          category: toTitleCase(aiCategory),
          sentiment: toTitleCase(sentiment),
          aiCategory: toTitleCase(aiCategory),
          confidence,
          aiDraft: generatedDraft
        };
      });

      await loadMessages();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate AI response.';
      setLoadError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendResponse = async () => {
    if (!selectedMessage || !aiDraft || !currentUser) return;

    setIsSending(true);
    setStatus('sending');

    const { data: sendData, error: functionError } = await supabase.functions.invoke<SendEmailResponse>('send-support-response', {
      body: {
        ticketId: selectedMessage.id,
        toEmail: selectedMessage.email,
        customerName: `${selectedMessage.firstName} ${selectedMessage.lastName}`,
        aiCategory: selectedMessage.aiCategory || 'other',
        sentiment: selectedMessage.sentiment || 'neutral',
        responseText: aiDraft
      }
    });

    if (functionError) {
      setIsSending(false);
      setStatus('idle');
      setLoadError(functionError.message || 'Unable to send email response.');
      return;
    }

    if (!sendData?.ok) {
      setIsSending(false);
      setStatus('idle');
      setLoadError('Email provider did not accept the message.');
      return;
    }

    const { error } = await supabase
      .from('messages')
      .update({
        final_response: aiDraft,
        responded_by: currentUser.id,
        responded_at: new Date().toISOString(),
        status: 'responded'
      })
      .eq('ticket_id', selectedMessage.id);

    if (error) {
      setIsSending(false);
      setStatus('idle');
      setLoadError(error.message || 'Unable to send response.');
      return;
    }

    setStatus('queued');
    await loadMessages();

    setTimeout(() => {
      setStatus('idle');
      setAiDraft('');
      setSelectedMessage(null);
      setIsSending(false);
    }, 1200);
  };

  const filteredMessages = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return messages;

    return messages.filter((msg) =>
      `${msg.id} ${msg.firstName} ${msg.lastName} ${msg.email} ${msg.category} ${msg.message}`
        .toLowerCase()
        .includes(term)
    );
  }, [messages, searchTerm]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-dark">
      <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-bg-dark/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-primary to-secondary rounded-lg" />
          <span className="text-xl font-bold tracking-tight">Support<span className="text-secondary">IQ</span> Admin</span>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-xs text-text-muted font-semibold uppercase tracking-widest hidden md:inline">Live Environment</span>
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 border border-border rounded-full text-xs font-semibold hover:bg-border transition-colors uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto w-full">
        <div className="lg:col-span-3 space-y-8">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold mb-4">Navigation</h2>
            <nav className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/10 text-primary font-bold text-sm">
                <MessageSquare className="w-4 h-4" /> Inbox
                <span className="ml-auto bg-primary text-white text-[10px] py-0.5 px-2 rounded-full">{filteredMessages.length}</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="lg:col-span-9">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Customer Messages</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-1.5 text-sm w-64 bg-bg-card border-border"
                />
              </div>
              <button className="glass-morphism p-2 rounded-lg hover:border-primary/50" aria-label="Filter messages">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isLoading && <p className="text-text-muted">Loading messages...</p>}
          {!isLoading && loadError && <p className="text-error text-sm">{loadError}</p>}
          {!isLoading && !loadError && filteredMessages.length === 0 && (
            <p className="text-text-muted text-sm">No tickets found yet.</p>
          )}

          {!isLoading && !loadError && filteredMessages.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMessages.map((msg) => (
                <MessageCard
                  key={msg.id}
                  message={msg}
                  onClick={(chosenMessage) => {
                    const chosen = chosenMessage as UiMessage;
                    setSelectedMessage(chosen);
                    setAiDraft(chosen.aiDraft || chosen.finalResponse || '');
                    setLoadError('');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg-dark/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-morphism rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-bg-card/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                    {selectedMessage.firstName[0]}{selectedMessage.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">{selectedMessage.firstName} {selectedMessage.lastName}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {selectedMessage.email}
                      </span>
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(selectedMessage.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                <div className="space-y-6 lg:col-span-5">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{selectedMessage.aiCategory || 'Untriaged'} Issue</h1>
                    <p className="text-text-muted flex items-center gap-2 text-sm font-medium">
                      <span className={`w-2 h-2 rounded-full ${
                        selectedMessage.priority === 'High' ? 'bg-error' :
                        selectedMessage.priority === 'Medium' ? 'bg-amber-500' :
                        'bg-success'
                      }`}
                      />
                      Ticket ID: {selectedMessage.id} | From: {selectedMessage.email}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-bg-card border border-border text-text-muted">
                        Customer: {selectedMessage.customerCategory}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-bg-card border border-border text-text-muted">
                        AI: {selectedMessage.aiCategory || 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-bg-card p-6 rounded-2xl border border-border shadow-inner">
                    <p className="text-base lg:text-lg leading-relaxed text-text-light font-medium italic">
                      "{selectedMessage.message}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="px-4 py-4 min-h-[96px] bg-bg-card/50 border border-border rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1 font-bold">Sentiment</p>
                      <p className="text-base lg:text-lg leading-tight break-words font-bold text-primary">
                        {selectedMessage.sentiment || 'Pending'}
                      </p>
                    </div>
                    <div className="px-4 py-4 min-h-[96px] bg-bg-card/50 border border-border rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1 font-bold">Priority</p>
                      <p className={`text-base lg:text-lg leading-tight break-words font-bold ${
                        selectedMessage.priority === 'High' ? 'text-secondary' :
                        selectedMessage.priority === 'Medium' ? 'text-amber-500' :
                        'text-success'
                      }`}
                      >
                        {selectedMessage.priority}
                      </p>
                    </div>
                    <div className="px-4 py-4 min-h-[96px] bg-bg-card/50 border border-border rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1 font-bold">AI Priority</p>
                      <p className="text-base lg:text-lg leading-tight break-words font-bold text-secondary">
                        {suggestedPriorityFromSentiment(selectedMessage.sentiment)}
                      </p>
                    </div>
                    <div className="px-4 py-4 min-h-[96px] bg-bg-card/50 border border-border rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1 font-bold">Confidence</p>
                      <p className="text-base lg:text-lg leading-tight break-words font-bold text-success">
                        {selectedMessage.confidence != null ? `${selectedMessage.confidence}%` : 'Pending'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col h-full bg-bg-card/20 rounded-2xl p-6 lg:p-7 border border-border lg:col-span-7">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-secondary" /> AI Response Draft
                    </h4>
                    <button
                      onClick={handleGenerateResponse}
                      disabled={isGenerating}
                      className="text-[10px] font-bold uppercase tracking-tighter text-secondary hover:text-secondary/80 transition-colors"
                    >
                      {isGenerating ? 'GENERATE...' : 'RE-GENERATE'}
                    </button>
                  </div>

                  <div className="relative flex-1">
                    <textarea
                      value={aiDraft}
                      onChange={(e) => setAiDraft(e.target.value)}
                      placeholder={isGenerating ? 'AI is analyzing context and drafting response...' : 'The generated response will appear here.'}
                      className="w-full h-full min-h-[280px] resize-none font-sans text-sm leading-relaxed bg-bg-card/40 border border-border rounded-xl p-4 focus:ring-1 focus:ring-primary/60"
                    />
                    {!aiDraft && !isGenerating && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-text-muted opacity-20">
                        <Sparkles className="w-16 h-16 mb-4" />
                        <p className="font-bold uppercase tracking-widest text-xs">Ready to Draft</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-border flex gap-4">
                    <button
                      onClick={handleSendResponse}
                      disabled={!aiDraft || status !== 'idle' || isSending}
                      className="btn-primary flex-1 py-4 text-sm flex items-center justify-center gap-3"
                    >
                      {status === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                        status === 'queued' ? 'Email Queued' :
                          <><Send className="w-4 h-4" /> Send Response</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
