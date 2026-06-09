import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { NeuralMesh } from './components/NeuralMesh';
import { useState } from 'react';
import { useAppStore } from './store/useAppStore';

function App() {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { setToken, onboardingCompleted } = useAppStore();

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
    navigate(onboardingCompleted ? '/dashboard' : '/onboarding/name');
  };

  return (
    <div 
      className="flex h-screen w-screen overflow-hidden bg-transparent text-[var(--color-text-primary)] relative"
      onMouseMove={handleMouseMove}
    >
      <NeuralMesh />
      <div 
        className="absolute w-[800px] h-[800px] rounded-full pointer-events-none opacity-[0.05] blur-[120px] transition-transform duration-500 ease-out z-0"
        style={{
          background: 'radial-gradient(circle, var(--color-accent-cyan) 0%, var(--color-accent-purple) 50%, transparent 70%)',
          transform: `translate(${mousePosition.x - 400}px, ${mousePosition.y - 400}px)`
        }}
      />
      <div className="relative z-10 w-full h-full flex">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Login onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/onboarding/*" element={<Onboarding />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
