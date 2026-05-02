import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, FileImage, FileText, Loader2, Paperclip, X } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from '../lib/supabase';

interface ContactFormProps {
  onSubmit: (data: { ticketId: string; timestamp: string }) => void;
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

interface UploadedAttachmentRow {
  ticket_id: string;
  conversation_message_id: string;
  sender_type: 'customer';
  file_name: string;
  file_path: string;
  public_url: string;
  mime_type: string;
  file_size: number;
  source: 'upload';
}

const FALLBACK_DRAFT =
  'Thanks for contacting SupportIQ. Our team reviewed your message and will follow up if anything else is needed.';
const ATTACHMENTS_BUCKET = 'supportiq-attachments';
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

type UploadableAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function validateSupportEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const basicRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  if (!basicRegex.test(value)) {
    return 'Please enter a valid email address';
  }

  const [localPart, domain] = value.split('@');
  if (!localPart || !domain) {
    return 'Please enter a valid email address';
  }

  const blockedDomains = new Set([
    'example.com',
    'test.com',
    'mailinator.com',
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com'
  ]);
  if (blockedDomains.has(domain)) {
    return 'Please use a real email address you can access';
  }

  // Heuristic to catch obvious keyboard-smash style emails.
  const cleanedLocal = localPart.replace(/[._-]/g, '');
  const vowels = (cleanedLocal.match(/[aeiou]/g) || []).length;
  const vowelRatio = cleanedLocal.length > 0 ? vowels / cleanedLocal.length : 0;
  const hasOnlyLetters = /^[a-z]+$/.test(cleanedLocal);
  if (cleanedLocal.length >= 12 && hasOnlyLetters && vowelRatio < 0.25) {
    return 'Please use a real email address you can access';
  }

  return null;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function isPreviewableImage(file: File): boolean {
  return file.type.startsWith('image/');
}

export default function ContactForm({ onSubmit }: ContactFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitWarning, setSubmitWarning] = useState('');
  const [attachments, setAttachments] = useState<UploadableAttachment[]>([]);
  const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
  const appBaseUrl = (
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    window.location.origin
  ).replace(/\/+$/, '');

