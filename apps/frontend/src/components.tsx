import React, { useState, useCallback } from 'react';

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

// ─── Toast Hook ───────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  return { toasts, addToast };
}

// ─── Toast Container ──────────────────────────────────────────────────────────
export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{icons[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div className="spinner" style={{ width: size, height: size }} />
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Input Field ─────────────────────────────────────────────────────────────
interface InputProps {
  label?: string;
  id?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}
export function InputField({ label, id, type = 'text', value, onChange, placeholder, required }: InputProps) {
  return (
    <div>
      {label && <label className="input-label" htmlFor={id}>{label}</label>}
      <input
        id={id} type={type} value={value} required={required}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input"
      />
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: { icon: 28, text: 18 }, md: { icon: 36, text: 24 }, lg: { icon: 48, text: 32 } };
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2">
      <div style={{
        width: s.icon, height: s.icon, borderRadius: 10,
        background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: s.icon * 0.5, boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
        flexShrink: 0,
      }}>
        🌐
      </div>
      <span style={{ fontSize: s.text, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif",
        background: 'linear-gradient(135deg, #c084fc, #67e8f9)', WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        PixelVerse
      </span>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, action }: {
  icon: string; title: string; subtitle: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: 'var(--text-2)', marginBottom: 24, fontSize: 15 }}>{subtitle}</p>
      {action}
    </div>
  );
}
