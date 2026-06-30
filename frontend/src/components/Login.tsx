import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginProps {
  onLoginSuccess: (token: string, refreshToken: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const executeOAuthLogin = useCallback(async (endpoint: string, payload: any) => {
    try {
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const errText = await response.text();
        throw new Error(`Server error (${response.status}): ${errText.substring(0, 80)}`);
      }

      if (!response.ok) {
        throw new Error(data.error?.message || 'OAuth authentication failed');
      }

      if (data.access_token && data.refresh_token) {
        onLoginSuccess(data.access_token, data.refresh_token);
      } else {
        throw new Error('No access token received');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [onLoginSuccess]);

  // Parse OAuth callbacks on load
  useEffect(() => {
    const handleUrlCallbacks = async () => {
      // 1. Check for GitHub OAuth code in query params
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        setIsLoading(true);
        // Clear query params to prevent resubmitting on reload
        window.history.replaceState({}, document.title, window.location.pathname);
        await executeOAuthLogin('/api/v1/auth/github/', { code });
        return;
      }

      // 2. Check for Google OAuth id_token in hash params
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const idToken = hashParams.get('id_token');
        if (idToken) {
          setIsLoading(true);
          // Clear hash
          window.history.replaceState({}, document.title, window.location.pathname);
          await executeOAuthLogin('/api/v1/auth/google/', { id_token: idToken });
          return;
        }
      }
    };

    handleUrlCallbacks();
  }, [executeOAuthLogin]);


  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy_google_client_id';
    if (clientId === 'dummy_google_client_id') {
      console.log("Using mock Google OAuth login");
      await executeOAuthLogin('/api/v1/auth/google/', { id_token: `mock_google_token_${Math.random().toString(36).substring(7)}` });
      return;
    }

    const redirectUri = `${window.location.origin}/auth`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20email%20profile&nonce=${Math.random().toString(36).substring(7)}`;
    window.location.href = googleAuthUrl;
  };

  const handleGitHubLogin = async () => {
    setError('');
    setIsLoading(true);

    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || 'dummy_github_client_id';
    if (clientId === 'dummy_github_client_id') {
      console.log("Using mock GitHub OAuth login");
      await executeOAuthLogin('/api/v1/auth/github/', { code: `mock_github_code_${Math.random().toString(36).substring(7)}` });
      return;
    }

    const redirectUri = `${window.location.origin}/auth`;
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    window.location.href = githubAuthUrl;
  };

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

      const contentType = response.headers.get('content-type');
      let data: any = {};
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const errText = await response.text();
        throw new Error(`Server error (${response.status}): ${errText.substring(0, 80) || 'Empty or invalid response'}`);
      }

      if (!response.ok) {
        if (data.error && data.error.message) {
          throw new Error(data.error.message);
        } else if (typeof data === 'object' && Object.keys(data).length > 0) {
          const firstKey = Object.keys(data)[0];
          throw new Error(`${firstKey}: ${data[firstKey]}`);
        }
        throw new Error('Authentication failed');
      }

      if (data.access_token && data.refresh_token) {
        onLoginSuccess(data.access_token, data.refresh_token);
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
          {/* Brand Icon Mark */}
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

        {/* OAuth Section Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#030303]/90 backdrop-blur px-3 text-zinc-500 font-semibold tracking-widest text-[10px]">Or Continue With</span>
          </div>
        </div>

        {/* OAuth Buttons Grid */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] transition-all text-xs font-semibold text-white/80 hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={handleGitHubLogin}
            disabled={isLoading}
            className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] transition-all text-xs font-semibold text-white/80 hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
          </button>
        </div>

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
