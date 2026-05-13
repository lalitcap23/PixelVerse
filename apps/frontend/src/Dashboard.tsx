import React, { useState, useEffect, useCallback } from 'react';
import { getAllSpaces, createSpace, deleteSpace, Space } from './api';
import { Logo, Modal, InputField, Spinner, ToastContainer, useToast, EmptyState } from './components';

interface DashboardProps {
  token: string;
  onEnterSpace: (spaceId: string) => void;
  onLogout: () => void;
}

const DIMENSIONS = ['10x10', '20x20', '30x30', '50x50', '100x100'];

export default function Dashboard({ token, onEnterSpace, onLogout }: DashboardProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [dimensions, setDimensions] = useState('20x20');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toasts, addToast } = useToast();

  const loadSpaces = useCallback(async () => {
    try {
      const data = await getAllSpaces(token);
      setSpaces(data.spaces);
    } catch {
      addToast('Failed to load spaces', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceName.trim()) { addToast('Space name required', 'error'); return; }
    setCreating(true);
    try {
      const { spaceId } = await createSpace(spaceName.trim(), dimensions, token);
      addToast('Space created!', 'success');
      setCreateOpen(false);
      setSpaceName('');
      loadSpaces();
    } catch (err: any) {
      addToast(err.message || 'Failed to create space', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (spaceId: string, spaceName: string) => {
    if (!confirm(`Delete "${spaceName}"?`)) return;
    setDeleting(spaceId);
    try {
      await deleteSpace(spaceId, token);
      addToast('Space deleted', 'info');
      setSpaces(s => s.filter(x => x.id !== spaceId));
    } catch (err: any) {
      addToast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const getSpaceEmoji = (i: number) => ['🏢', '🌴', '🚀', '🎮', '🎨', '🏖️', '🌌', '🏔️'][i % 8];
  const getSpaceGradient = (i: number) => [
    'linear-gradient(135deg, #7c3aed33, #06b6d433)',
    'linear-gradient(135deg, #10b98133, #06b6d433)',
    'linear-gradient(135deg, #f59e0b33, #ef444433)',
    'linear-gradient(135deg, #ec489933, #a855f733)',
  ][i % 4];

  const handleJoinById = () => {
    const id = joinId.trim();
    if (!id) { addToast('Enter a space ID', 'error'); return; }
    setJoinOpen(false);
    setJoinId('');
    onEnterSpace(id);
  };

  const copySpaceId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => addToast('Space ID copied!', 'success'));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(6,6,16,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-light)',
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', background: 'var(--bg-2)',
            borderRadius: 99, border: '1px solid var(--border-light)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Online</span>
          </div>
          <button id="logout-btn" className="btn btn-ghost btn-sm" onClick={onLogout}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 8 }}>
              Your Spaces
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 16 }}>
              {spaces.length === 0 ? 'Create your first virtual space' : `${spaces.length} space${spaces.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button id="join-space-btn" className="btn btn-secondary" onClick={() => setJoinOpen(true)}>
              🔗 Join by ID
            </button>
            <button id="create-space-btn" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              + New Space
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {spaces.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40,
          }}>
            {[
              { label: 'Total Spaces', value: spaces.length, icon: '🗺️' },
              { label: 'Largest Space', value: spaces.reduce((a, s) => { const [w, h] = s.dimensions.split('x').map(Number); return (w*h) > a ? w*h : a; }, 0) + ' tiles', icon: '📐' },
              { label: 'Status', value: 'All Active', icon: '✅' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 28 }}>{stat.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{stat.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Spaces grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <Spinner size={36} />
          </div>
        ) : spaces.length === 0 ? (
          <EmptyState
            icon="🌐"
            title="No spaces yet"
            subtitle="Create your first virtual space and invite people to explore it."
            action={
              <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                + Create Your First Space
              </button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {spaces.map((space, i) => (
              <div key={space.id} className="card" style={{
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                border: '1px solid var(--border-light)',
              }}>
                {/* Gradient header */}
                <div style={{
                  height: 100, borderRadius: '10px 10px 0 0',
                  background: getSpaceGradient(i),
                  margin: '-24px -24px 20px -24px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, border: 'none',
                  borderBottom: '1px solid var(--border-light)',
                }}>
                  {getSpaceEmoji(i)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{space.name}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="badge badge-purple">📐 {space.dimensions}</span>
                    </div>
                  </div>
                </div>

                {/* Space ID row */}
                <div style={{
                  marginTop: 14, padding: '8px 10px',
                  background: 'var(--bg-3)', borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {space.id}
                  </span>
                  <button
                    id={`copy-id-${space.id}`}
                    onClick={() => copySpaceId(space.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-2)', fontSize: 14, padding: '2px 6px',
                      borderRadius: 4, flexShrink: 0, transition: 'all 0.15s',
                    }}
                    title="Copy Space ID to share"
                  >📋</button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    id={`enter-space-${space.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => onEnterSpace(space.id)}
                  >
                    🚀 Enter Space
                  </button>
                  <button
                    id={`delete-space-${space.id}`}
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(space.id, space.name)}
                    disabled={deleting === space.id}
                  >
                    {deleting === space.id ? <Spinner size={14} /> : '🗑'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Space Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create New Space">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <InputField
            id="space-name" label="Space Name" placeholder="e.g. Team HQ, Dev Room…"
            value={spaceName} onChange={setSpaceName} required
          />
          <div>
            <label className="input-label">Dimensions (Width × Height)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DIMENSIONS.map(d => (
                <button
                  key={d} type="button" onClick={() => setDimensions(d)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius)',
                    border: `1px solid ${dimensions === d ? 'var(--brand-2)' : 'var(--border-light)'}`,
                    background: dimensions === d ? 'rgba(124,58,237,0.2)' : 'var(--bg-3)',
                    color: dimensions === d ? 'var(--brand-3)' : 'var(--text-2)',
                    cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button id="confirm-create-space" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating}>
              {creating ? <><Spinner /> Creating…</> : '✓ Create Space'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Join by Space ID Modal */}
      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a Space">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            Ask the space owner to share their <strong style={{ color: 'var(--text-1)' }}>Space ID</strong> (the 📋 button on their space card).
            Paste it below to jump in.
          </p>
          <InputField
            id="join-space-id"
            label="Space ID"
            placeholder="cmq8tg8gd00004b9b2vcwmox4…"
            value={joinId}
            onChange={setJoinId}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setJoinOpen(false)}>Cancel</button>
            <button id="confirm-join-space" className="btn btn-primary" style={{ flex: 1 }} onClick={handleJoinById}>
              🚀 Join Space
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
