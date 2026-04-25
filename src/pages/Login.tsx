import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validateEmail = (e: string) => /\S+@\S+\.\S+/.test(e);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      setIsLoading(false);
      setError(authError?.message || 'Invalid credentials.');
      return;
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from('admin_profiles')
      .select('user_id, is_active')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminError) {
      setIsLoading(false);
      setError('Unable to verify admin access right now. Please try again.');
      return;
    }

    if (!adminRecord) {
      await supabase.auth.signOut();
      setIsLoading(false);
      setError('Access denied. This account is not an active admin.');
      return;
    }

    setIsLoading(false);
    navigate('/dashboard');
  };

  const isValid = validateEmail(email) && password.length >= 6;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-morphism p-8 rounded-2xl w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Admin Login</h2>
          <p className="text-text-muted">Access the SupportIQ command center</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
              <Mail className="w-3 h-3" /> Email Address
            </label>
            <input 
              type="email" 
              placeholder="admin@supportiq.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className={email && !validateEmail(email) ? 'border-error' : ''}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
              <Lock className="w-3 h-3" /> Password
            </label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={password && password.length < 6 ? 'border-error' : ''}
            />
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 text-error bg-error/5 border border-error/10 p-4 rounded-xl text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <button 
            type="submit" 
            disabled={!isValid || isLoading}
            className={`btn-primary w-full flex items-center justify-center gap-2 h-12 uppercase tracking-widest text-xs font-bold ${(!isValid || isLoading) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-text-muted">
            Authorized personnel only. All access is logged and monitored.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
