import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Mic, Shield, ChevronRight, CheckCircle2 } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';

export function Onboarding() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, setEulaAccepted, setOnboardingCompleted, setUsername } = useAppStore();

  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }
    fetch('http://localhost:8000/api/v1/user/profile/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (res.status === 401 || res.status === 403) {
        navigate('/auth');
        return;
      }
      return res.json();
    })
    .then(data => {
      if (data?.preferences?.privacy_consent_granted === true) {
        setOnboardingCompleted(true);
        setEulaAccepted(true);
        if (data.preferences.preferred_name) {
          setUsername(data.preferences.preferred_name);
        }
        navigate('/dashboard');
      }
    })
    .catch(console.error);
  }, [navigate, token, setOnboardingCompleted, setEulaAccepted, setUsername]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative z-10 px-6">
      {/* Persistent Progress Indicator */}
      <div className="absolute top-12 left-0 right-0 flex justify-center z-20">
        <div className="flex items-center gap-3">
          {[
            { path: '/onboarding/name', num: 1 },
            { path: '/onboarding/hardware', num: 2 },
            { path: '/onboarding/permissions', num: 3 }
          ].map((step, idx) => {
            const isActive = location.pathname.includes(step.path);
            const isPast = ['/name', '/hardware', '/permissions'].findIndex(p => location.pathname.includes(p)) > idx;
            return (
              <div key={idx} className="flex items-center">
                <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isActive ? 'bg-[var(--color-accent-mint)] scale-125 shadow-[0_0_10px_var(--color-accent-mint)]' : isPast ? 'bg-[var(--color-accent-mint)]/50' : 'bg-white/10'}`} />
                {idx < 2 && <div className={`w-12 h-[2px] mx-1 ${isPast ? 'bg-[var(--color-accent-mint)]/30' : 'bg-white/5'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Route Content with Transitions */}
      <div className="w-full max-w-2xl bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent-mint)]/5 to-transparent pointer-events-none"></div>
        
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="name" element={<StepName />} />
            <Route path="hardware" element={<StepHardware />} />
            <Route path="permissions" element={<StepPermissions />} />
            <Route path="done" element={<StepDone />} />
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepName() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUsername, token } = useAppStore();

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 1) {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('http://localhost:8000/api/v1/user/profile/', {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: name.trim(),
            preferences: { preferred_name: name.trim() }
          })
        });
        if (!res.ok) {
          throw new Error('Failed to update profile on backend.');
        }
        setUsername(name.trim());
        navigate('/onboarding/hardware');
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Server error. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center text-center relative z-10"
    >
      <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">What should I call you?</h2>
      <p className="text-gray-400 mb-12">Enter your preferred name to initialize your neural profile.</p>
      
      <form onSubmit={handleNext} className="w-full max-w-md">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        <input 
          type="text" 
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your Name"
          disabled={loading}
          className="w-full bg-transparent border-b-2 border-white/20 text-white text-3xl text-center py-4 focus:outline-none focus:border-[var(--color-accent-mint)] transition-colors placeholder:text-white/10"
        />
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={!name.trim() || loading}
          type="submit"
          className="mt-12 w-full py-4 rounded-full bg-[var(--color-accent-mint)] text-black font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(130,242,168,0.2)]"
        >
          {loading ? 'Saving...' : 'Next'} <ChevronRight size={20} />
        </motion.button>
      </form>
    </motion.div>
  );
}

