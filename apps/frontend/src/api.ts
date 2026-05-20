// API + WS configuration
export const API_URL = import.meta.env.VITE_HTTP_URL ?? 'http://localhost:3000/api/v1';
export const WS_URL  = import.meta.env.VITE_WS_URL  ?? 'ws://localhost:3001';

// ─── API helpers ──────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const signup = (username: string, password: string, type: 'user' | 'admin') =>
  request<{ userId: string }>('/signup', {
    method: 'POST',
    body: JSON.stringify({ username, password, type }),
  });

export const signin = (username: string, password: string) =>
  request<{ token: string }>('/signin', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

// ─── Spaces ───────────────────────────────────────────────────────────────────

export const createSpace = (name: string, dimensions: string, token: string) =>
  request<{ spaceId: string }>('/space', {
    method: 'POST',
    body: JSON.stringify({ name, dimensions }),
  }, token);

export const getAllSpaces = (token: string) =>
  request<{ spaces: Space[] }>('/space/all', {}, token);

export const deleteSpace = (spaceId: string, token: string) =>
  request<{ message: string }>(`/space/${spaceId}`, { method: 'DELETE' }, token);

export const getSpace = (spaceId: string) =>
  request<{ dimensions: string; elements: any[] }>(`/space/${spaceId}`);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Space {
  id: string;
  name: string;
  dimensions: string;
  thumbnail?: string;
}
