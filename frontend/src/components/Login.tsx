import { useState } from 'react';
import { motion } from 'framer-motion';

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
        // Map Django serializer errors or custom error objects
        if (data.error && data.error.message) {
          throw new Error(data.error.message);
        } else if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          throw new Error(`${firstKey}: ${data[firstKey]}`);
        }
        throw new Error('Authentication failed');
      }

      // Both endpoints return an access token upon success in our Django backend
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
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-primary)] items-center justify-center relative">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-[150%] h-[150%] pointer-events-none opacity-10 bg-wave -translate-y-1/4 translate-x-1/4"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md p-10 glass-panel rounded-[2.5rem] relative z-10 shadow-2xl shadow-black/50 border border-white/5 bg-[#0A1012]"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-accent-mint)] to-[var(--color-accent-lime)] flex items-center justify-center text-black font-bold text-3xl mb-6 shadow-[0_0_30px_rgba(130,242,168,0.3)]">
            P
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">POOKIE Protocol</h2>
          <p className="text-[var(--color-text-secondary)] text-center">Authenticate to access the central intelligence core.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {isRegistering && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Callsign (Username)</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent-mint)] transition-colors"
                placeholder="Agent 47"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent-mint)] transition-colors"
              placeholder="agent@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Encryption Key (Password)</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent-mint)] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[var(--color-accent-mint)] text-black font-semibold rounded-xl hover:bg-[#6FE596] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Authenticating...' : (isRegistering ? 'Initialize Sequence' : 'Establish Connection')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            {isRegistering ? 'Already have access? Establish Connection' : 'Need clearance? Initialize Sequence'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