  const generateTicketId = () => {
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const random = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `TKT-${yy}${mm}${dd}-${random}`;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else {
      const emailError = validateSupportEmail(formData.email);
      if (emailError) {
        newErrors.email = emailError;
      }
    }
    if (formData.message.length < 20) newErrors.message = 'Message must be at least 20 characters';
    if (attachments.length > MAX_ATTACHMENTS) newErrors.attachments = `Up to ${MAX_ATTACHMENTS} attachments only`;
    if (attachments.some((attachment) => attachment.file.size > MAX_ATTACHMENT_SIZE_BYTES)) {
      newErrors.attachments = 'Each attachment must be 10 MB or smaller';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadAttachments = async (ticketIdValue: string, conversationMessageId: string) => {
    if (attachments.length === 0) return null;

    const attachmentRows: UploadedAttachmentRow[] = [];

    for (const attachment of attachments) {
      const filePath = `${ticketIdValue}/${Date.now()}-${attachment.id}-${sanitizeFileName(attachment.file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(filePath, attachment.file, {
          cacheControl: '3600',
          contentType: attachment.file.type || 'application/octet-stream',
          upsert: false
        });

      if (uploadError) {
        throw new Error(uploadError.message || 'Unable to upload attachment.');
      }

      const { data: publicUrlData } = supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .getPublicUrl(filePath);

      attachmentRows.push({
        ticket_id: ticketIdValue,
        conversation_message_id: conversationMessageId,
        sender_type: 'customer',
        file_name: attachment.file.name,
        file_path: filePath,
        public_url: publicUrlData.publicUrl,
        mime_type: attachment.file.type || 'application/octet-stream',
        file_size: attachment.file.size,
        source: 'upload'
      });
    }

    const { error: attachmentInsertError } = await supabase
      .from('message_attachments')
      .insert(attachmentRows);

    if (attachmentInsertError) {
      throw new Error(attachmentInsertError.message || 'Unable to save attachment metadata.');
    }

    return attachmentRows;
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const nextAttachments = selectedFiles.slice(0, availableSlots).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      previewUrl: isPreviewableImage(file) ? URL.createObjectURL(file) : null
    }));

    setAttachments((current) => [...current, ...nextAttachments]);
    setErrors((current) => ({ ...current, attachments: '' }));
    event.target.value = '';
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => {
      const attachmentToRemove = current.find((item) => item.id === attachmentId);
      if (attachmentToRemove?.previewUrl) {
        URL.revokeObjectURL(attachmentToRemove.previewUrl);
      }
      return current.filter((item) => item.id !== attachmentId);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitWarning('');

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    const generatedTicketId = generateTicketId();

    const payload = {
      ticket_id: generatedTicketId,
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      // Customer no longer selects category; AI triage will classify this later.
      category: 'other',
      // Keep a neutral default internally; AI priority is shown in dashboard.
      priority: 'medium',
      message: formData.message.trim(),
      status: 'needs_attention'
    };

    const { error } = await supabase
      .from('messages')
      .insert(payload)
      ;

    if (error) {
      setIsSubmitting(false);
      setSubmitError(error?.message || 'Unable to submit your message right now.');
      return;
    }

    const { data: conversationData, error: threadError } = await supabase
      .from('conversation_messages')
      .insert({
        ticket_id: generatedTicketId,
        sender_type: 'customer',
        sender_email: formData.email.trim().toLowerCase(),
        body: formData.message.trim()
      })
      .select('id')
      .single();

    if (threadError) {
      setSubmitWarning('Ticket submitted, but the conversation thread could not be initialized.');
    }

    let uploadedAttachments: UploadedAttachmentRow[] | null = null;

    if (conversationData?.id) {
      try {
        uploadedAttachments = await uploadAttachments(generatedTicketId, conversationData.id);
      } catch (attachmentError) {
        setSubmitWarning(
          attachmentError instanceof Error
            ? `Ticket submitted, but attachments could not be saved: ${attachmentError.message}`
            : 'Ticket submitted, but attachments could not be saved.'
        );
      }
    }

    // Trigger AI pipeline immediately after ticket creation so auto-send can happen
    // without requiring an admin to open the dashboard modal.
    if (n8nWebhookUrl) {
      try {
        const webhookPayload = {
          ticket_id: generatedTicketId,
          ticketId: generatedTicketId,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          category: 'unspecified',
          priority: 'unspecified',
          message: formData.message.trim(),
          subject: `[SupportIQ ${generatedTicketId}] Response to your concern`,
          emailSubject: `[SupportIQ ${generatedTicketId}] Response to your concern`,
          replyLink: `${appBaseUrl}/reply/${generatedTicketId}?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`,
          reply_link: `${appBaseUrl}/reply/${generatedTicketId}?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`,
          replyInstructions: `Continue the conversation here: ${appBaseUrl}/reply/${generatedTicketId}?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`,
          attachments: (uploadedAttachments || []).map((attachment) => ({
            fileName: attachment.file_name,
            publicUrl: attachment.public_url,
            mimeType: attachment.mime_type,
            fileSize: attachment.file_size,
            source: attachment.source
          }))
        };

        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        });

        const raw = await response.text();
        let aiData: AiWebhookResponse = {};
        if (raw.trim()) {
          try {
            aiData = JSON.parse(raw) as AiWebhookResponse;
          } catch {
            aiData = { ai_error: 'AI workflow returned invalid JSON.' };
          }
        }

        const nextStatus =
          (aiData.status || '').toLowerCase() === 'responded'
            ? 'replied'
            : (aiData.status || '').toLowerCase() === 'needs_human'
              ? 'needs_attention'
              : 'needs_attention';

        const resolvedDraft = (aiData.draft_response || aiData.final_response || '').trim() || FALLBACK_DRAFT;
        const resolvedFinalResponse =
          nextStatus === 'replied'
            ? ((aiData.final_response || aiData.draft_response || '').trim() || FALLBACK_DRAFT)
            : null;
        const resolvedRespondedAt =
          nextStatus === 'replied'
            ? (aiData.responded_at || new Date().toISOString())
            : null;

        const { error: updateError } = await supabase
          .from('messages')
          .update({
            ai_sentiment: aiData.sentiment || null,
            ai_category: aiData.category || null,
            ai_priority: aiData.priority || null,
            ai_confidence: typeof aiData.confidence === 'number' ? aiData.confidence : null,
            ai_draft: resolvedDraft,
            final_response: resolvedFinalResponse,
            status: nextStatus,
            responded_at: resolvedRespondedAt,
            ai_error: aiData.ai_error || aiData.email_error || null,
            ai_processed_at: new Date().toISOString()
          })
          .eq('ticket_id', generatedTicketId);

        if (updateError) {
          setSubmitWarning('Ticket submitted, but AI post-processing could not be saved.');
        } else if (!response.ok) {
          setSubmitWarning('Ticket submitted. AI is temporarily unavailable and may need manual follow-up.');
        }
      } catch {
        setSubmitWarning('Ticket submitted. AI processing could not be triggered right now.');
      }
    } else {
      setSubmitWarning('Ticket submitted. Missing AI webhook URL, so auto-processing is disabled.');
    }

    setTicketId(generatedTicketId);
    setIsSubmitting(false);
    onSubmit({
      ...formData,
      ticketId: generatedTicketId,
      timestamp: new Date().toISOString()
    });
  };

  const handleReset = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      message: ''
    });
    attachments.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });
    setAttachments([]);
    setTicketId(null);
    setSubmitError('');
    setSubmitWarning('');
    setErrors({});
  };

  const isValid = formData.firstName && formData.lastName && formData.email && formData.message.length >= 20;

  if (ticketId) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-morphism p-8 rounded-2xl text-center max-w-md mx-auto"
      >
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="w-16 h-16 text-success" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Message Submitted</h3>
        <p className="text-text-muted mb-6">
          Your message has been submitted. Our AI agent will analyze it shortly.
        </p>
        <div className="bg-bg-dark border border-border rounded-lg p-4 mb-8">
          <p className="text-sm text-text-muted mb-1">Ticket ID</p>
          <p className="text-xl font-mono text-secondary font-bold tracking-wider">{ticketId}</p>
        </div>
        <button 
          onClick={handleReset}
          className="btn-primary w-full"
        >
          Submit Another
        </button>
        {submitWarning && (
          <p className="text-xs text-text-muted mt-4">{submitWarning}</p>
        )}
      </motion.div>
    );
  }

  return (
    <div className="glass-morphism p-8 rounded-2xl max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-center" id="form-title">Send us your concern</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-muted">First Name</label>
            <input 
              type="text"
              id="firstName"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              className={errors.firstName ? 'border-error' : ''}
            />
            {errors.firstName && <span className="text-xs text-error">{errors.firstName}</span>}
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-muted">Last Name</label>
            <input 
              type="text"
              id="lastName"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              className={errors.lastName ? 'border-error' : ''}
            />
            {errors.lastName && <span className="text-xs text-error">{errors.lastName}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-muted">Email</label>
          <input 
            type="email"
            id="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className={errors.email ? 'border-error' : ''}
          />
          {errors.email && <span className="text-xs text-error">{errors.email}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-muted">Message</label>
          <textarea 
            id="message"
            rows={4}
            placeholder="Please describe your concern in detail..."
            value={formData.message}
            onChange={(e) => setFormData({...formData, message: e.target.value})}
            className={errors.message ? 'border-error' : ''}
          />
          <div className="flex justify-between items-center">
            {errors.message && <span className="text-xs text-error">{errors.message}</span>}
            <span className={`text-[10px] ml-auto ${formData.message.length < 20 ? 'text-text-muted' : 'text-success'}`}>
              {formData.message.length} / 20 chars min
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Tip: include what happened, when it started, and any error messages you saw.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-muted">Attachments</p>
              <p className="text-xs text-text-muted">Images, PDFs, and docs up to 10 MB each.</p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-bg-card/50 hover:bg-bg-card cursor-pointer text-sm font-medium">
              <Paperclip className="w-4 h-4" />
              Add files
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                multiple
                className="hidden"
                onChange={handleAttachmentChange}
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-xl border border-border bg-bg-card/40 p-3 flex gap-3"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-bg-dark border border-border flex items-center justify-center flex-shrink-0">
                    {attachment.previewUrl ? (
                      <img src={attachment.previewUrl} alt={attachment.file.name} className="w-full h-full object-cover" />
                    ) : attachment.file.type === 'application/pdf' ? (
                      <FileText className="w-5 h-5 text-secondary" />
                    ) : (
                      <FileImage className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{attachment.file.name}</p>
                    <p className="text-xs text-text-muted">{formatFileSize(attachment.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="p-1 rounded-md hover:bg-white/10 self-start"
                    aria-label={`Remove ${attachment.file.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {errors.attachments && <span className="text-xs text-error">{errors.attachments}</span>}
        </div>

        <button 
          type="submit" 
          disabled={!isValid || isSubmitting}
          className={`btn-primary w-full flex items-center justify-center gap-2 ${(!isValid || isSubmitting) ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Message'
          )}
        </button>

        <AnimatePresence>
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="text-xs text-error bg-error/5 border border-error/20 rounded-lg px-3 py-2"
            >
              {submitError}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="text-[11px] text-text-muted text-center">
          Your concern is reviewed securely. AI triage helps route your ticket faster.
        </p>
      </form>
    </div>
  );
}
