import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { NeuralMesh } from './components/NeuralMesh';
import { TitleBar } from './components/TitleBar';
import { useAppStore } from './store/useAppStore';

function App() {
  const navigate = useNavigate();
  const { setToken, onboardingCompleted } = useAppStore();

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
    navigate(onboardingCompleted ? '/dashboard' : '/onboarding/name');
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#030303] text-[var(--color-text-primary)] relative border border-white/10 select-none"
    >
      <TitleBar />
      <div className="flex-1 relative z-10 w-full flex overflow-hidden">
        <NeuralMesh />
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
