import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import Silk from '../components/Silk';
import SplitText from '../components/SplitText';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none opacity-80">
        <Silk speed={5} scale={1} color="#7B7481" noiseIntensity={1.5} rotation={0} />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-bg-dark/35 via-bg-dark/80 to-bg-dark" />

      <header className="px-6 py-6 md:px-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" aria-label="SmartIQ Home" className="text-2xl font-bold tracking-tight">
            Smart<span className="text-secondary">IQ</span>
          </Link>
          <Link to="/login" className="btn-secondary py-2 px-4 text-sm">
            Admin Login
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 pb-16 md:px-10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center min-h-[72vh]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="space-y-7"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted font-semibold">AI Customer Support Portal</p>
            <div className="text-5xl md:text-7xl font-bold leading-[1.03] tracking-tight">
              <SplitText
                text="Faster Replies."
                className="block"
                delay={35}
                duration={0.8}
                ease="easeOut"
                splitType="chars"
                from={{ opacity: 0, y: 36 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.15}
                rootMargin="-80px"
                textAlign="left"
                tag="h2"
              />
              <SplitText
                text="Smarter Triage."
                className="block"
                itemClassName="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
                delay={35}
                duration={0.8}
                ease="easeOut"
                splitType="chars"
                from={{ opacity: 0, y: 36 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.15}
                rootMargin="-80px"
                textAlign="left"
                tag="h2"
              />
            </div>
            <p className="max-w-xl text-text-muted text-base md:text-lg leading-relaxed">
              SupportIQ helps teams handle customer concerns with AI-assisted sentiment analysis, category detection, and draft responses in one streamlined workspace.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/contact-us" className="cube-btn cube-hover" aria-label="Contact Us">
                <div className="cube-bg-top">
                  <div className="cube-bg-inner" />
                </div>
                <div className="cube-bg-right">
                  <div className="cube-bg-inner" />
                </div>
                <div className="cube-bg">
                  <div className="cube-bg-inner" />
                </div>
                <div className="cube-text">Contact Us</div>
              </Link>
              <Link to="/about-us" className="cube-btn cube-hover" aria-label="About Us">
                <div className="cube-bg-top">
                  <div className="cube-bg-inner" />
                </div>
                <div className="cube-bg-right">
                  <div className="cube-bg-inner" />
                </div>
                <div className="cube-bg">
                  <div className="cube-bg-inner" />
                </div>
                <div className="cube-text">About Us</div>
              </Link>
            </div>
          </motion.div>

          <motion.section
            id="highlights"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: 'easeOut' }}
            className="glass-morphism rounded-2xl p-6 md:p-8"
          >
            <h3 className="text-xl font-bold mb-6">Why Teams Use SupportIQ</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <article className="bg-bg-dark/60 border border-border rounded-xl p-4">
                <p className="text-sm font-semibold mb-2">AI Triage</p>
                <p className="text-xs text-text-muted leading-relaxed">Classifies issues by category and sentiment so teams prioritize the right tickets first.</p>
              </article>
              <article className="bg-bg-dark/60 border border-border rounded-xl p-4">
                <p className="text-sm font-semibold mb-2">Draft Responses</p>
                <p className="text-xs text-text-muted leading-relaxed">Creates context-aware reply drafts that agents can review and send quickly.</p>
              </article>
              <article className="bg-bg-dark/60 border border-border rounded-xl p-4">
                <p className="text-sm font-semibold mb-2">Admin Dashboard</p>
                <p className="text-xs text-text-muted leading-relaxed">Centralized inbox for ticket details, confidence scores, and live decision support.</p>
              </article>
              <article className="bg-bg-dark/60 border border-border rounded-xl p-4">
                <p className="text-sm font-semibold mb-2">Built For Demo-Ready Ops</p>
                <p className="text-xs text-text-muted leading-relaxed">Simple customer intake flow plus structured handling for high-trust responses.</p>
              </article>
            </div>
          </motion.section>
        </div>
      </main>

      <footer className="py-6 border-t border-border text-center text-text-muted text-sm">
        <p>&copy; {new Date().getFullYear()} SupportIQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
