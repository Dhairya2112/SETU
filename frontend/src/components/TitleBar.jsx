import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SetuLogo } from './SetuLogo';

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
        <SetuLogo size={14} />
        <span className="font-semibold tracking-wide text-[11px] text-zinc-300">Setu Workstation</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-white/5 font-mono">v1.0.0-beta</span>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
        <span>{token ? 'Secure Desktop Session' : 'Offline Mode'}</span>
      </div>
    </div>
  );
}
