import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import ContactForm from '../components/ContactForm';

export default function ContactUs() {
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const handleFormSubmit = (data: { ticketId?: string }) => {
    if (data?.ticketId) {
      setSubmittedTicketId(data.ticketId);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 md:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-2xl font-bold tracking-tight">
            Support<span className="text-secondary">IQ</span>
          </h1>
          <Link to="/" className="btn-secondary py-2 px-4 text-sm">
            Back Home
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <ContactForm onSubmit={handleFormSubmit} />
        </motion.div>

        {submittedTicketId && (
          <p className="text-center text-xs text-text-muted mt-6">
            Ticket <span className="text-secondary font-semibold">{submittedTicketId}</span> was submitted successfully.
          </p>
        )}
      </div>
    </div>
  );
}
