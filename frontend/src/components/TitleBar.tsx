import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function TitleBar() {
  const { token } = useAppStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleClose = () => {
    if (window.confirm("Close Setu Workstation?")) {
      window.close();
    }
  };

  return (
    <div className="h-9 w-full bg-zinc-950/90 border-b border-white/5 flex items-center justify-between px-3 select-none relative z-50 text-white font-sans text-xs">
      {/* App Identifier */}
      <div className="flex items-center gap-2 drag-region">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8052ff" strokeWidth="2.5">
          <path d="M16 8.5H10.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H8" />
          <circle cx="12.5" cy="13.5" r="1.5" fill="#8052ff" stroke="none" />
        </svg>
        <span className="font-semibold tracking-wide text-[11px] text-zinc-300">Setu Workstation</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-white/5 font-mono">v1.0.0-beta</span>
      </div>

      {/* Center Status / drag area */}
      <div className="flex-1 h-full flex items-center justify-center font-mono text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
          <span>{token ? 'Secure Desktop Session' : 'Offline Mode'}</span>
        </div>
      </div>

      {/* Windows Window Controls */}
      <div className="flex items-center h-full">
        {/* Minimize Button */}
        <button 
          className="h-full px-4 flex items-center justify-center hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          onClick={() => console.log("Minimize")}
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="0" y1="0.5" x2="10" y2="0.5" />
          </svg>
        </button>

        {/* Maximize Button */}
        <button 
          className="h-full px-4 flex items-center justify-center hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          onClick={() => console.log("Maximize")}
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>

        {/* Close Button */}
        <button 
          className="h-full px-4 flex items-center justify-center hover:bg-rose-600 transition-colors text-zinc-400 hover:text-white"
          onClick={handleClose}
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
