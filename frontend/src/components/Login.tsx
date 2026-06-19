import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isRegistering ? '/api/v1/auth/register/' : '/api/v1/auth/login/';
    const url = `http://localhost:8000${endpoint}`;

    try {
      const payload: any = { email, password };
      if (isRegistering) {
        payload.username = username || email.split('@')[0];
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error && data.error.message) {
          throw new Error(data.error.message);
        } else if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          throw new Error(`${firstKey}: ${data[firstKey]}`);
        }
        throw new Error('Authentication failed');
      }

      if (data.access_token) {
        onLoginSuccess(data.access_token);
      } else {
        throw new Error('No access token received');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-transparent text-white items-center justify-center relative font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md p-8 glass-panel rounded-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-6">
          {/* Brand Icon Mark: line-drawn premium setu loop, high contrast white with violet dot */}
          <div className="w-12 h-12 flex items-center justify-center mb-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
              <path d="M16 8.5H10.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H8" />
              <circle cx="12.5" cy="13.5" r="1.5" fill="#8052ff" stroke="none" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-white text-center uppercase">
            SETU
          </h2>
          <p className="text-zinc-400 text-xs tracking-wider mt-1 text-center font-medium uppercase">
            {isRegistering ? 'Setup your secure workspace' : 'Workstation Authentication'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="space-y-3">
            {isRegistering && (
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">Username</label>
                <div className="app-input-wrapper">
                  <span className="app-input-icon-left text-zinc-500 text-sm">@</span>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full app-input app-input-with-icon"
                    placeholder="alex"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">Email Address</label>
              <div className="app-input-wrapper">
                <div className="app-input-icon-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full app-input app-input-with-icon"
                  placeholder="alex@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">Password</label>
              <div className="app-input-wrapper">
                <div className="app-input-icon-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full app-input app-input-with-icon"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary py-3 mt-4"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              isRegistering ? 'Create Account' : 'Sign In'
            )}
          </motion.button>
        </form>

        <div className="mt-6 text-center space-y-4">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs text-zinc-400 hover:text-white transition-colors tracking-wide font-medium"
          >
            {isRegistering ? 'Already registered? Log in' : "New user? Create a profile"}
          </button>

          {/* Secure details footer */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5 text-[9px] font-mono text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LOCAL NETWORK</span>
            <span>TLS ENCRYPTION</span>
            <span>AES_256</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
