import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  FileImage,
  FileText,
  Loader2,
  LockKeyhole,
  MessageSquareReply,
  Paperclip,
  ShieldCheck,
  X
} from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from '../lib/supabase';

const ATTACHMENTS_BUCKET = 'supportiq-attachments';
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

type UploadableAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

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

function isValidTicketId(ticketId: string): boolean {
  return /^TKT-[A-Z0-9]+-[A-Z0-9]+$/i.test(ticketId);
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return null;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(email.trim())
    ? null
    : 'Enter a valid email or leave it blank.';
}

export default function ReplyPage() {
  const { ticketId = '' } = useParams();
  const normalizedTicketId = useMemo(() => ticketId.trim().toUpperCase(), [ticketId]);
  const storageKey = useMemo(
    () => (normalizedTicketId ? `supportiq-reply-email:${normalizedTicketId}` : ''),
    [normalizedTicketId]
  );
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<UploadableAttachment[]>([]);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const rememberedEmail = window.localStorage.getItem(storageKey);
    if (rememberedEmail) setEmail(rememberedEmail);
  }, [storageKey]);

  const uploadAttachments = async (conversationMessageId: string) => {
    if (attachments.length === 0) return;

    const attachmentRows = [];

    for (const attachment of attachments) {
      const filePath = `${normalizedTicketId}/reply-page/${Date.now()}-${attachment.id}-${sanitizeFileName(attachment.file.name)}`;
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
        ticket_id: normalizedTicketId,
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

    const { error: insertError } = await supabase
      .from('message_attachments')
      .insert(attachmentRows);

    if (insertError) {
      throw new Error(insertError.message || 'Unable to save attachment details.');
    }
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
    event.target.value = '';
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => {
      const attachmentToRemove = current.find((item) => item.id === attachmentId);
      if (attachmentToRemove?.previewUrl) URL.revokeObjectURL(attachmentToRemove.previewUrl);
      return current.filter((item) => item.id !== attachmentId);
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setWarning('');

    if (!isValidTicketId(normalizedTicketId)) {
      setError('This reply link is missing a valid ticket ID.');
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    if (message.trim().length < 5) {
      setError('Write a short reply before sending.');
      return;
    }

    if (attachments.some((attachment) => attachment.file.size > MAX_ATTACHMENT_SIZE_BYTES)) {
      setError('Each attachment must be 10 MB or smaller.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: conversationMessageId, error: replyError } = await supabase.rpc('submit_customer_reply', {
        ticket_id_input: normalizedTicketId,
        sender_email_input: email.trim().toLowerCase(),
        body_input: message.trim()
      });

      if (replyError || !conversationMessageId) {
        throw new Error(replyError?.message || 'Unable to send reply.');
      }

      try {
        await uploadAttachments(String(conversationMessageId));
      } catch (attachmentError) {
        setWarning(
          attachmentError instanceof Error
            ? `Reply sent, but attachments could not be saved: ${attachmentError.message}`
            : 'Reply sent, but attachments could not be saved.'
        );
      }

      attachments.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
      setAttachments([]);
      setMessage('');
      if (storageKey && email.trim()) {
        window.localStorage.setItem(storageKey, email.trim().toLowerCase());
      }
      setSubmittedAt(new Date().toISOString());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send reply.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-text-light">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.18),transparent_34%)]" />
      <main className="relative min-h-screen flex items-center justify-center px-4 py-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-3xl"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-light mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SupportIQ
          </Link>

          <div className="glass-morphism rounded-2xl overflow-hidden shadow-2xl shadow-primary/10">
            <div className="px-6 py-5 border-b border-border bg-bg-card/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shrink-0">
                  <MessageSquareReply className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-text-muted font-bold">Continue Conversation</p>
                  <h1 className="text-xl md:text-2xl font-bold truncate">SupportIQ Reply</h1>
                </div>
              </div>
              <div className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-xs font-mono text-secondary">
                {normalizedTicketId || 'Missing ticket'}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {submittedAt ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="p-8 md:p-10 text-center"
                >
                  <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-success" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Reply Sent</h2>
                  <p className="text-text-muted max-w-md mx-auto">
                    Your message was added to this ticket. You can keep this page open and send another update anytime.
                  </p>
                  <p className="text-xs text-text-muted mt-4">
                    Sent {new Date(submittedAt).toLocaleString()}
                  </p>
                  {warning && (
                    <p className="mt-5 text-xs text-secondary bg-secondary/10 border border-secondary/20 rounded-lg px-4 py-3">
                      {warning}
                    </p>
                  )}
                  <button
                    onClick={() => setSubmittedAt(null)}
                    className="btn-primary mt-7"
                  >
                    Continue Replying
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  onSubmit={handleSubmit}
                  className="p-6 md:p-8 space-y-6"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-bg-dark/40 p-4 flex gap-3">
                      <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold">Direct to dashboard</p>
                        <p className="text-xs text-text-muted mt-1">No email polling delay.</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-bg-dark/40 p-4 flex gap-3">
                      <LockKeyhole className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold">Ticket-linked reply</p>
                        <p className="text-xs text-text-muted mt-1">Use this same link for every update.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full"
                    />
                    <p className="text-xs text-text-muted">
                      We remember this on your device for this ticket.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">Reply</label>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Type your update here..."
                      className="w-full min-h-[180px] resize-y leading-relaxed"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <label className="text-sm font-medium text-text-muted">Attachments</label>
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-bg-card/60 hover:bg-border text-sm font-semibold w-full md:w-auto">
                        <Paperclip className="w-4 h-4" />
                        Attach Files
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleAttachmentChange}
                        />
                      </label>
                    </div>

                    {attachments.length > 0 && (
                      <div className="grid md:grid-cols-2 gap-3">
                        {attachments.map((attachment) => (
                          <div key={attachment.id} className="rounded-xl border border-border bg-bg-dark/50 p-3 flex gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-lg bg-bg-card border border-border overflow-hidden flex items-center justify-center shrink-0">
                              {attachment.previewUrl ? (
                                <img src={attachment.previewUrl} alt="" className="w-full h-full object-cover" />
                              ) : attachment.file.type.startsWith('image/') ? (
                                <FileImage className="w-5 h-5 text-primary" />
                              ) : (
                                <FileText className="w-5 h-5 text-secondary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{attachment.file.name}</p>
                              <p className="text-xs text-text-muted">{formatFileSize(attachment.file.size)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(attachment.id)}
                              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-error bg-error/10 border border-error/30 rounded-lg px-4 py-3">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquareReply className="w-5 h-5" />}
                    {isSubmitting ? 'Sending Reply...' : 'Send Reply'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
