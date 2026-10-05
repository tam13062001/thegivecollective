import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient, API_BASE_URL } from '../api/client';
import { GrowthChart } from '../components/GrowthChart';
import { DemographicsCard } from '../components/insights/DemographicsCard';
import { TopPostsCard } from '../components/insights/TopPostsCard';
import { normalizePosts } from '../utils/insights';
import type { Post, DemographicRow } from '../types/insights';

export default function SocialDashboardPage({ token, onUnauthorized }: {
  token?: string;
  onUnauthorized?: () => void;
}) {
  const shared = Boolean(token);
  const [posts, setPosts] = useState<Post[]>([]);
  const [demographics, setDemographics] = useState<DemographicRow[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(true);
  const [postError, setPostError] = useState(false);
  const [demoError, setDemoError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const shareUrl = `${window.location.origin}/share/social-dashboard`;

  useEffect(() => {
    const controller = new AbortController();
    const config = { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} };
    setLoadingPosts(true); setLoadingDemo(true); setPostError(false); setDemoError(false);
    const checkAuth = (error: any) => { if (error.response?.status === 401) onUnauthorized?.(); };
    apiClient.get(shared ? '/social-share/top-posts' : '/insights/all-posts', config)
      .then(({ data }) => {
        const normalized = normalizePosts(data);
        // Same ranking as the share API: views, likes, shares, then stable ID.
        const ranked = ['instagram', 'facebook', 'tiktok'].flatMap(platform => normalized
          .filter(post => post.platform.toLowerCase() === platform)
          .sort((a, b) => b.views - a.views || b.likes - a.likes || b.shares - a.shares || String(a.id).localeCompare(String(b.id)))
          .slice(0, 10));
        setPosts(ranked);
      }).catch(error => { if (!controller.signal.aborted) { checkAuth(error); setPostError(true); setPosts([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoadingPosts(false); });
    apiClient.get(shared ? '/social-share/demographics' : '/insights/demographics', config)
      .then(({ data }) => { if (!Array.isArray(data)) throw new Error('Invalid audience'); setDemographics(data); })
      .catch(error => { if (!controller.signal.aborted) { checkAuth(error); setDemoError(true); setDemographics([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoadingDemo(false); });
    return () => controller.abort();
  }, [token, shared, onUnauthorized, retry]);

  async function copyLink() {
    setShowShare(true);
    try { await navigator.clipboard.writeText(shareUrl); toast.success('Share link copied'); }
    catch { toast.info('Select and copy the link below.'); }
  }

  return (
    <main className={`signal-atlas min-h-screen bg-signal-ink pb-16 font-signal-body text-signal-text ${shared ? '' : 'mt-16'}`}>
      <div className="mx-auto max-w-[1640px] space-y-8 px-4 py-10 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-signal-muted">The Give Collective</p><h1 className="text-3xl font-bold">Social Dashboard</h1></div>
          {shared ? <button type="button" onClick={onUnauthorized} className="rounded-lg border border-signal-border px-4 py-2">Lock dashboard</button>
            : <button type="button" onClick={copyLink} className="rounded-lg bg-signal-cyan px-4 py-2 font-semibold text-signal-ink">Share dashboard</button>}
        </header>
        {showShare && !shared && <div className="space-y-2 rounded-xl border border-signal-border p-4">
          <label htmlFor="social-share-link" className="block text-sm">Share this password-protected link</label>
          <input id="social-share-link" readOnly value={shareUrl} onFocus={e => e.target.select()} className="w-full rounded-lg border border-signal-border bg-signal-surface p-3 text-sm" />
          <p className="text-sm text-signal-muted">Recipients can view only Social Dashboard. Send the sharing password separately.</p>
        </div>}
        <div className="rounded-2xl bg-slate-50 p-4 sm:p-6">
          <GrowthChart apiUrl={shared ? `${API_BASE_URL}/social-share/history` : undefined} token={token} onUnauthorized={onUnauthorized} />
        </div>
        <p className="text-sm text-signal-muted">Top 10 posts per platform · Instagram, Facebook and TikTok · Ranked by views (all time). Audience data: Instagram.</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {demoError || (!loadingDemo && demographics.length === 0) ? <div className="signal-panel rounded-2xl border border-signal-border p-6 lg:col-span-5">
            <h2 className="font-semibold">Audience snapshot · Instagram</h2>
            <p className="my-3 text-sm text-signal-muted">{demoError ? 'Audience data is temporarily unavailable.' : 'No audience data available.'}</p>
            <button onClick={() => setRetry(v => v + 1)} className="text-sm underline">Try again</button>
          </div> : <DemographicsCard demographics={demographics} loading={loadingDemo} error={false} showInsight={false} />}
          <TopPostsCard posts={posts} loading={loadingPosts} error={postError} onRetry={() => setRetry(v => v + 1)} limit={10} />
        </div>
      </div>
    </main>
  );
}
