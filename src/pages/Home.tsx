import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ContactForm from '../components/ContactForm';

export default function Home() {
  const [showForm, setShowForm] = useState(false);

  const handleFormSubmit = (data: any) => {
    console.log('Form Submission Recieved:', JSON.stringify(data, null, 2));
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-primary/5 via-primary/2 to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-7xl md:text-9xl font-bold mb-12 tracking-tighter bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient-x leading-none">
              SupportIQ
            </h1>
            
            <div className="flex flex-wrap justify-center gap-6">
              <button 
                onClick={() => setShowForm(!showForm)}
                className="btn-primary text-base px-10"
              >
                {showForm ? 'Close Form' : 'Contact Us'}
              </button>
              <button className="btn-secondary text-base px-10">
                View Solutions
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Form Section */}
      <AnimatePresence>
        {showForm && (
          <motion.section 
            id="contact" 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-16 scroll-mt-20 overflow-hidden"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ContactForm onSubmit={handleFormSubmit} />
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Footer Minimalist */}
      <footer className="mt-20 py-8 border-t border-border text-center text-text-muted text-sm">
        <p>&copy; {new Date().getFullYear()} SupportIQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
