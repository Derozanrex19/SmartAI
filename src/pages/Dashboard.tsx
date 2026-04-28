import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  Send,
  Loader2,
  MessageSquare,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import emailjs from '@emailjs/browser';
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
  status: string | null;
  created_at: string;
  responded_at: string | null;
  ai_sentiment: string | null;
  ai_category: string | null;
  ai_priority: string | null;
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
  respondedAt: string | null;
  replied: boolean;
  sentiment: string | null;
  aiCategory: string | null;
  confidence: number | null;
  aiDraft: string | null;
  finalResponse: string | null;
  status: string;
}

interface AiWebhookResponse {
  sentiment?: string;
  category?: string;
  priority?: string;
  confidence?: number;
  draft_response?: string;
  status?: string;
  route_action?: string;
  auto_sent?: boolean;
  responded_at?: string | null;
  final_response?: string | null;
  email_error?: string | null;
  ai_error?: string | null;
}

const VALID_CATEGORIES = ['technical', 'billing', 'feedback', 'other'] as const;
const VALID_SENTIMENTS = ['frustrated', 'neutral', 'happy'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;
const VALID_STATUSES = ['new', 'ai_ready', 'needs_human', 'responded', 'ai_generating'] as const;
const FALLBACK_DRAFT = 'Thanks for contacting SupportIQ. Our team will review your ticket and respond shortly.';
const AI_REQUEST_TIMEOUT_MS = 60000;
const AI_TIMEOUT_COOLDOWN_MS = 30000;

function normalizeCategory(value: string | undefined, fallbackMessage: string): string {
  const raw = (value || '').trim().toLowerCase();
  if ((VALID_CATEGORIES as readonly string[]).includes(raw)) return raw;
  const message = fallbackMessage.toLowerCase();
  if (/(charge|refund|invoice|payment|billing|subscription|price|credit card)/.test(message)) return 'billing';
  if (/(bug|error|crash|upload|login|technical|issue|fail|broken|not working)/.test(message)) return 'technical';
  if (/(feature|feedback|suggest|love|great|improve|idea)/.test(message)) return 'feedback';
  return 'other';
}

function normalizeSentiment(value: string | undefined, fallbackMessage: string): string {
  const raw = (value || '').trim().toLowerCase();
  if ((VALID_SENTIMENTS as readonly string[]).includes(raw)) return raw;
  const message = fallbackMessage.toLowerCase();
  if (/(angry|frustrat|terrible|hate|worst|not working|urgent|complain|sucks)/.test(message)) return 'frustrated';
  if (/(love|great|awesome|thanks|happy|excellent)/.test(message)) return 'happy';
  return 'neutral';
}

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizePriority(value: string | undefined): string | null {
  const raw = (value || '').trim().toLowerCase();
  if ((VALID_PRIORITIES as readonly string[]).includes(raw)) return raw;
  return null;
}

function normalizeStatus(value: string | undefined, fallback: string): string {
  const raw = (value || '').trim().toLowerCase();
  if ((VALID_STATUSES as readonly string[]).includes(raw)) return raw;
  return fallback;
}

function inferPriorityFromMessage(message: string, category?: string, sentiment?: string): string {
  const normalizedMessage = message.trim().toLowerCase();
  const normalizedCategory = (category || '').trim().toLowerCase();
  const normalizedSentiment = (sentiment || '').trim().toLowerCase();

  const urgentPatterns = [
    /\burgent\b/,
    /\basap\b/,
    /\bimmediately\b/,
    /\bright now\b/,
    /\bcritical\b/,
    /\bsevere\b/,
    /\bproduction\b/,
    /\bdown\b/,
    /\boutage\b/,
    /\bblocked\b/,
    /\bcan'?t access\b/,
    /\bcannot access\b/,
    /\bunable to access\b/,
    /\bnot working at all\b/,
    /\bcompletely broken\b/,
    /\baccount locked\b/,
    /\bcharged twice\b/,
    /\bfraud\b/,
    /\bunauthorized charge\b/
  ];

  const mediumPatterns = [
    /\berror\b/,
    /\bissue\b/,
    /\bproblem\b/,
    /\bbug\b/,
    /\bfailed\b/,
    /\bnot working\b/,
    /\brefund\b/,
    /\bbilling\b/,
    /\binvoice\b/,
    /\bpayment\b/,
    /\blogin\b/,
    /\bcrash\b/,
    /\bslow\b/,
    /\bunable\b/,
    /\bdelay\b/
  ];

  const lowPatterns = [
    /\bfeature request\b/,
    /\bsuggestion\b/,
    /\bidea\b/,
    /\bfeedback\b/,
    /\bjust wanted to ask\b/,
    /\bcurious\b/,
    /\bthank you\b/,
    /\blove\b/,
    /\bgreat\b/
  ];

  const isHigh =
    urgentPatterns.some((pattern) => pattern.test(normalizedMessage)) ||
    (normalizedSentiment === 'frustrated' &&
      /(still|again|days|weeks|multiple|repeated|repeatedly|cannot|can't|unable)/.test(normalizedMessage)) ||
    (normalizedCategory === 'technical' &&
      /(production|down|blocked|login|cannot access|can't access|unable to access)/.test(normalizedMessage));

  if (isHigh) return 'high';

  const isLow =
    lowPatterns.some((pattern) => pattern.test(normalizedMessage)) ||
    normalizedCategory === 'feedback' ||
    normalizedSentiment === 'happy';

  if (isLow && !mediumPatterns.some((pattern) => pattern.test(normalizedMessage))) {
    return 'low';
  }

  if (mediumPatterns.some((pattern) => pattern.test(normalizedMessage))) {
    return 'medium';
  }

  return 'medium';
}

function toTitleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildFallbackAiResponse(reason: string): AiWebhookResponse {
  return {
    sentiment: 'neutral',
    category: 'other',
    priority: 'medium',
    confidence: 0,
    draft_response: FALLBACK_DRAFT,
    status: 'needs_human',
    route_action: 'needs_human',
    auto_sent: false,
    responded_at: null,
    final_response: null,
    email_error: null,
    ai_error: reason
  };
}

function formatAiFailureForDisplay(reason: string): string {
  const normalized = reason.toLowerCase();
  const isHighDemand =
    /high demand|service unavailable|try again later|overload|overloaded|capacity|rate limit|too many requests|quota|resource exhausted|429|503/.test(normalized);

  if (isHighDemand) {
    return 'AI service is currently under high demand (capacity/rate-limit issue). Manual review is enabled for now. Please retry Generate shortly.';
  }

  return `AI failed: ${reason}`;
}

export default function Dashboard() {
  const PAGE_SIZE = 6;
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<UiMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [modalError, setModalError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingPage, setPendingPage] = useState(1);
  const [repliedPage, setRepliedPage] = useState(1);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const inFlightGenerationRef = useRef<Set<string>>(new Set());
  const generationCooldownRef = useRef<Map<string, number>>(new Map());
  const [cooldownTick, setCooldownTick] = useState(() => Date.now());
  const [generatingTicketId, setGeneratingTicketId] = useState<string | null>(null);
  const navigate = useNavigate();

  const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
  const emailJsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const emailJsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
  const emailJsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

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
      .select('id,ticket_id,first_name,last_name,email,category,message,priority,status,created_at,responded_at,ai_sentiment,ai_category,ai_priority,ai_confidence,ai_draft,final_response')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(error.message || 'Unable to load messages.');
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const formatted = ((data || []) as DbMessage[]).map((msg) => {
      const replied = msg.status === 'responded' || Boolean(msg.final_response);
      return {
        id: msg.ticket_id || msg.id,
        firstName: msg.first_name,
        lastName: msg.last_name,
        email: msg.email,
        category: msg.ai_category ? toTitleCase(msg.ai_category) : 'Pending AI',
        customerCategory: toTitleCase(msg.category),
        message: msg.message,
        priority: msg.ai_priority ? toTitleCase(msg.ai_priority) : 'Pending',
        timestamp: msg.created_at,
        respondedAt: msg.responded_at,
        replied,
        sentiment: msg.ai_sentiment ? toTitleCase(msg.ai_sentiment) : null,
        aiCategory: msg.ai_category ? toTitleCase(msg.ai_category) : null,
        confidence: msg.ai_confidence,
        aiDraft: msg.ai_draft,
        finalResponse: msg.final_response,
        status: msg.status || 'new'
      };
    });

    setMessages(formatted);
    setIsLoading(false);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCooldownTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const getCooldownRemainingSeconds = (ticketId: string): number => {
    const expiresAt = generationCooldownRef.current.get(ticketId);
    if (!expiresAt) return 0;

    const remainingMs = expiresAt - cooldownTick;
    if (remainingMs <= 0) {
      generationCooldownRef.current.delete(ticketId);
      return 0;
    }

    return Math.ceil(remainingMs / 1000);
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

  const pendingMessages = useMemo(() => filteredMessages.filter((message) => !message.replied), [filteredMessages]);
  const repliedMessages = useMemo(() => filteredMessages.filter((message) => message.replied), [filteredMessages]);
  const totalPendingPages = Math.max(1, Math.ceil(pendingMessages.length / PAGE_SIZE));
  const totalRepliedPages = Math.max(1, Math.ceil(repliedMessages.length / PAGE_SIZE));
  const pagedPendingMessages = useMemo(() => {
    const start = (pendingPage - 1) * PAGE_SIZE;
    return pendingMessages.slice(start, start + PAGE_SIZE);
  }, [pendingMessages, pendingPage]);
  const pagedRepliedMessages = useMemo(() => {
    const start = (repliedPage - 1) * PAGE_SIZE;
    return repliedMessages.slice(start, start + PAGE_SIZE);
  }, [repliedMessages, repliedPage]);

  useEffect(() => {
    setPendingPage(1);
    setRepliedPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (pendingPage > totalPendingPages) setPendingPage(totalPendingPages);
  }, [pendingPage, totalPendingPages]);

  useEffect(() => {
    if (repliedPage > totalRepliedPages) setRepliedPage(totalRepliedPages);
  }, [repliedPage, totalRepliedPages]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const runAiGeneration = async (message: UiMessage, trigger: 'auto' | 'manual') => {
    if (inFlightGenerationRef.current.has(message.id)) return;
    setModalError('');
    if (!n8nWebhookUrl) {
      setModalError('Missing VITE_N8N_WEBHOOK_URL in your environment config.');
      return;
    }
    const cooldownSeconds = getCooldownRemainingSeconds(message.id);
    if (cooldownSeconds > 0) {
      setModalError(`AI is cooling down for this ticket after timeout. Retry in ${cooldownSeconds}s.`);
      return;
    }

    inFlightGenerationRef.current.add(message.id);
    setIsGenerating(true);
    setGeneratingTicketId(message.id);

    const payload = {
      ticketId: message.id,
      firstName: message.firstName,
      lastName: message.lastName,
      email: message.email,
      category: 'unspecified',
      priority: 'unspecified',
      message: message.message
    };

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
      let aiData: AiWebhookResponse;
      let didTimeout = false;

      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        const rawResponse = await response.text();
        let parsedResponse: AiWebhookResponse = {};

        if (rawResponse.trim()) {
          try {
            parsedResponse = JSON.parse(rawResponse) as AiWebhookResponse;
          } catch {
            parsedResponse = buildFallbackAiResponse('AI workflow returned invalid JSON.');
          }
        } else {
          parsedResponse = buildFallbackAiResponse('AI workflow returned an empty response.');
        }

        if (!response.ok) {
          aiData = {
            ...parsedResponse,
            ...buildFallbackAiResponse(
              parsedResponse.ai_error || parsedResponse.email_error || `Webhook call failed with status ${response.status}`
            )
          };
        } else {
          aiData = parsedResponse;
        }
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          didTimeout = true;
          aiData = buildFallbackAiResponse('AI request timed out. Routed to manual review.');
        } else {
          aiData = buildFallbackAiResponse(
            fetchError instanceof Error ? fetchError.message : 'AI workflow unavailable.'
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
      }

      const sentiment = normalizeSentiment(aiData.sentiment, message.message);
      const aiCategory = normalizeCategory(aiData.category, message.message);
      const aiPriority = normalizePriority(aiData.priority);
      const resolvedPriority =
        aiPriority ?? inferPriorityFromMessage(message.message, aiCategory, sentiment);
      const confidence = normalizeConfidence(aiData.confidence);
      const generatedDraft = (aiData.draft_response || aiData.final_response || '').trim();
      const resolvedDraft = generatedDraft || FALLBACK_DRAFT;
      const defaultStatus = message.replied ? 'responded' : 'ai_ready';
      const normalizedStatus = normalizeStatus(aiData.status, defaultStatus);
      const shouldMarkResponded = message.replied || aiData.auto_sent === true || normalizedStatus === 'responded';
      const resolvedStatus = shouldMarkResponded ? 'responded' : normalizedStatus;
      const respondedAt = shouldMarkResponded
        ? (aiData.responded_at || message.respondedAt || new Date().toISOString())
        : null;
      const finalResponse = shouldMarkResponded
        ? (aiData.final_response || message.finalResponse || resolvedDraft)
        : null;

      if (didTimeout) {
        generationCooldownRef.current.set(message.id, Date.now() + AI_TIMEOUT_COOLDOWN_MS);
      }

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          ai_sentiment: sentiment,
          ai_category: aiCategory,
          ai_priority: resolvedPriority,
          ai_confidence: confidence,
          ai_draft: resolvedDraft,
          ai_processed_at: new Date().toISOString(),
          ai_error: aiData.ai_error || aiData.email_error || null,
          status: resolvedStatus,
          responded_at: respondedAt,
          final_response: finalResponse
        })
        .eq('ticket_id', message.id);

      if (updateError) throw new Error(updateError.message);

      if (selectedMessage?.id === message.id) {
        setAiDraft(resolvedDraft);
      }
      setSelectedMessage((current) =>
        current && current.id === message.id
          ? {
              ...current,
              category: toTitleCase(aiCategory),
              sentiment: toTitleCase(sentiment),
              aiCategory: toTitleCase(aiCategory),
              priority: toTitleCase(resolvedPriority),
              confidence,
              aiDraft: resolvedDraft,
              status: resolvedStatus,
              replied: shouldMarkResponded,
              respondedAt,
              finalResponse
            }
          : current
      );

      if (aiData.ai_error) {
        const readableError = formatAiFailureForDisplay(aiData.ai_error);
        const fallbackMessage = trigger === 'auto'
          ? `Auto-generation degraded: ${readableError}`
          : `Generation degraded: ${readableError}`;
        if (didTimeout) {
          const cooldownSecondsAfterTimeout = getCooldownRemainingSeconds(message.id);
          setModalError(
            `${fallbackMessage} Please wait ${cooldownSecondsAfterTimeout}s before retrying this ticket.`
          );
        } else {
          setModalError(fallbackMessage);
        }
      } else if (aiData.email_error && trigger === 'auto') {
        setModalError(`AI draft generated, but auto-send failed: ${aiData.email_error}`);
      }

      await loadMessages();
    } catch (error) {
      if (trigger === 'auto') {
        setModalError(error instanceof Error
          ? `Auto-generation failed: ${error.message}. You can still click Generate.`
          : 'Auto-generation failed. You can still click Generate.');
      } else {
        setModalError(error instanceof Error ? error.message : 'Unable to generate AI response.');
      }
    } finally {
      inFlightGenerationRef.current.delete(message.id);
      setGeneratingTicketId((current) => (current === message.id ? null : current));
      setIsGenerating(inFlightGenerationRef.current.size > 0);
    }
  };

  const handleGenerateResponse = async () => {
    if (!selectedMessage) return;
    await runAiGeneration(selectedMessage, 'manual');
  };

  const handleSendResponse = async () => {
    if (!selectedMessage || !aiDraft || !currentUser) return;
    setModalError('');

    if (!emailJsServiceId || !emailJsTemplateId || !emailJsPublicKey) {
      setModalError('Missing EmailJS environment variables.');
      return;
    }

    setIsSending(true);
    setStatus('sending');

    try {
      await emailjs.send(
        emailJsServiceId,
        emailJsTemplateId,
        {
          to_email: selectedMessage.email,
          to_name: `${selectedMessage.firstName} ${selectedMessage.lastName}`,
          ticket_id: selectedMessage.id,
          ai_category: selectedMessage.aiCategory || 'other',
          sentiment: selectedMessage.sentiment || 'neutral',
          response_message: aiDraft
        },
        { publicKey: emailJsPublicKey }
      );

      const respondedAt = new Date().toISOString();
      const { error } = await supabase
        .from('messages')
        .update({
          final_response: aiDraft,
          responded_by: currentUser.id,
          responded_at: respondedAt,
          status: 'responded'
        })
        .eq('ticket_id', selectedMessage.id);

      if (error) throw new Error(error.message || 'Unable to send response.');

      setStatus('sent');
      await loadMessages();

      setTimeout(() => {
        setStatus('idle');
        setSelectedMessage((current) =>
          current
            ? { ...current, replied: true, respondedAt, finalResponse: aiDraft }
            : current
        );
        setIsSending(false);
      }, 900);
    } catch (error) {
      let message = 'Unable to send email response.';
      if (error instanceof Error && error.message) {
        message = error.message;
      } else if (error && typeof error === 'object') {
        const knownError = error as { status?: number; text?: string; message?: string };
        if (knownError.text) {
          message = knownError.status ? `EmailJS ${knownError.status}: ${knownError.text}` : knownError.text;
        } else if (knownError.message) {
          message = knownError.message;
        }
      }
      setModalError(message);
      setStatus('idle');
      setIsSending(false);
    }
  };

  const openMessage = (message: UiMessage) => {
    setSelectedMessage(message);
    setAiDraft(message.finalResponse || message.aiDraft || '');
    setModalError('');

    if (!message.finalResponse && !message.aiDraft) {
      void runAiGeneration(message, 'auto');
    }
  };

  const handleDeleteRepliedMessage = async (message: UiMessage) => {
    if (!message.replied) return;

    const shouldDelete = window.confirm(
      `Delete replied ticket ${message.id}? This cannot be undone.`
    );
    if (!shouldDelete) return;

    setModalError('');
    setDeletingTicketId(message.id);

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('ticket_id', message.id);

      if (error) throw new Error(error.message || 'Unable to delete replied ticket.');

      await loadMessages();
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
        setAiDraft('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to delete replied ticket.';
      if (selectedMessage?.id === message.id) {
        setModalError(errorMessage);
      } else {
        setLoadError(errorMessage);
      }
    } finally {
      setDeletingTicketId(null);
    }
  };

  const hasAiOutput =
    selectedMessage != null
      ? Boolean(
          selectedMessage.aiDraft ||
            selectedMessage.sentiment ||
            selectedMessage.aiCategory ||
            selectedMessage.confidence != null ||
            (selectedMessage.priority && selectedMessage.priority !== 'Pending')
        )
      : false;
  const selectedTicketCooldownSeconds = selectedMessage ? getCooldownRemainingSeconds(selectedMessage.id) : 0;

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
        <aside className="lg:col-span-3 space-y-6">
          <section className="glass-morphism rounded-2xl p-5">
            <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold mb-4">Queues</h2>
            <div className="space-y-3">
              <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm">
                <MessageSquare className="w-4 h-4" /> Needs Reply
                <span className="ml-auto bg-primary text-white text-[10px] py-0.5 px-2 rounded-full">{pendingMessages.length}</span>
              </div>
              <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-success/10 text-success font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Replied
                <span className="ml-auto bg-success text-bg-dark text-[10px] py-0.5 px-2 rounded-full">{repliedMessages.length}</span>
              </div>
            </div>
          </section>
          <section className="glass-morphism rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3">Today Summary</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Tickets are split by reply status so active workload stays focused and completed conversations stay searchable.
            </p>
          </section>
        </aside>

        <section className="lg:col-span-9">
          <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Customer Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm w-72 bg-bg-card border-border"
              />
            </div>
          </div>

          {isLoading && <p className="text-text-muted">Loading messages...</p>}
          {!isLoading && loadError && <p className="text-error text-sm">{loadError}</p>}

          {!isLoading && !loadError && (
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-secondary" />
                  <h3 className="text-lg font-semibold">Needs Reply</h3>
                  <span className="text-xs text-text-muted">{pendingMessages.length} ticket(s)</span>
                </div>
                {pendingMessages.length === 0 ? (
                  <p className="text-sm text-text-muted border border-border rounded-xl px-4 py-3 bg-bg-card/30">No pending tickets.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pagedPendingMessages.map((message) => (
                      <MessageCard key={message.id} message={message} onClick={() => openMessage(message)} />
                    ))}
                  </div>
                )}
                {pendingMessages.length > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-end gap-2 text-xs text-text-muted">
                    <button
                      onClick={() => setPendingPage((current) => Math.max(1, current - 1))}
                      disabled={pendingPage === 1}
                      className="px-2 py-1 border border-border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-card"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>Page {pendingPage} of {totalPendingPages}</span>
                    <button
                      onClick={() => setPendingPage((current) => Math.min(totalPendingPages, current + 1))}
                      disabled={pendingPage === totalPendingPages}
                      className="px-2 py-1 border border-border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-card"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <h3 className="text-lg font-semibold">Replied</h3>
                  <span className="text-xs text-text-muted">{repliedMessages.length} ticket(s)</span>
                </div>
                {repliedMessages.length === 0 ? (
                  <p className="text-sm text-text-muted border border-border rounded-xl px-4 py-3 bg-bg-card/30">No replied tickets yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pagedRepliedMessages.map((message) => (
                      <MessageCard
                        key={message.id}
                        message={message}
                        onClick={() => openMessage(message)}
                        onDelete={() => handleDeleteRepliedMessage(message)}
                        isDeleting={deletingTicketId === message.id}
                      />
                    ))}
                  </div>
                )}
                {repliedMessages.length > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-end gap-2 text-xs text-text-muted">
                    <button
                      onClick={() => setRepliedPage((current) => Math.max(1, current - 1))}
                      disabled={repliedPage === 1}
                      className="px-2 py-1 border border-border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-card"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>Page {repliedPage} of {totalRepliedPages}</span>
                    <button
                      onClick={() => setRepliedPage((current) => Math.min(totalRepliedPages, current + 1))}
                      disabled={repliedPage === totalRepliedPages}
                      className="px-2 py-1 border border-border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-card"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg-dark/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass-morphism rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 md:p-6 border-b border-border flex justify-between items-start bg-bg-card/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                    {selectedMessage.firstName[0]}{selectedMessage.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">{selectedMessage.firstName} {selectedMessage.lastName}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-text-muted">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedMessage.email}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(selectedMessage.timestamp).toLocaleString()}</span>
                      {selectedMessage.replied && selectedMessage.respondedAt && (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="w-3 h-3" />
                          Replied on {new Date(selectedMessage.respondedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 md:p-7 grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="space-y-5 lg:col-span-5">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{selectedMessage.aiCategory || 'Untriaged'} Issue</h1>
                    <p className="text-text-muted text-sm font-medium">Ticket ID: {selectedMessage.id}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-bg-card border border-border text-text-muted">AI: {selectedMessage.aiCategory || 'Pending'}</span>
                    </div>
                  </div>

                  <div className="bg-bg-card p-5 rounded-2xl border border-border shadow-inner">
                    <p className="text-base leading-relaxed text-text-light font-medium italic">"{selectedMessage.message}"</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="px-4 py-4 min-h-[92px] bg-bg-card/50 border border-border rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1 font-bold">Sentiment</p>
                      <p className="text-base font-bold text-primary">{selectedMessage.sentiment || 'Pending'}</p>
                    </div>
                    <div className="px-4 py-4 min-h-[92px] bg-bg-card/50 border border-border rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1 font-bold">AI Priority</p>
                      <p className="text-base font-bold text-secondary">{selectedMessage.priority || 'Pending'}</p>
                    </div>
                    <div className="px-4 py-4 min-h-[92px] bg-bg-card/50 border border-border rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-1 font-bold">Confidence</p>
                      <p className="text-base font-bold text-success">{selectedMessage.confidence != null ? `${selectedMessage.confidence}%` : 'Pending'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col h-full bg-bg-card/20 rounded-2xl p-5 border border-border lg:col-span-7">
                  <div className="flex justify-between items-center mb-5">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-secondary" /> AI Response Draft
                    </h4>
                    <button
                      onClick={handleGenerateResponse}
                      disabled={isGenerating || selectedTicketCooldownSeconds > 0}
                      className="ai-generate-btn"
                    >
                      <svg
                        height="20"
                        width="20"
                        viewBox="0 0 24 24"
                        data-name="Layer 1"
                        id="Layer_1"
                        className="ai-generate-sparkle"
                      >
                        <path d="M10,21.236,6.755,14.745.264,11.5,6.755,8.255,10,1.764l3.245,6.491L19.736,11.5l-6.491,3.245ZM18,21l1.5,3L21,21l3-1.5L21,18l-1.5-3L18,18l-3,1.5ZM19.333,4.667,20.5,7l1.167-2.333L24,3.5,21.667,2.333,20.5,0,19.333,2.333,17,3.5Z" />
                      </svg>
                      <span className="ai-generate-text">
                        {isGenerating && generatingTicketId === selectedMessage.id
                          ? 'Generating...'
                          : selectedTicketCooldownSeconds > 0
                            ? `Retry in ${selectedTicketCooldownSeconds}s`
                            : hasAiOutput
                              ? 'Re-Generate'
                              : 'Generate'}
                      </span>
                    </button>
                  </div>

                  <textarea
                    value={aiDraft}
                    onChange={(e) => setAiDraft(e.target.value)}
                    placeholder={isGenerating && generatingTicketId === selectedMessage.id ? 'AI is analyzing context and drafting response...' : 'The generated response will appear here.'}
                    className="w-full flex-1 min-h-[280px] resize-none font-sans text-sm leading-relaxed bg-bg-card/40 border border-border rounded-xl p-4 focus:ring-1 focus:ring-primary/60"
                  />

                  <div className="mt-5 pt-5 border-t border-border space-y-3">
                    <button
                      onClick={handleSendResponse}
                      disabled={!aiDraft || status !== 'idle' || isSending}
                      className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-3"
                    >
                      {status === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                        status === 'sent' ? 'Email Sent' :
                          <><Send className="w-4 h-4" /> {selectedMessage.replied ? 'Update Reply' : 'Send Response'}</>}
                    </button>
                    {modalError && (
                      <p className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                        {modalError}
                      </p>
                    )}
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
