import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

interface ContactFormProps {
  onSubmit: (data: any) => void;
}

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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');

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
      status: 'new'
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
    setTicketId(null);
    setSubmitError('');
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
