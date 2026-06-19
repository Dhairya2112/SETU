// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';
import { useAgentSocket } from '../hooks/useAgentSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import heroImg from '../assets/hero.png';

export function Dashboard() {
  const navigate = useNavigate();
  const { token, username, conversationId, setUsername, logout } = useAppStore();
  const [activeTab, setActiveTab] = useState<string>('TaskFeed');
  const [showTerminal, setShowTerminal] = useState<boolean>(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Reminders State
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');
  const [newReminderBody, setNewReminderBody] = useState('');
  const [toasts, setToasts] = useState<{id: string, title: string, body: string}[]>([]);

  // Safety Console Whitelist & Audit logs state
  const [safetyLevel, setSafetyLevel] = useState<'L1' | 'L2' | 'L3'>('L2');
  const [whitelistDirs] = useState<string[]>([
    'a:\Setu',
    'C:\Users\daved\setu-core',
    'C:\Users\daved\Desktop\Automation'
  ]);
  const [auditLogs] = useState([
    { id: 1, action: 'Read File', target: 'a:\Setu\docs\AI_CONTEXT.md', status: 'GRANTED', level: 'L1', time: '10 mins ago' },
    { id: 2, action: 'Run Process', target: 'playwright install chromium', status: 'GRANTED', level: 'L2', time: '15 mins ago' },
    { id: 3, action: 'Delete File', target: 'C:\\Windows\\System32\\cmd.exe', status: 'BLOCKED', level: 'L3', time: '1 hr ago' },
    { id: 4, action: 'Modify Registry', target: 'HKCU\\Software\\Setu', status: 'WARNING_PASSED', level: 'L2', time: '2 hrs ago' }
  ]);

  const fetchReminders = useCallback(() => {
    if (!token) return;
    fetch('http://localhost:8000/api/v1/reminders/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.results) {
          setReminders(data.results);
        }
      })
      .catch(console.error);
  }, [token]);

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle || !newReminderTime) return;

    fetch('http://localhost:8000/api/v1/reminders/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: newReminderTitle,
        body: newReminderBody,
        trigger_at: new Date(newReminderTime).toISOString()
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to create reminder");
        return res.json();
      })
      .then(() => {
        setNewReminderTitle('');
        setNewReminderBody('');
        setNewReminderTime('');
        fetchReminders();
      })
      .catch(err => alert(err.message));
  };

  const handleDeleteReminder = (reminderId: string) => {
    fetch(`http://localhost:8000/api/v1/reminders/${reminderId}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.ok) {
          fetchReminders();
        }
      })
      .catch(console.error);
  };

  // Initialize Socket connection
  const { isConnected, messages, isThinking, isSpeaking, sendCommand, stopSpeaking } = useAgentSocket({
    token,
    conversationId,
    onReminderFired: (reminder: any) => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playBeep = (freq: number, duration: number, startTime: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.15, startTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        const now = audioCtx.currentTime;
        playBeep(880, 0.1, now);
        playBeep(1200, 0.15, now + 0.1);
      } catch (e) {
        console.warn("Could not play audio notification:", e);
      }

      const toastId = Math.random().toString();
      setToasts(prev => [...prev, { id: toastId, title: reminder.title, body: reminder.body }]);
      fetchReminders();

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 8000);
    }
  });

  // Load reminders when switching to Reminders tab
  useEffect(() => {
    if (activeTab === 'Reminders') {
      fetchReminders();
    }
  }, [activeTab, fetchReminders]);

  const { startListening, stopListening, isActive, getNormalizedEnergy } = useAudioAnalyser();
  const [audioLevel, setAudioLevel] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }
    const completed = localStorage.getItem('setu_onboarding_completed') === 'true';
    if (!completed) {
      navigate('/onboarding/name');
      return;
    }
    fetch('http://localhost:8000/api/v1/user/profile/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        throw new Error("Token expired, please log in again.");
      }
      return res.json();
    })
    .then(data => {
      if (data && data.username) setUsername(data.username);
    })
    .catch(console.error);
  }, [token, navigate]);

  // Poll audio level when listening
  useEffect(() => {
    let animationFrameId: number;

    const updateAudioLevel = () => {
      if (isActive) {
        setAudioLevel(getNormalizedEnergy());
        animationFrameId = requestAnimationFrame(updateAudioLevel);
      } else {
        setAudioLevel(0);
      }
    };

    if (isActive) {
      updateAudioLevel();
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, getNormalizedEnergy]);

  // Implement Barge-in
  useEffect(() => {
    let bargeInFrameId: number;

    const checkBargeIn = () => {
      if (isSpeaking) {
        const energy = getNormalizedEnergy();
        if (energy > 0.7) {
          console.log("Barge-in interrupted playback! Audio level:", energy);
          stopSpeaking();
          startListening((transcript) => {
            sendCommand(transcript);
          });
        } else {
          bargeInFrameId = requestAnimationFrame(checkBargeIn);
        }
      }
    };

    if (isSpeaking) {
      if (!isActive) {
        startListening((transcript) => {
          sendCommand(transcript);
        }).then(() => {
          bargeInFrameId = requestAnimationFrame(checkBargeIn);
        }).catch(err => {
          console.warn("Failed to activate microphone for barge-in monitoring:", err);
        });
      } else {
        bargeInFrameId = requestAnimationFrame(checkBargeIn);
      }
    }

    return () => {
      if (bargeInFrameId) cancelAnimationFrame(bargeInFrameId);
    };
  }, [isSpeaking, isActive, getNormalizedEnergy, stopSpeaking, startListening, sendCommand]);

  // Autoscroll message container
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isThinking, activeTab]);

  const toggleListen = async () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    if (isActive) {
      stopListening();
    } else {
      await startListening((transcript) => {
        sendCommand(transcript);
      });
    }
  };

  const sidebarNavItems = [
    {
      id: 'TaskFeed',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>,
      label: "Task Feed"
    },
    {
      id: 'History',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
      label: "History"
    },
    {
      id: 'Devices',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>,
      label: "Devices"
    },
    {
      id: 'Memory',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
      label: "Memory"
    },
    {
      id: 'Contacts',
      icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
      label: "Contacts"
    }
  ];

  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({
    username: 'daved',
    email: 'daved@setu.local',
    user_id: 'usr_01j1wg5c82feae15ab00',
    preferences: {
      ai_provider: 'OpenRouter (Llama 3.3)',
      llm_mode: 'Hybrid',
      llm_model: 'meta-llama/llama-3.3-70b-instruct',
      theme: 'Aether Obsidian',
      language: 'English (US)'
    }
  });

  // Load history
  useEffect(() => {
    if (activeTab === 'History' && token) {
      fetch('http://localhost:8000/api/v1/conversations/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.results) {
          setHistory(data.results);
        }
      })
      .catch(console.error);
    }
  }, [activeTab, token]);

  // Load profile
  useEffect(() => {
    if (activeTab === 'Memory' && token) {
      fetch('http://localhost:8000/api/v1/user/profile/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        setProfile(data);
      })
      .catch(console.error);
    }
  }, [activeTab, token]);

  const getTasksFromMessages = () => {
    const tasks: any[] = [];
    let currentTask: any = null;

    messages.forEach((msg: any, index: number) => {
      if (msg.role === 'user') {
        if (currentTask) {
          tasks.push(currentTask);
        }
        currentTask = {
          id: `task-${index}`,
          command: msg.text,
          status: 'completed',
          steps: [],
          result: ''
        };
      } else if (msg.role === 'assistant' && currentTask) {
        const lines = msg.text.split('\n');
        lines.forEach((line: string) => {
          if (line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().match(/^\d+\./)) {
            currentTask.steps.push({ text: line.replace(/^[-*\d.\s]+/, '').trim(), status: 'completed' });
          } else {
            currentTask.result = (currentTask.result ? currentTask.result + '\n' : '') + line;
          }
        });
      }
    });

    if (currentTask) {
      tasks.push(currentTask);
    }

    return tasks;
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-transparent">
      
      {/* Floating Translucent Icon Sidebar */}
      <aside className="absolute left-6 top-6 bottom-6 flex flex-col items-start z-50 pointer-events-none">
        
        {/* Brand Icon floating */}
        <div className="pointer-events-auto mb-10 group/brand flex items-center h-12 rounded-2xl w-12 hover:w-48 transition-all duration-300 ease-in-out bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden cursor-default">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8052ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="flex flex-col ml-1 whitespace-nowrap opacity-0 group-hover/brand:opacity-100 transition-opacity duration-300">
            <span className="font-bold text-base tracking-wide text-white leading-tight">Setu</span>
            <span className="text-[8px] font-bold tracking-[0.2em] text-[#8052ff] uppercase leading-tight">Core</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex flex-col gap-3 pointer-events-auto">
          {sidebarNavItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex items-center h-12 rounded-2xl transition-all duration-300 group/btn overflow-hidden shadow-lg ${
                activeTab === item.id 
                  ? 'w-12 lg:w-48 bg-[#8052ff]/15 border border-[#8052ff]/40 shadow-[0_0_15px_rgba(128,82,255,0.2)]' 
                  : 'w-12 lg:hover:w-48 bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-md'
              }`}
            >
              <div className={`absolute left-0 w-12 h-12 flex items-center justify-center shrink-0 transition-colors ${activeTab === item.id ? 'text-[#8052ff]' : 'text-zinc-500 group-hover/btn:text-white'}`}>
                {item.icon}
              </div>
              <span className={`absolute left-12 whitespace-nowrap text-sm font-semibold tracking-wide transition-opacity duration-300 ${activeTab === item.id ? 'text-white opacity-100 lg:opacity-100' : 'text-zinc-300 opacity-0 lg:group-hover/btn:opacity-100'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Bottom Settings item */}
        <div className="mt-auto pointer-events-auto">
          <button 
            onClick={() => setActiveTab('Settings')} 
            className={`relative flex items-center h-12 rounded-2xl transition-all duration-300 group/btn overflow-hidden shadow-lg ${
              activeTab === 'Settings' 
                ? 'w-12 lg:w-48 bg-[#8052ff]/15 border border-[#8052ff]/40 shadow-[0_0_15px_rgba(128,82,255,0.2)]' 
                : 'w-12 lg:hover:w-48 bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-md'
            }`}
          >
            <div className={`absolute left-0 w-12 h-12 flex items-center justify-center shrink-0 transition-colors ${activeTab === 'Settings' ? 'text-[#8052ff]' : 'text-zinc-500 group-hover/btn:text-white'}`}>
               <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </div>
            <span className={`absolute left-12 whitespace-nowrap text-sm font-semibold tracking-wide transition-opacity duration-300 ${activeTab === 'Settings' ? 'text-white opacity-100 lg:opacity-100' : 'text-zinc-300 opacity-0 lg:group-hover/btn:opacity-100'}`}>
              Settings
            </span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area - Transparent everywhere to keep Neural Mesh visible */}
      <main className="absolute left-24 lg:left-28 right-6 top-6 bottom-6 flex flex-col z-10 min-w-0 bg-transparent border-none shadow-none backdrop-blur-none overflow-hidden">
        
        {/* Content Tabs Wrapper */}
        <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
          
          {/* TABS CONTAINER */}
          <AnimatePresence mode="wait">
            
            {/* 1. TASK FEED VIEW */}
            {activeTab === 'TaskFeed' && (
              <motion.div 
                key="TaskFeed"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col w-full h-full relative overflow-hidden"
              >
                {/* Content Area */}
                {getTasksFromMessages().length === 0 ? (
                  /* Idle Centered State */
                  <div className="flex-1 flex flex-col items-center justify-center text-center relative p-6 lg:p-10 w-full max-w-4xl mx-auto min-h-0">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#8052ff]/5 via-transparent to-transparent opacity-30 pointer-events-none"></div>
                    
                    {/* Top Telemetry Badges Strip */}
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-6 select-none z-20 relative">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 font-mono text-[10px] text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8052ff]"></span>
                        <span className="text-zinc-500">LLM:</span>
                        <span className="font-semibold">Llama 3.3</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 font-mono text-[10px] text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                        <span className="text-zinc-500">TTS:</span>
                        <span className="font-semibold">Kokoro</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 font-mono text-[10px] text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-mint)]"></span>
                        <span className="text-zinc-500">Mic Energy:</span>
                        <span className="font-semibold">{Math.floor(audioLevel * 100)}%</span>
                      </div>
                    </div>

                    <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-2 tracking-tight select-none font-display z-10">
                      {isSpeaking ? "Setu is speaking" : isActive ? "I'm listening..." : "Awaiting Command"}
                    </h2>
                    <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-10 select-none z-10">
                      Speak naturally or click the core voice node to toggle listening.
                    </p>

                    {/* Bioluminescent core orb */}
                    <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                      <div className="absolute w-56 h-56 border border-dashed border-[#8052ff]/20 rounded-full animate-[spin_50s_linear_infinite] pointer-events-none" />
                      <div className="absolute w-44 h-44 border border-dashed border-[var(--color-accent-purple)]/30 rounded-full animate-[spin_25s_linear_infinite_reverse] pointer-events-none" />

                      <div className="relative group z-10">
                        <AnimatePresence>
                          {(isActive || isSpeaking) && (
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{
                                scale: isSpeaking ? [1, 1.15, 1] : [1, 1.3, 1],
                                opacity: isSpeaking ? [0.4, 0.1, 0.4] : [0.6, 0, 0.6]
                              }}
                              exit={{ opacity: 0 }}
                              transition={{
                                repeat: Infinity,
                                duration: isSpeaking ? 1.2 : 2,
                                ease: "easeInOut"
                              }}
                              className={`absolute inset-0 rounded-full blur-xl pointer-events-none ${isSpeaking ? 'bg-amber-500/20' : 'bg-[#8052ff]/20'}`}
                            />
                          )}
                        </AnimatePresence>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={toggleListen}
                          className={`relative z-20 w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-500 border ${
                            isSpeaking
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                              : isActive
                                ? 'bg-[#8052ff]/20 border-white text-white shadow-[0_0_20px_rgba(128,82,255,0.3)]'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                          }`}
                        >
                          <div className="relative z-10 flex flex-col items-center justify-center font-sans">
                            {isSpeaking ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>
                            ) : isActive ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                            ) : (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                            )}
                            <span className="text-[9px] font-mono font-semibold tracking-widest mt-2 uppercase text-zinc-300 select-none">
                              {isSpeaking ? 'STOP' : isActive ? 'LISTENING' : 'TALK'}
                            </span>
                          </div>
                        </motion.button>
                      </div>
                    </div>

                    {/* Active Voice Speech Bubble */}
                    {messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-zinc-300 text-xs bg-white/[0.02] border border-white/5 px-5 py-2.5 rounded-2xl backdrop-blur-md max-w-xs z-10 mt-4"
                      >
                        "{messages[messages.length - 1].text}"
                      </motion.div>
                    )}
                  </div>
                ) : (
                  /* Two-Column Cockpit Layout */
                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10 min-h-0 w-full overflow-hidden">
                    
                    {/* Left Column - Voice Orb centerpiece (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col items-center justify-center text-center relative min-h-0">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#8052ff]/5 via-transparent to-transparent opacity-30 pointer-events-none"></div>
                      
                      {/* Top Telemetry Badges Strip */}
                      <div className="flex flex-wrap items-center justify-center gap-3 mb-6 select-none z-20 relative">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 font-mono text-[10px] text-zinc-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8052ff]"></span>
                          <span className="text-zinc-500">LLM:</span>
                          <span className="font-semibold">Llama 3.3</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 font-mono text-[10px] text-zinc-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                          <span className="text-zinc-500">TTS:</span>
                          <span className="font-semibold">Kokoro</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 font-mono text-[10px] text-zinc-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-mint)]"></span>
                          <span className="text-zinc-500">Mic Energy:</span>
                          <span className="font-semibold">{Math.floor(audioLevel * 100)}%</span>
                        </div>
                      </div>

                      <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight select-none font-display z-10">
                        {isSpeaking ? "Setu is speaking" : isActive ? "I'm listening..." : "Awaiting Command"}
                      </h2>
                      <p className="text-zinc-400 text-xs max-w-xs mx-auto mb-8 select-none z-10">
                        Speak naturally or click the core voice node to toggle listening.
                      </p>

                      {/* Bioluminescent core orb */}
                      <div className="relative w-60 h-60 flex items-center justify-center mb-6">
                        <div className="absolute w-52 h-52 border border-dashed border-[#8052ff]/20 rounded-full animate-[spin_50s_linear_infinite] pointer-events-none" />
                        <div className="absolute w-40 h-40 border border-dashed border-[var(--color-accent-purple)]/30 rounded-full animate-[spin_25s_linear_infinite_reverse] pointer-events-none" />

                        <div className="relative group z-10">
                          <AnimatePresence>
                            {(isActive || isSpeaking) && (
                              <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{
                                  scale: isSpeaking ? [1, 1.15, 1] : [1, 1.3, 1],
                                  opacity: isSpeaking ? [0.4, 0.1, 0.4] : [0.6, 0, 0.6]
                                }}
                                exit={{ opacity: 0 }}
                                transition={{
                                  repeat: Infinity,
                                  duration: isSpeaking ? 1.2 : 2,
                                  ease: "easeInOut"
                                }}
                                className={`absolute inset-0 rounded-full blur-xl pointer-events-none ${isSpeaking ? 'bg-amber-500/20' : 'bg-[#8052ff]/20'}`}
                              />
                            )}
                          </AnimatePresence>

                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={toggleListen}
                            className={`relative z-20 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-500 border ${
                              isSpeaking
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                                : isActive
                                  ? 'bg-[#8052ff]/20 border-white text-white shadow-[0_0_20px_rgba(128,82,255,0.3)]'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                            }`}
                          >
                            <div className="relative z-10 flex flex-col items-center justify-center font-sans">
                              {isSpeaking ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>
                              ) : isActive ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                              )}
                              <span className="text-[8px] font-mono font-semibold tracking-widest mt-1.5 uppercase text-zinc-300 select-none">
                                {isSpeaking ? 'STOP' : isActive ? 'LISTENING' : 'TALK'}
                              </span>
                            </div>
                          </motion.button>
                        </div>
                      </div>

                      {/* Active Voice Speech Bubble */}
                      {messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-zinc-300 text-xs bg-white/[0.02] border border-white/5 px-5 py-2.5 rounded-2xl backdrop-blur-md max-w-xs z-10 mt-4"
                        >
                          "{messages[messages.length - 1].text}"
                        </motion.div>
                      )}
                    </div>

                    {/* Right Column - Scrolling Task Feed (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col min-h-0 overflow-hidden relative">
                      <div className="flex justify-between items-center mb-4 shrink-0 pr-2">
                        <span className="text-xs font-bold tracking-widest text-[#8052ff] uppercase font-mono">Synthesis Task Stream</span>
                        <span className="text-[10px] text-zinc-500 font-mono">Running tasks: {getTasksFromMessages().filter(t => t.status === 'running').length}</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                        {getTasksFromMessages().map((task) => (
                          <div key={task.id} className="border border-white/5 bg-white/[0.01] backdrop-blur-[2px] rounded-3xl p-5 shadow-lg space-y-3.5 transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-zinc-500">TASK IDENTIFIER</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                task.status === 'completed' 
                                  ? 'bg-[#15846e]/10 border border-[#15846e]/20 text-[#15846e]' 
                                  : 'bg-[#8052ff]/10 border border-[#8052ff]/20 text-[#8052ff] animate-pulse'
                              }`}>
                                {task.status}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-white font-display leading-snug">
                              {task.command}
                            </h3>

                            {/* Steps list */}
                            {task.steps.length > 0 && (
                              <div className="border-t border-white/5 pt-3.5 space-y-2">
                                <span className="text-[9px] font-mono text-zinc-500 block mb-1.5">EXECUTION TRACE</span>
                                {task.steps.map((step: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2.5 text-[11px] font-sans">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#8052ff] shrink-0" />
                                    <span className="text-zinc-400">{step.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Result */}
                            {task.result && (
                              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-3.5 mt-2 font-sans">
                                <span className="text-[9px] font-mono text-[#8052ff] block mb-1 font-bold">➔ FINAL RESPONSE</span>
                                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{task.result}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

                {/* Floating Command Input Bar */}
                <div className="w-full max-w-2xl mx-auto px-6 pb-8 pt-2 z-20 shrink-0">
                  <div className="flex items-center gap-3 bg-white/[0.01] border border-white/5 rounded-2xl px-4 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.15)] font-sans backdrop-blur-[2px]">
                    <button
                      onClick={toggleListen}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        isSpeaking
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : isActive
                            ? 'bg-[#8052ff]/20 border-white text-white shadow-[0_0_10px_rgba(128,82,255,0.3)] animate-pulse'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {isActive ? (
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                      )}
                    </button>
                    <input
                      type="text"
                      placeholder={isActive ? "Listening to voice stream..." : "Type system command..."}
                      disabled={isActive}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          sendCommand(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder-zinc-500 disabled:opacity-50 font-sans"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* CHAT / HISTORY VIEW */}
            {activeTab === 'History' && (
              <motion.div 
                key="Chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar w-full py-10 px-10 lg:px-14 bg-transparent"
              >
                <div className="w-full max-w-5xl mx-auto space-y-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl font-bold text-white tracking-wide font-display">History</h2>
                      <p className="text-sm text-zinc-400 mt-2">Review your previous discussions and synthesis sessions.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {history.length === 0 ? (
                      <p className="text-zinc-500 text-sm">No history found.</p>
                    ) : (
                      history.map((conv, i) => (
                        <div key={conv.conversation_id || i} className="glass-panel rounded-2xl p-5 hover:border-white/10 transition-colors cursor-pointer group">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-zinc-400 group-hover:text-white transition-colors">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-white mb-1">Session {conv.conversation_id ? conv.conversation_id.substring(0, 8) : 'Unknown'}</h3>
                              <p className="text-xs text-zinc-500 mb-3">{conv.started_at ? new Date(conv.started_at).toLocaleString() : 'Recent'}</p>
                              <p className="text-sm text-zinc-400 leading-relaxed">
                                {conv.title || 'Agent discussion thread.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* VAULT / MEMORY CENTER VIEW */}
            {activeTab === 'Memory' && profile && (
              <motion.div 
                key="Vault"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar w-full py-10 px-10 lg:px-14 bg-transparent"
              >
                <div className="w-full max-w-5xl mx-auto space-y-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl font-bold text-white tracking-wide font-display">Memory Center</h2>
                      <p className="text-sm text-zinc-400 mt-2">Setu acts as a quiet extension of your mind. Here you can review, adjust, and control the<br/>contextual fabric of your assistant.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
                    <div className="col-span-1 lg:col-span-7 space-y-6">
                      
                      {/* Real User Info */}
                      <div className="glass-panel rounded-3xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 rounded-lg bg-[#8052ff]/10 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">Identity</h3>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-1">Username</h4>
                              <p className="text-sm text-zinc-400">{profile.username}</p>
                            </div>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-1">Email</h4>
                              <p className="text-sm text-zinc-400">{profile.email}</p>
                            </div>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-1">User ID</h4>
                              <p className="text-[11px] font-mono text-zinc-400">{profile.user_id}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="col-span-1 lg:col-span-5 space-y-6">
                      {/* Real Preferences */}
                      <div className="glass-panel rounded-3xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">System Allowances</h3>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-0.5">AI Provider</h4>
                              <p className="text-[11px] text-zinc-500">{profile.preferences?.ai_provider || 'Not set'}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-0.5">LLM Mode</h4>
                              <p className="text-[11px] text-zinc-500">{profile.preferences?.llm_mode || 'Not set'}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-0.5">LLM Model</h4>
                              <p className="text-[11px] text-zinc-500">{profile.preferences?.llm_model || 'Not set'}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-0.5">Theme</h4>
                              <p className="text-[11px] text-zinc-500">{profile.preferences?.theme || 'Not set'}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-0.5">Language</h4>
                              <p className="text-[11px] text-zinc-500">{profile.preferences?.language || 'Not set'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {/* DEVICES VIEW */}
            {activeTab === 'Devices' && (
              <motion.div 
                key="Devices"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar w-full py-10 px-10 lg:px-14 bg-transparent font-sans"
              >
                <div className="w-full max-w-5xl mx-auto space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold text-white tracking-wide font-display">Connected Devices</h2>
                    <p className="text-sm text-zinc-400 mt-2">Manage your connected smartphones and laptops for cross-device execution.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between min-h-[200px]">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active</span>
                          <span className="text-xs text-zinc-500">Last synced: 1m ago</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1 font-display">Workstation Host</h3>
                        <p className="text-xs text-zinc-400 font-mono">Windows 11 Client (Localhost)</p>
                      </div>
                      <div className="border-t border-white/5 pt-4 mt-6 flex justify-between items-center">
                        <span className="text-xs text-zinc-400">Security L2 Permitted</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      </div>
                    </div>

                    <div className="glass-panel rounded-3xl p-6 border-dashed border-white/10 hover:border-white/20 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] text-center group">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:border-[#8052ff]/30 group-hover:bg-[#8052ff]/5 transition-all">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">Pair Mobile Device</h3>
                      <p className="text-xs text-zinc-500 max-w-[200px]">Scan QR code or enter a 6-digit PIN on your phone to link it to Setu.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CONTACTS VIEW */}
            {activeTab === 'Contacts' && (
              <motion.div 
                key="Contacts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar w-full py-10 px-10 lg:px-14 bg-transparent font-sans"
              >
                <div className="w-full max-w-5xl mx-auto space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold text-white tracking-wide font-display">Contacts</h2>
                    <p className="text-sm text-zinc-400 mt-2">People synced for quick messaging and contact actions.</p>
                  </div>

                  <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                      <span className="text-sm font-bold text-white">All Contacts</span>
                      <button className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/10 transition-colors flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                        Add Contact
                      </button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {[
                        { name: "Aria Chen", phone: "+1 (555) 019-2834", relation: "Developer" },
                        { name: "Marcus Vance", phone: "+1 (555) 014-9921", relation: "Manager" },
                        { name: "Dev Team Lead", phone: "+1 (555) 012-3456", relation: "Team" }
                      ].map((contact, i) => (
                        <div key={i} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8052ff]/10 to-transparent border border-[#8052ff]/20 flex items-center justify-center text-sm font-bold text-white">
                              {contact.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-white">{contact.name}</h4>
                              <p className="text-xs text-zinc-500">{contact.phone}</p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-semibold text-zinc-400">{contact.relation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SETTINGS VIEW */}
            {activeTab === 'Settings' && (
              <motion.div 
                key="Settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar w-full py-10 px-10 lg:px-14 bg-transparent font-sans"
              >
                <div className="w-full max-w-5xl mx-auto space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold text-white tracking-wide font-display">Settings</h2>
                    <p className="text-sm text-zinc-400 mt-2">Configure system thresholds, providers, and integration rules.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel rounded-3xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-white mb-2 font-display">AI & Engine</h3>
                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-xs text-zinc-400 block mb-1.5 font-medium">Provider</span>
                          <select className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#8052ff]/40">
                            <option>OpenRouter (Free Models)</option>
                            <option>NVIDIA NIM</option>
                            <option>Ollama (Local LLM)</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs text-zinc-400 block mb-1.5 font-medium">Speech Recognition Model</span>
                          <select className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#8052ff]/40 font-sans">
                            <option>Whisper small-multilingual</option>
                            <option>Whisper tiny (Fastest)</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="glass-panel rounded-3xl p-6 space-y-4">
                      <h3 className="text-base font-bold text-white mb-2 font-display">System Controls</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-white mb-0.5">Strict L2 Permission Checks</h4>
                            <p className="text-xs text-zinc-500">Ask permission before running shell commands.</p>
                          </div>
                          <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#8052ff] rounded border-white/10" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-white mb-0.5">Automated Backups</h4>
                            <p className="text-xs text-zinc-500">Regularly export user profile & history to local DB.</p>
                          </div>
                          <input type="checkbox" className="w-4 h-4 accent-[#8052ff] rounded border-white/10" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            

          </AnimatePresence>
        </div>
      </main>

      {/* Floating Toast Notification Container */}
      <div className="fixed top-6 right-6 z-[9999] space-y-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              key={toast.id}
              className="pointer-events-auto w-full bg-[#0c0919]/95 backdrop-blur-md border border-[var(--color-accent-mint)]/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(130,242,168,0.1)] flex items-start gap-3 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-accent-mint)]" />
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-mint)]/10 border border-[var(--color-accent-mint)]/20 flex items-center justify-center text-[var(--color-accent-mint)] shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-white leading-tight">Reminder Triggered</h4>
                  <button 
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                <h5 className="text-xs font-semibold text-[var(--color-accent-mint)] mt-1">{toast.title}</h5>
                {toast.body && <p className="text-xs text-gray-300 mt-1">{toast.body}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
