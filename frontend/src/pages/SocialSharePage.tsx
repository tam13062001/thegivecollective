import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiClient } from '../api/client';
import SocialDashboardPage from './SocialDashboardPage';

const KEY = 'social_dashboard_share_token';
export default function SocialSharePage() {
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useCallback(() => {
    try { sessionStorage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
    setToken(''); setPassword('');
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let saved = '';
    try { saved = sessionStorage.getItem(KEY) || ''; } catch { /* Use in-memory session. */ }
    if (!saved) { setChecking(false); return () => controller.abort(); }
    apiClient.get('/social-share/session', { signal: controller.signal, headers: { Authorization: `Bearer ${saved}` } })
      .then(() => setToken(saved))
      .catch(() => { if (!controller.signal.aborted) lock(); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [lock]);
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post('/social-share/unlock', { password });
      if (typeof data.token !== 'string') throw new Error('Invalid session');
      try { sessionStorage.setItem(KEY, data.token); } catch { /* Use in-memory session. */ }
      setToken(data.token); setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to unlock. Please try again.');
    } finally { setBusy(false); }
  }
  if (checking) return <div className="flex min-h-screen items-center justify-center">Checking access…</div>;
  if (token) return <SocialDashboardPage token={token} onUnauthorized={lock} />;
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
    <form onSubmit={unlock} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div><p className="text-sm text-slate-500">The Give Collective</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Social Dashboard</h1></div>
      <p className="text-sm text-slate-500">Enter the sharing password to view this dashboard.</p>
      <label htmlFor="share-password" className="block text-sm font-medium text-slate-700">Password</label>
      <input id="share-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-slate-900" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-slate-900 p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Unlocking…' : 'View dashboard'}</button>
    </form>
  </main>;
}
