import React, { useState } from 'react';
import { signup, signin } from './api';
import { Logo, InputField, Spinner, ToastContainer, useToast } from './components';

interface AuthPageProps {
  onAuth: (token: string) => void;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);
  const { toasts, addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      addToast('Please fill in all fields', 'error');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signup(username.trim(), password, type);
        addToast('Account created! Sign in now.', 'success');
        setMode('signin');
        setPassword('');
      } else {
        const { token } = await signin(username.trim(), password);
        addToast('Welcome back!', 'success');
        onAuth(token);
      }
    } catch (err: any) {
      addToast(err.message || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden',
      background: 'var(--bg-0)',
    }}>
      {/* Background orbs */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
        top: '-100px', left: '-100px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
        bottom: '-80px', right: '-80px', pointerEvents: 'none',
      }} />

      {/* Left panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px', position: 'relative',
      }}>
        <div style={{ maxWidth: 420, width: '100%', animation: 'fadeUp 0.5s ease' }}>
          <div style={{ marginBottom: 36 }}>
            <Logo size="lg" />
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 10, lineHeight: 1.15 }}>
            {mode === 'signin' ? 'Welcome back' : 'Join PixelVerse'}
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 36 }}>
            {mode === 'signin'
              ? 'Sign in to enter your virtual world.'
              : 'Create your account and claim your space.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <InputField
              id="username" label="Username" placeholder="e.g. pixel_pioneer"
              value={username} onChange={setUsername} required
            />
            <InputField
              id="password" label="Password" type="password" placeholder="Enter your password"
              value={password} onChange={setPassword} required
            />

            {mode === 'signup' && (
              <div>
                <label className="input-label">Account Type</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['user', 'admin'] as const).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setType(t)}
                      style={{
                        flex: 1, padding: '10px 16px', borderRadius: 'var(--radius)',
                        border: `1px solid ${type === t ? 'var(--brand-2)' : 'var(--border-light)'}`,
                        background: type === t ? 'rgba(124,58,237,0.2)' : 'var(--bg-3)',
                        color: type === t ? 'var(--brand-3)' : 'var(--text-2)',
                        cursor: 'pointer', fontWeight: 600, fontSize: 14,
                        transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                        textTransform: 'capitalize',
                      }}
                    >
                      {t === 'user' ? '🧑 User' : '⚡ Admin'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              id="auth-submit" type="submit" className="btn btn-primary btn-lg"
              disabled={loading} style={{ marginTop: 4 }}
            >
              {loading ? <><Spinner /> {mode === 'signin' ? 'Signing in…' : 'Creating…'}</> :
                mode === 'signin' ? '→ Enter PixelVerse' : '→ Create Account'}
            </button>
          </form>

          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontSize: 14 }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button
              id="auth-toggle"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setPassword(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--brand-3)',
                cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'Inter, sans-serif',
              }}
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>

      {/* Right decorative panel */}
      <div style={{
        flex: '0 0 440px', background: 'var(--bg-1)',
        borderLeft: '1px solid var(--border-light)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 40, gap: 32,
      }}>
        {/* Mini world preview */}
        <div style={{
          width: 280, height: 280, borderRadius: 24,
          background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))',
          border: '1px solid var(--border)',
          position: 'relative', overflow: 'hidden',
          boxShadow: 'var(--glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Grid lines */}
          <svg width="280" height="280" style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <g key={i}>
                <line x1={i * 40} y1={0} x2={i * 40} y2={280} stroke="#7c3aed" strokeWidth="1" />
                <line x1={0} y1={i * 40} x2={280} y2={i * 40} stroke="#7c3aed" strokeWidth="1" />
              </g>
            ))}
          </svg>
          {/* Avatars on the grid */}
          {[
            { x: 80, y: 100, color: '#7c3aed', label: 'You' },
            { x: 160, y: 140, color: '#06b6d4', label: 'Alice' },
            { x: 200, y: 80, color: '#10b981', label: 'Bob' },
          ].map((a, i) => (
            <div key={i} style={{
              position: 'absolute', left: a.x, top: a.y, textAlign: 'center',
              animation: `float ${2.5 + i * 0.5}s ease-in-out infinite`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: a.color, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, margin: '0 auto 4px',
                boxShadow: `0 0 12px ${a.color}66`,
              }}>👤</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{a.label}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
            Your virtual office,<br />reimagined
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            Move your avatar around, meet teammates, and collaborate in real-time — all in 2D.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { icon: '🚀', label: 'Real-time' },
            { icon: '🏢', label: 'Custom Spaces' },
            { icon: '👾', label: 'Avatars' },
          ].map(f => (
            <div key={f.label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: 'var(--bg-2)',
              borderRadius: 99, border: '1px solid var(--border-light)',
              fontSize: 13, color: 'var(--text-2)', fontWeight: 500,
            }}>
              {f.icon} {f.label}
            </div>
          ))}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