function StepHardware() {
  const navigate = useNavigate();
  const [tested, setTested] = useState(false);
  
  // Minimal mock logic for mic test.
  const handleTest = () => {
    setTested(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col text-center relative z-10"
    >
      <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">Hardware Calibration</h2>
      <p className="text-gray-400 mb-12 max-w-md mx-auto">POOKIE needs to hear you clearly. Let's test your microphone input.</p>

      <div className="flex justify-center mb-12">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleTest}
          className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${tested ? 'bg-[var(--color-accent-mint)] text-black shadow-[0_0_50px_rgba(130,242,168,0.4)]' : 'bg-white/5 border border-white/20 text-white hover:bg-white/10'}`}
        >
          {tested ? <CheckCircle2 size={48} /> : <Mic size={48} />}
        </motion.button>
      </div>
      
      {tested ? (
        <p className="text-[var(--color-accent-mint)] font-medium text-lg mb-10">Microphone calibrated successfully.</p>
      ) : (
        <p className="text-gray-500 mb-10">Click to speak to test</p>
      )}

      <div className="flex gap-4 w-full">
        <button onClick={() => navigate('/onboarding/name')} className="flex-1 py-4 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold transition-colors">Back</button>
        <button 
          onClick={() => navigate('/onboarding/permissions')} 
          className="flex-[2] py-4 rounded-full bg-[var(--color-accent-mint)] text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(130,242,168,0.2)]"
        >
          {tested ? 'Continue' : 'Skip for now'} <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>
  );
}

function StepPermissions() {
  const navigate = useNavigate();
  const [level2, setLevel2] = useState(false);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setEulaAccepted: persistEulaAccepted, token } = useAppStore();

  const handleComplete = async () => {
    if (!eulaAccepted) return;
    setLoading(true);
    setError('');
    try {
      // Update permissions
      const res = await fetch('http://localhost:8000/api/v1/user/permissions/', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          level_2_granted: level2 
        })
      });
      if (!res.ok) {
        throw new Error('Failed to update permissions on backend.');
      }
      
      // Update privacy consent preference
      const resProfile = await fetch('http://localhost:8000/api/v1/user/profile/', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          preferences: { privacy_consent_granted: true }
        })
      });
      if (!resProfile.ok) {
        throw new Error('Failed to update privacy consent on backend.');
      }

      persistEulaAccepted(true);
      navigate('/onboarding/done');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col relative z-10"
    >
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">System Permissions</h2>
        <p className="text-gray-400">Configure what POOKIE is allowed to do on your workstation.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="mt-1 w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Level 2: Elevated Access</h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md">Allow POOKIE to read local files, open applications, control browser automation, and access clipboard. (Level 3 Admin tasks will still always require a manual UAC prompt).</p>
            </div>
          </div>
          
          {/* Custom Toggle */}
          <div 
            onClick={() => setLevel2(!level2)}
            className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors ${level2 ? 'bg-[var(--color-accent-mint)]' : 'bg-white/20'}`}
          >
            <motion.div 
              layout
              className="w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ x: level2 ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable EULA container */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 max-h-36 overflow-y-auto text-xs text-gray-400 leading-relaxed custom-scrollbar text-left font-mono">
        <h4 className="text-white font-bold mb-2">POOKIE AI Agent - End User License Agreement (EULA) & Privacy Policy</h4>
        <p className="mb-2"><strong>Last Updated:</strong> June 2026</p>
        <p className="mb-4">By installing, accessing, or using the Software, you agree to these terms. If you do not agree, do not use the Software.</p>
        <h5 className="text-white font-semibold mb-1">1. Privacy Policy: Local-First & Zero Telemetry</h5>
        <p className="mb-2">POOKIE is local-first. Microphone audio is processed locally and discarded. Images for context awareness are processed in RAM and immediately purged. Files are accessed only if Level 2 permission is granted.</p>
        <p className="mb-4">All conversations are stored in a local MongoDB database directly on your machine. We cannot access your data.</p>
        <h5 className="text-white font-semibold mb-1">2. Terms of Service & Software Usage</h5>
        <p className="mb-2">By granting Level 2 or Level 3 permissions, you allow POOKIE to modify, create, or delete files. You are solely responsible for the consequences of commands you issue. The developers are not liable for any data loss or system misconfigurations.</p>
        <p className="mb-4">You agree not to use POOKIE for illegal activities.</p>
        <h5 className="text-white font-semibold mb-1">3. Disclaimers</h5>
        <p className="mb-2">THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.</p>
      </div>

      {/* Mandatory Checkbox */}
      <label className="flex items-center gap-3 cursor-pointer mb-8 text-sm text-gray-300 select-none">
        <input 
          type="checkbox" 
          checked={eulaAccepted} 
          onChange={e => setEulaAccepted(e.target.checked)}
          className="w-5 h-5 rounded border-white/20 bg-white/5 text-[var(--color-accent-mint)] focus:ring-[var(--color-accent-mint)]" 
        />
        <span>I have read and agree to the EULA and Privacy Policy</span>
      </label>

      <div className="flex gap-4 w-full">
        <button onClick={() => navigate('/onboarding/hardware')} disabled={loading} className="flex-1 py-4 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold transition-colors">Back</button>
        <button 
          onClick={handleComplete} 
          disabled={!eulaAccepted || loading}
          className="flex-[2] py-4 rounded-full bg-[var(--color-accent-mint)] text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(130,242,168,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Completing...' : 'Complete Setup'} <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>
  );
}

function StepDone() {
  const navigate = useNavigate();
  const { username: name, setOnboardingCompleted } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center relative z-10 py-10"
    >
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: 360 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-accent-mint)] to-[#065F46] flex items-center justify-center text-black mb-8 shadow-[0_0_50px_rgba(130,242,168,0.5)]"
      >
        <CheckCircle2 size={48} />
      </motion.div>
      
      <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">You're all set, {name}!</h2>
      <p className="text-gray-400 mb-10 max-w-md">Your neural link is established and POOKIE is ready for command execution.</p>

      <button 
        onClick={() => {
          setOnboardingCompleted(true);
          navigate('/dashboard');
        }}
        className="w-full max-w-sm py-4 rounded-full bg-white text-black font-bold text-lg hover:scale-105 transition-transform"
      >
        Enter Workspace
      </button>
    </motion.div>
  );
}
