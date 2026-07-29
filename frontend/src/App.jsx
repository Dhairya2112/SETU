import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { MobileChat } from './pages/MobileChat';
import { NeuralMesh } from './components/NeuralMesh';
import { TitleBar } from './components/TitleBar';
import { useAppStore } from './store/useAppStore';

import { useEffect, useCallback, useRef } from 'react';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshToken, setToken, setRefreshToken, logout, onboardingCompleted } = useAppStore();

  const isRefreshingRef = useRef(false);
  const refreshTokenRef = useRef(refreshToken);

  // Keep ref updated with latest token
  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  const refreshAccessToken = useCallback(async () => {
    const rt = refreshTokenRef.current;
    if (!rt || isRefreshingRef.current) return null;

    isRefreshingRef.current = true;
    try {
      const response = await fetch(`http://${window.location.hostname}:8000/api/v1/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.access_token && data.refresh_token) {
          setToken(data.access_token);
          setRefreshToken(data.refresh_token);
          console.log("Token refreshed successfully.");
          return data.access_token;
        }
      } else if (response.status === 401 || response.status === 403) {
        console.error("Refresh token invalid or expired, logging out.");
        logout();
      } else {
        console.error("Transient error refreshing token:", response.status);
      }
    } catch (err) {
      console.error("Error refreshing token:", err);
    } finally {
      isRefreshingRef.current = false;
    }
    return null;
  }, [setToken, setRefreshToken, logout]);

  // Periodic refresh loop + initial refresh on boot
  useEffect(() => {
    if (!refreshTokenRef.current) return;

    // Refresh immediately on load if we have a refresh token
    refreshAccessToken();

    // Refresh every 10 minutes (600,000 ms)
    const interval = setInterval(() => {
      refreshAccessToken();
    }, 600000);

    return () => clearInterval(interval);
  }, [refreshAccessToken]);

  const handleLoginSuccess = (newToken, newRefreshToken) => {
    setToken(newToken);
    setRefreshToken(newRefreshToken);
    navigate(onboardingCompleted ? '/dashboard' : '/onboarding/name');
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#030303] text-[var(--color-text-primary)] relative border border-white/10 select-none"
    >
      {/* Do not render desktop TitleBar on mobile interface */}
      {location.pathname !== '/mobile' && <TitleBar />}
      <div className="flex-1 relative z-10 w-full flex overflow-hidden">
        <NeuralMesh />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Login onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/onboarding/*" element={<Onboarding />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="/mobile" element={<MobileChat />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
