import { useState, useEffect } from 'react';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import Arena from './Game';

type View = 'auth' | 'dashboard' | 'arena';

export default function App() {
  const [view, setView] = useState<View>('auth');
  const [token, setToken] = useState('');
  const [activeSpaceId, setActiveSpaceId] = useState('');

  // Persist token in sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('pv_token');
    if (saved) { setToken(saved); setView('dashboard'); }
  }, []);

  const handleAuth = (t: string) => {
    sessionStorage.setItem('pv_token', t);
    setToken(t);
    setView('dashboard');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('pv_token');
    setToken('');
    setView('auth');
  };

  const handleEnterSpace = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    setView('arena');
  };

  if (view === 'auth')      return <AuthPage onAuth={handleAuth} />;
  if (view === 'dashboard') return <Dashboard token={token} onEnterSpace={handleEnterSpace} onLogout={handleLogout} />;
  if (view === 'arena')     return <Arena token={token} spaceId={activeSpaceId} onLeave={() => setView('dashboard')} />;
  return null;
}
