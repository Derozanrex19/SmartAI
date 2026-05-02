import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CheckCircle2, Clock3, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';

export default function Home() {
  const fadeInUp = {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.45, ease: 'easeOut' as const }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-text-light">
      <div className="absolute inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.2),_transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(236,72,153,0.16),_transparent_60%)]" />

      <header className="px-6 py-5 md:px-10 border-b border-border/70 sticky top-0 bg-bg-dark/85 backdrop-blur-md z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" aria-label="SmartIQ Home" className="text-2xl font-bold tracking-tight">
            Smart<span className="text-secondary">IQ</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-text-muted">
            <a href="#how-it-works" className="hover:text-text-light transition-colors">How it works</a>
            <a href="#why-supportiq" className="hover:text-text-light transition-colors">Why SupportIQ</a>
            <a href="#workflow" className="hover:text-text-light transition-colors">Workflow</a>
          </nav>
          <Link to="/login" className="btn-secondary py-2 px-4 text-sm whitespace-nowrap">
            Admin Login
          </Link>
        </div>
      </header>

      <main className="px-6 pb-20 md:px-10">
        <section className="max-w-6xl mx-auto py-14 md:py-20 grid lg:grid-cols-12 gap-10 items-start">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="lg:col-span-7 space-y-7"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted font-semibold">AI Customer Support Workspace</p>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.06] tracking-tight max-w-3xl">
              Handle every customer reply with clarity, speed, and trust.
            </h1>
            <p className="max-w-2xl text-text-muted text-base md:text-lg leading-relaxed">
              SupportIQ combines ticket intake, AI triage, response drafting, and threaded follow-ups in one calm interface so your team can resolve issues faster without losing context.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/contact-us" className="btn-primary py-2.5 px-5 text-sm inline-flex items-center gap-2">
                Try Intake Flow <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/about-us" className="btn-secondary py-2.5 px-5 text-sm">
                See Product Story
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="bg-bg-card/45 border border-border rounded-xl p-3">
                <p className="text-2xl font-bold">3x</p>
                <p className="text-xs text-text-muted mt-1">Faster first response</p>
              </div>
              <div className="bg-bg-card/45 border border-border rounded-xl p-3">
                <p className="text-2xl font-bold">1 inbox</p>
                <p className="text-xs text-text-muted mt-1">Shared team context</p>
              </div>
              <div className="bg-bg-card/45 border border-border rounded-xl p-3">
                <p className="text-2xl font-bold">Auto</p>
                <p className="text-xs text-text-muted mt-1">Triage + draft assist</p>
              </div>
              <div className="bg-bg-card/45 border border-border rounded-xl p-3">
                <p className="text-2xl font-bold">Safer</p>
                <p className="text-xs text-text-muted mt-1">Policy-aware routing</p>
              </div>
            </div>
          </motion.div>

          <motion.aside {...fadeInUp} className="lg:col-span-5 glass-morphism rounded-2xl p-5 md:p-6">
            <h3 className="text-lg font-bold mb-4">What your team sees each day</h3>
            <div className="space-y-3">
              <div className="bg-bg-dark/60 border border-border rounded-lg p-3">
                <p className="text-xs text-text-muted">Queue</p>
                <p className="font-semibold mt-1">Needs Attention: 6</p>
              </div>
              <div className="bg-bg-dark/60 border border-border rounded-lg p-3">
                <p className="text-xs text-text-muted">Live Ticket</p>
                <p className="font-semibold mt-1">Billing concern with customer follow-up</p>
              </div>
              <div className="bg-bg-dark/60 border border-border rounded-lg p-3">
                <p className="text-xs text-text-muted">AI Draft</p>
                <p className="text-sm mt-1">Polite, context-aware response ready for review and send.</p>
              </div>
            </div>
          </motion.aside>
        </section>

        <section id="how-it-works" className="max-w-6xl mx-auto py-6 md:py-10">
          <motion.div {...fadeInUp} className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-semibold">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold mt-2">A simple flow from intake to resolution</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: MessageSquareText,
                title: '1. Capture the issue',
                text: 'Customers submit concerns through a clear contact flow with ticket IDs and thread tracking.'
              },
              {
                icon: Bot,
                title: "2. Assist, don't autopilot",
                text: 'AI categorizes sentiment and urgency, then prepares a draft your team can approve or refine.'
              },
              {
                icon: CheckCircle2,
                title: '3. Close the loop',
                text: 'Replies and follow-ups stay in one conversation timeline so handoffs are clean and accountable.'
              }
            ].map((item) => (
              <motion.article
                key={item.title}
                {...fadeInUp}
                whileHover={{ y: -4 }}
                className="bg-bg-card/40 border border-border rounded-xl p-5"
              >
                <item.icon className="w-5 h-5 text-secondary mb-3" />
                <h3 className="font-bold">{item.title}</h3>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">{item.text}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="why-supportiq" className="max-w-6xl mx-auto py-8 md:py-12">
          <motion.div {...fadeInUp} className="grid lg:grid-cols-2 gap-6">
            <div className="bg-bg-card/35 border border-border rounded-2xl p-6">
              <h3 className="text-2xl font-bold">Built for support teams that need confidence</h3>
              <p className="text-text-muted mt-3 leading-relaxed">
                Priority and confidence scoring reduce guesswork. Ticket threads preserve context so every reply references the real customer timeline, not fragmented notes.
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 text-success" /> Routing rules avoid risky auto-sends for high-risk tickets.</li>
                <li className="flex items-start gap-2"><Clock3 className="w-4 h-4 mt-0.5 text-success" /> Faster drafting with manual control preserved for final response.</li>
                <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 mt-0.5 text-success" /> Re-generate drafts using the latest customer reply context.</li>
              </ul>
            </div>
            <div className="bg-bg-card/35 border border-border rounded-2xl p-6">
              <h3 className="text-2xl font-bold">Clean UX for agents and customers</h3>
              <p className="text-text-muted mt-3 leading-relaxed">
                The interface is designed to reduce cognitive load: one queue, clear status states, and visible conversation history so agents respond faster with fewer errors.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-bg-dark/50 p-3">
                  <p className="text-xs text-text-muted">Status loop</p>
                  <p className="text-sm font-semibold mt-1">Needs Attention {'->'} Replied {'->'} Closed</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-dark/50 p-3">
                  <p className="text-xs text-text-muted">Conversation</p>
                  <p className="text-sm font-semibold mt-1">Customer + Admin + AI in one thread</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="workflow" className="max-w-6xl mx-auto py-8 md:py-12">
          <motion.div {...fadeInUp} className="bg-gradient-to-r from-bg-card/80 via-bg-card/60 to-bg-card/80 border border-border rounded-2xl p-6 md:p-8">
            <h3 className="text-2xl md:text-3xl font-bold">Ready to test your support workflow?</h3>
            <p className="text-text-muted mt-3 max-w-3xl">
              Submit a customer ticket, generate a draft response, and follow the full email reply loop into the admin queue.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/contact-us" className="btn-primary py-2.5 px-5 text-sm">
                Open Contact Flow
              </Link>
              <Link to="/login" className="btn-secondary py-2.5 px-5 text-sm">
                Go to Admin Dashboard
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="py-6 border-t border-border text-center text-text-muted text-sm">
        <p>&copy; {new Date().getFullYear()} SupportIQ. All rights reserved.</p>
      </footer>
    </div>
  );
}

