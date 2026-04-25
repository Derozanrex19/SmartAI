import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import Silk from '../components/Silk';

const highlights = [
  {
    title: 'Built For Fast Support Teams',
    text: 'SupportIQ was designed to help lean support teams triage faster, reply with confidence, and keep every customer interaction organized.'
  },
  {
    title: 'AI That Supports Human Decisions',
    text: 'Our AI assists with sentiment and category signals so teams can prioritize better, while humans stay fully in control of final responses.'
  },
  {
    title: 'Demo-Ready Workflow',
    text: 'From contact form intake to admin-side response drafting, SupportIQ gives you an end-to-end workflow that is simple, explainable, and production-oriented.'
  }
];

export default function AboutUs() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none opacity-80">
        <Silk speed={4.5} scale={1} color="#7B7481" noiseIntensity={1.3} rotation={0.08} />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-bg-dark/35 via-bg-dark/80 to-bg-dark" />

      <header className="px-6 py-6 md:px-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            Support<span className="text-secondary">IQ</span>
          </h1>
          <div className="flex gap-3">
            <Link to="/" className="btn-secondary py-2 px-4 text-sm">Home</Link>
            <Link to="/contact-us" className="btn-primary py-2 px-4 text-sm">Contact Us</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pb-14 md:px-10">
        <div className="max-w-6xl mx-auto space-y-10">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="glass-morphism rounded-2xl p-6 md:p-10"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted font-semibold mb-4">About SupportIQ</p>
            <h2 className="text-4xl md:text-6xl font-bold leading-[1.06] tracking-tight mb-4">
              Smart Support,
              <span className="block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Human-Centered Outcomes.</span>
            </h2>
            <p className="max-w-3xl text-text-muted text-base md:text-lg leading-relaxed">
              SupportIQ is a customer support portal that combines clean ticket intake, AI-powered triage, and agent-reviewed response drafting. The goal is to shorten resolution time while keeping empathy and accountability at the center of every customer interaction.
            </p>
          </motion.section>

          <section className="grid md:grid-cols-3 gap-5">
            {highlights.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.08, ease: 'easeOut' }}
                className="glass-morphism rounded-2xl p-5"
              >
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.text}</p>
              </motion.article>
            ))}
          </section>

          <section className="grid lg:grid-cols-3 gap-5">
            <article className="rounded-2xl overflow-hidden border border-border bg-bg-card/40">
              <img
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80"
                alt="Support team collaborating in front of laptops"
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <h4 className="font-semibold mb-1">Collaboration First</h4>
                <p className="text-sm text-text-muted">Agents, AI insights, and customer context in one shared workflow.</p>
              </div>
            </article>

            <article className="rounded-2xl overflow-hidden border border-border bg-bg-card/40">
              <img
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80"
                alt="Analytics dashboard showing support metrics"
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <h4 className="font-semibold mb-1">Signal-Driven Triage</h4>
                <p className="text-sm text-text-muted">Sentiment, category, and confidence scores help teams prioritize better.</p>
              </div>
            </article>

            <article className="rounded-2xl overflow-hidden border border-border bg-bg-card/40">
              <img
                src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80"
                alt="Customer support discussion and planning session"
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <h4 className="font-semibold mb-1">Quality Responses</h4>
                <p className="text-sm text-text-muted">Draft fast, review carefully, and send with professionalism and clarity.</p>
              </div>
            </article>
          </section>
        </div>
      </main>

      <footer className="py-6 border-t border-border text-center text-text-muted text-sm">
        <p>&copy; {new Date().getFullYear()} SupportIQ. Built for modern customer support teams.</p>
      </footer>
    </div>
  );
}

