import { useState, useEffect, useRef } from 'react';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';
import { useAgentSocket } from '../hooks/useAgentSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import heroImg from '../assets/hero.png';

export function Dashboard() {
  const navigate = useNavigate();
  const { token, username, conversationId, setUsername, logout } = useAppStore();
  const [activeTab, setActiveTab] = useState<string>('Automation');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);


  // Initialize Socket connection
  const { isConnected, messages, isThinking, isSpeaking, sendCommand, stopSpeaking } = useAgentSocket({
    token,
    conversationId
  });

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
    const completed = localStorage.getItem('pookie_onboarding_completed') === 'true';
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

  // Poll audio level when listening to animate the UI
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



  // Implement Barge-in (microphone active monitoring during voice response playback)
  useEffect(() => {
    let bargeInFrameId: number;

    const checkBargeIn = () => {
      if (isSpeaking) {
        const energy = getNormalizedEnergy();
        if (energy > 0.7) { // 0.7 sensitivity threshold
          console.log("Barge-in interrupted playback! Audio level:", energy);
          stopSpeaking();
          // Immediately switch back to listening state
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

  // Autoscroll to bottom in Chats view when messages update (scrolls only the terminal body, preventing page jump)
  useEffect(() => {
    if (activeTab === 'Chats' && messagesContainerRef.current) {
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
    { id: 'Automation', icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>, label: "Automation" },
    { id: 'Dashboard', icon: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>, label: "Dashboard" },
    { id: 'Chats', icon: <><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></>, label: "Activity Log" },
    { id: 'Images', icon: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></>, label: "Images" },
    { id: 'History', icon: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>, label: "History" }
  ];

  return (
    <div className="flex w-full h-full">
      {/* Desktop Sidebar (Tighter/narrower layout) */}
      <aside className="w-20 lg:w-52 h-full border-r border-white/5 bg-[#050809]/80 backdrop-blur-xl flex flex-col items-center lg:items-start py-5 px-3 relative z-10 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-accent-mint)] to-[var(--color-accent-lime)] flex items-center justify-center text-black shadow-[0_0_15px_rgba(130,242,168,0.2)] shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c0 5.5-4.5 10-10 10 5.5 0 10 4.5 10 10 0-5.5 4.5-10 10-10-5.5 0-10-4.5-10-10Z" />
            </svg>
          </div>
          <span className="hidden lg:block font-display text-lg font-bold tracking-widest text-white">POOKIE</span>
        </div>

        <nav className="flex-1 w-full space-y-2">
          {sidebarNavItems.map((item, idx) => (
            <motion.button 
              key={idx}
              onClick={() => setActiveTab(item.id)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.97 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${activeTab === item.id ? 'bg-white/10 text-[var(--color-accent-mint)] shadow-inner' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
              <span className="hidden lg:block font-medium text-sm">{item.label}</span>
            </motion.button>
          ))}
        </nav>

        <div className="w-full mt-auto">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            onClick={handleLogout}
          >
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 overflow-hidden text-[10px] text-red-300 font-bold">
              EXIT
            </div>
            <div className="hidden lg:flex flex-col items-start">
              <span className="text-xs font-semibold text-white">Log Out</span>
            </div>
          </motion.button>
        </div>
      </aside>

      {/* Main Content Area (Workstation) */}
      <main className="flex-1 h-full flex flex-col relative z-10 bg-transparent min-w-0">
        
        {/* Top Header (Slimmer layout) */}
        <header className="flex justify-between items-center px-6 lg:px-8 py-3.5 shrink-0 w-full border-b border-white/5 bg-[#050809]/50 backdrop-blur-md z-20 relative">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex items-center gap-3"
          >
            <div>
              <h1 className="text-lg font-light text-[var(--color-text-secondary)] leading-tight">
                Welcome, <span className="font-semibold text-white">{username}</span>
              </h1>
              <div className={`mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${isConnected ? 'bg-green-500/10 text-[var(--color-accent-mint)] border-[var(--color-accent-mint)]/30' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {isConnected && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent-mint)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-accent-mint)]"></span>
                  </span>
                )}
                {isConnected ? 'Neural Link Active' : 'Connecting...'}
              </div>
            </div>
          </motion.div>
          
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </button>
          </div>
        </header>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
          
          {/* AUTOMATION VIEW */}
          {activeTab === 'Automation' && (
            <div className="flex-1 flex w-full h-full relative overflow-hidden bg-gradient-to-b from-transparent to-black/40">
              {/* Left Telemetry Panel */}
              <div className="hidden xl:flex w-64 border-r border-white/5 bg-black/10 backdrop-blur-sm p-6 flex-col justify-between shrink-0 relative z-10">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent-cyan)] mb-6">Neural Pathways</h4>
                  <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="text-xs font-semibold text-white mb-1">Primary LLM</div>
                      <div className="text-sm font-bold text-[var(--color-accent-mint)]">Gemma-2-9B</div>
                      <div className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> OpenRouter Cloud
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="text-xs font-semibold text-white mb-1">Local TTS Engine</div>
                      <div className="text-sm font-bold text-[var(--color-accent-purple)]">Kokoro TTS</div>
                      <div className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> 340M Model Weights
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="text-xs font-semibold text-white mb-1">STT Wake Word</div>
                      <div className="text-sm font-bold text-gray-400">OpenWakeWord</div>
                      <div className="text-[10px] text-gray-500 mt-1.5">Wake word: "Hey Jarvis"</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-600">
                  SYS_VERSION: 1.2.0-b
                </div>
              </div>

              {/* Center Voice Core Space */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden z-10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--color-accent-purple)]/5 via-transparent to-transparent opacity-40"></div>
                
                <div className="relative z-10 flex flex-col items-center justify-center max-w-xl">
                  <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
                    {isSpeaking ? "POOKIE is speaking" : isActive ? "I'm listening..." : "Awaiting Command"}
                  </h2>
                  <p className="text-gray-400 text-sm max-w-md mx-auto mb-16">
                    Click the central core to toggle speech recognition. Talk naturally to control your workstation.
                  </p>

                  {/* Interactive Holo Core */}
                  <div className="relative w-80 h-80 flex items-center justify-center">

                    {/* Orbit Ring 1 (Slow spin) */}
                    <div className="absolute w-72 h-72 border border-dashed border-[var(--color-accent-cyan)]/20 rounded-full animate-[spin_40s_linear_infinite] pointer-events-none" />
                    
                    {/* Orbit Ring 2 (Fast counter-spin) */}
                    <div className="absolute w-60 h-60 border border-double border-[var(--color-accent-purple)]/30 rounded-full animate-[spin_20s_linear_infinite_reverse] pointer-events-none" />

                    {/* Central Bioluminescent Button */}
                    <div className="relative group z-10">
                      {/* Interactive dynamic ripple ring */}
                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{
                              scale: [1, 1.35, 1],
                              opacity: [0.6, 0, 0.6]
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                              repeat: Infinity,
                              duration: 2,
                              ease: "easeInOut"
                            }}
                            className="absolute inset-0 rounded-full bg-[var(--color-accent-mint)]/20 blur-xl pointer-events-none"
                          />
                        )}
                      </AnimatePresence>

                      <motion.button
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleListen}
                        className={`relative z-20 w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-500 border shadow-[0_0_50px_rgba(0,0,0,0.6)] ${
                          isSpeaking
                            ? 'bg-gradient-to-tr from-red-600 via-rose-500 to-orange-500 border-red-400 text-white shadow-[0_0_60px_rgba(239,68,68,0.5),inset_0_4px_12px_rgba(255,255,255,0.3)]'
                            : isActive
                              ? 'bg-gradient-to-tr from-[var(--color-accent-cyan)] via-[var(--color-accent-mint)] to-[var(--color-accent-lime)] border-white text-black shadow-[0_0_60px_rgba(34,211,238,0.5),inset_0_4px_12px_rgba(255,255,255,0.4)]'
                              : 'bg-gradient-to-tr from-white/5 via-white/10 to-white/5 border-white/10 hover:border-white/20 text-white shadow-[inset_0_4px_12px_rgba(255,255,255,0.05),0_0_30px_rgba(255,255,255,0.02)]'
                        }`}
                      >
                        {/* Dynamic Core Glow inside the button */}
                        <div className="absolute inset-1 rounded-full bg-black/15 blur-[2px] z-0" />

                        <div className="relative z-10 flex flex-col items-center justify-center">
                          {isSpeaking ? (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>
                          ) : isActive ? (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                          ) : (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                          )}
                          <span className={`text-[9px] font-mono font-bold tracking-widest mt-2 uppercase ${isActive ? 'text-black/70' : 'text-gray-400'}`}>
                            {isSpeaking ? 'STOP' : isActive ? 'LISTENING' : 'TALK'}
                          </span>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                  
                  {messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-16 text-gray-300 text-base font-medium bg-white/5 px-8 py-4 rounded-full border border-white/10 backdrop-blur-md max-w-2xl"
                    >
                      "{messages[messages.length - 1].text}"
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Right Telemetry Panel */}
              <div className="hidden xl:flex w-64 border-l border-white/5 bg-black/10 backdrop-blur-sm p-6 flex-col justify-between shrink-0 relative z-10">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent-purple)] mb-6">Metrics Stream</h4>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Core Latency</span>
                        <span className="text-white font-mono">24ms</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--color-accent-mint)] w-[85%]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Voice Energy</span>
                        <span className="text-white font-mono">{Math.floor(audioLevel * 100)}%</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div animate={{ width: `${audioLevel * 100}%` }} className="h-full bg-[var(--color-accent-cyan)]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Neural Buffer</span>
                        <span className="text-white font-mono">0.02s</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--color-accent-purple)] w-[15%]" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-600 text-right">
                  SOCKET_STATE: CONNECTED
                </div>
              </div>
            </div>
          )}

          {/* DASHBOARD VIEW */}
          {activeTab === 'Dashboard' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar w-full py-6 px-6 lg:px-8">
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-6xl mx-auto space-y-6"
              >
                {/* Hero Header Command Hub Panel */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--color-accent-mint)]/10 via-[#0a0715] to-[#04020a] border border-white/5 p-6 lg:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                  {/* Subtle vector grid overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.015)_1.5px,transparent_1.5px)] [background-size:16px_16px] pointer-events-none" />
                  
                  {/* Text Content */}
                  <div className="relative z-10 flex-1 space-y-4">
                    <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                      Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-accent-mint)] to-[var(--color-accent-cyan)]">{username}</span>.
                    </h2>
                    <p className="text-gray-300 text-base max-w-lg leading-relaxed">
                      All local neural pipelines are operational. Voice activation triggers and real-time execution kernels are ready to receive commands.
                    </p>

                    {/* Status Pill Matrix */}
                    <div className="flex flex-wrap gap-2.5 pt-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 font-mono text-xs text-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-mint)]"></span> CORE: UP
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 font-mono text-xs text-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-cyan)]"></span> LINK: WSS
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 font-mono text-xs text-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-purple)]"></span> CRYPTO: LOCAL
                      </div>
                    </div>
                  </div>
                  
                  {/* Hero Visualizer */}
                  <div className="relative z-10 w-full md:w-[35%] flex items-center justify-center pointer-events-none">
                    <div className="absolute w-48 h-48 rounded-full border border-dashed border-white/5 animate-[spin_60s_linear_infinite]" />
                    <div className="absolute w-40 h-40 rounded-full border border-double border-[var(--color-accent-mint)]/10 animate-[spin_30s_linear_infinite_reverse]" />
                    <motion.img 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8 }}
                      src={heroImg} 
                      alt="AI Workstation Core" 
                      className="w-40 h-40 object-contain drop-shadow-[0_0_20px_rgba(130,242,168,0.1)] relative z-10" 
                    />
                  </div>
                </div>
                
                {/* DUAL CORE NEURAL ENGINE CARDS */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3.5">Core Neural Pipelines</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Automation Engine Card */}
                    <motion.div 
                      whileHover={{ y: -3 }}
                      onClick={() => setActiveTab('Automation')}
                      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c0919] to-[#04020a] border border-white/5 p-5 cursor-pointer transition-all duration-300 hover:border-[var(--color-accent-mint)]/30 hover:shadow-[0_0_30px_rgba(130,242,168,0.05)]"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-accent-mint)] opacity-[0.01] group-hover:opacity-[0.03] blur-2xl rounded-full transition-opacity duration-300 translate-x-8 -translate-y-8"></div>
                      
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-4">
                          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-mint)]/10 border border-[var(--color-accent-mint)]/20 flex items-center justify-center text-[var(--color-accent-mint)] shadow-[0_0_12px_rgba(130,242,168,0.15)]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-white tracking-wide">Workstation Automation Cockpit</h4>
                            <p className="text-gray-300 text-sm mt-1.5 leading-relaxed">
                              Talk to POOKIE or type commands to control your computer and run automation tasks.
                            </p>
                          </div>
                          
                          {/* Simulated CRT details */}
                          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-gray-400 space-y-1">
                            <div><span className="text-[var(--color-accent-mint)]">➔</span> Status: Ready</div>
                            <div><span className="text-[var(--color-accent-mint)]">➔</span> Trigger: "Hey Jarvis"</div>
                          </div>
                        </div>
                        
                        <span className="text-[var(--color-accent-mint)] text-sm font-semibold opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                          &rarr;
                        </span>
                      </div>
                    </motion.div>

                    {/* Console Log Stream Card */}
                    <motion.div 
                      whileHover={{ y: -3 }}
                      onClick={() => setActiveTab('Chats')}
                      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c0919] to-[#04020a] border border-white/5 p-5 cursor-pointer transition-all duration-300 hover:border-[var(--color-accent-purple)]/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.05)]"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-accent-purple)] opacity-[0.01] group-hover:opacity-[0.03] blur-2xl rounded-full transition-opacity duration-300 translate-x-8 -translate-y-8"></div>
                      
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-4">
                          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/20 flex items-center justify-center text-[var(--color-accent-purple)] shadow-[0_0_12px_rgba(168,85,247,0.15)]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-white tracking-wide">Terminal Activity Stream</h4>
                            <p className="text-gray-300 text-sm mt-1.5 leading-relaxed">
                              View command history, system logs, and live responses from the AI workstation.
                            </p>
                          </div>

                          {/* Simulated CRT details */}
                          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-gray-400 space-y-1">
                            <div><span className="text-[var(--color-accent-purple)]">➔</span> Stream: Live logs</div>
                            <div><span className="text-[var(--color-accent-purple)]">➔</span> Connection: Online</div>
                          </div>
                        </div>
                        
                        <span className="text-[var(--color-accent-purple)] text-sm font-semibold opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                          &rarr;
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* WORKSTATION GRID SUBSECTION */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Image Studio pipeline (locked) */}
                  <div className="rounded-2xl bg-[#090710]/40 border border-white/5 p-5 flex flex-col justify-between relative overflow-hidden group shadow-lg">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/10">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                        <h4 className="text-base font-bold text-white">Image Studio</h4>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        Generate custom AI images, avatars, and artwork directly on your workstation.
                      </p>
                    </div>
                    
                    <div className="pt-4 flex items-center justify-between border-t border-white/5 mt-4">
                      <span className="text-xs font-mono text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded uppercase">
                        Coming Soon
                      </span>
                      <span className="text-xs font-mono text-gray-500">[STANDBY]</span>
                    </div>
                  </div>

                  {/* Visual Circle Diagnostic Meters */}
                  <div className="rounded-2xl bg-[#090710]/40 border border-white/5 p-5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-cyan)]/10 flex items-center justify-center text-[var(--color-accent-cyan)] border border-[var(--color-accent-cyan)]/10">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      </div>
                      <h4 className="text-base font-bold text-white">Diagnostics Monitor</h4>
                    </div>

                    <div className="flex justify-around items-center py-2 shrink-0">
                      {/* CPU load */}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="24" cy="24" r="21" stroke="rgba(255,255,255,0.03)" strokeWidth="3" fill="transparent" />
                            <circle cx="24" cy="24" r="21" stroke="var(--color-accent-mint)" strokeWidth="3" fill="transparent" strokeDasharray={131} strokeDashoffset={131 * 0.82} />
                          </svg>
                          <span className="absolute text-xs font-mono text-white font-bold">18%</span>
                        </div>
                        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Processor</span>
                      </div>

                      {/* Memory load */}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="24" cy="24" r="21" stroke="rgba(255,255,255,0.03)" strokeWidth="3" fill="transparent" />
                            <circle cx="24" cy="24" r="21" stroke="var(--color-accent-cyan)" strokeWidth="3" fill="transparent" strokeDasharray={131} strokeDashoffset={131 * 0.55} />
                          </svg>
                          <span className="absolute text-xs font-mono text-white font-bold">45%</span>
                        </div>
                        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Memory</span>
                      </div>

                      {/* Latency */}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="24" cy="24" r="21" stroke="rgba(255,255,255,0.03)" strokeWidth="3" fill="transparent" />
                            <circle cx="24" cy="24" r="21" stroke="var(--color-accent-purple)" strokeWidth="3" fill="transparent" strokeDasharray={131} strokeDashoffset={131 * 0.15} />
                          </svg>
                          <span className="absolute text-xs font-mono text-white font-bold">24ms</span>
                        </div>
                        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Response</span>
                      </div>
                    </div>
                  </div>

                  {/* Neural Console Feed */}
                  <div className="rounded-2xl bg-[#090710]/40 border border-white/5 p-5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center text-gray-400 border border-white/5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                      </div>
                      <h4 className="text-base font-bold text-white">Console Stream</h4>
                    </div>

                    <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 font-mono text-xs text-gray-300 space-y-1.5 h-16 overflow-hidden select-none">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--color-accent-mint)] font-bold">USER:</span>
                        <span>Profile loaded successfully</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--color-accent-cyan)] font-bold">NET:</span>
                        <span>Connection online</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--color-accent-purple)] font-bold">TTS:</span>
                        <span>Synthesizer engine ready</span>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            </div>
          )}

          {/* CHATS VIEW */}
          {activeTab === 'Chats' && (
            <div className="flex-1 flex w-full h-full overflow-hidden bg-gradient-to-b from-transparent to-black/40">
              {/* Terminal Column */}
              <div className="flex-1 flex flex-col p-6 lg:p-8 overflow-hidden h-full">
                {/* Console Window */}
                <div className="flex-1 glass-panel rounded-3xl border border-white/10 flex flex-col overflow-hidden shadow-2xl relative">
                  {/* Console Title Bar */}
                  <div className="h-12 border-b border-white/10 bg-black/40 px-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_8px_rgba(255,95,86,0.4)]" />
                      <span className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_8px_rgba(255,189,46,0.4)]" />
                      <span className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_8px_rgba(39,201,63,0.4)]" />
                      <span className="text-xs font-mono text-gray-500 ml-4 select-none">pookie-core@workstation:~</span>
                    </div>
                    <div className="flex items-center gap-3 select-none">
                      <span className="w-2 h-2 rounded-full bg-[var(--color-accent-mint)] animate-pulse" />
                      <span className="text-[10px] font-mono text-gray-400 tracking-widest uppercase">sys_log_stream</span>
                    </div>
                  </div>

                  {/* Terminal Screen Body */}
                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-6 custom-scrollbar bg-black/20">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-75 p-8 select-none">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--color-accent-cyan)] mb-6 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                        </div>
                        <h4 className="text-white text-base font-bold mb-2">Awaiting Session Logs</h4>
                        <p className="text-gray-400 text-xs max-w-sm">No commands executed in this session. Enter a prompt below or start voice execution.</p>
                      </div>
                    ) : (
                      messages.map((msg, i) => (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          key={i}
                          className="space-y-2"
                        >
                          {msg.role === 'user' ? (
                            <div className="text-gray-400">
                              <span className="text-[var(--color-accent-cyan)] font-bold">daved@pookie-core:~$ </span>
                              <span className="text-white font-medium">{msg.text}</span>
                            </div>
                          ) : (
                            <div className="text-gray-300 pl-4 border-l border-[var(--color-accent-mint)]/20 py-1 space-y-1">
                              <div className="text-[10px] text-[var(--color-accent-mint)] font-bold tracking-wider uppercase">➔ POOKIE_CORE SUCCESS</div>
                              <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}

                    {isThinking && (
                      <div className="flex items-center gap-3 text-[var(--color-accent-purple)] animate-pulse">
                        <span className="text-[var(--color-accent-purple)] font-bold">➔ pookie_synthesis:</span>
                        <span>processing pipeline...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Terminal Input Bar */}
                  <div className="p-4 border-t border-white/10 bg-black/30 shrink-0">
                    <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-2xl px-4 py-2 hover:border-white/10 transition-colors">
                      <span className="font-mono text-gray-500 text-sm select-none">POOKIE_CORE &gt;</span>
                      <input
                        type="text"
                        placeholder={isActive ? "Awaiting system voice stream..." : "Enter console command..."}
                        disabled={isActive}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            sendCommand(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="flex-1 bg-transparent text-white font-mono text-sm py-2 outline-none placeholder-gray-600 disabled:opacity-50"
                      />
                      {/* Integrated Voice Activation Button */}
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleListen}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors z-20 relative ${
                          isSpeaking 
                            ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' 
                            : isActive 
                              ? 'bg-[var(--color-accent-mint)] text-black shadow-[0_0_10px_rgba(130,242,168,0.4)]' 
                              : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {isSpeaking ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>
                        ) : isActive ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Controls Panel (Right Side) */}
              <div className="hidden xl:flex w-72 border-l border-white/5 bg-black/10 backdrop-blur-sm p-6 flex-col justify-between shrink-0 relative z-10">
                <div className="space-y-8">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent-purple)] mb-4">Pipeline Monitors</h4>
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <span className="text-xs text-gray-400">WebSocket</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'text-[var(--color-accent-mint)]' : 'text-red-400'}`}>
                          {isConnected ? 'Connected' : 'Offline'}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Voice Synthesis</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSpeaking ? 'text-[var(--color-accent-purple)] animate-pulse' : 'text-gray-500'}`}>
                          {isSpeaking ? 'Streaming' : 'Idle'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent-cyan)] mb-4">Command Suggestions</h4>
                    <div className="space-y-2">
                      {[
                        "Open Chrome and search for AI news",
                        "Check system uptime",
                        "Show current time"
                      ].map((text, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendCommand(text)}
                          className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-gray-300 hover:text-white transition-all truncate"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Active Wake Word</div>
                  <div className="text-sm font-bold text-white">"Hey Jarvis"</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
