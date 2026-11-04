// services/aiTodoEngine.js
// Rule engine cho "AI ToDo" (bản JS của summarize_ads.py + generate_todos.py).
// Hàm thuần, không đụng DB: dùng được trong service, trong test và trong script.
//
//   const summary = summarize(utd, breakdowns, taken)
//   const out = generateTodos(summary, existingTodos, '2026-11-05')
//   -> { status: 'ok' | 'skip', reason, scores, todos: [...] }   (todos đúng schema dashboard)

export const RULES = { target_roas: 4, min_spend_before_cut: 5, retry_roas: 1.5, currency: 'SGD' };
export const STALL_RATIO = 0.25; // giống buildActions() trên dashboard
const MAX_ITEMS = 3;
const MIN_SCORE = 10; // việc thứ 2, 3 chỉ thêm nếu ảnh hưởng >= ~S$10

const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const ms = (s) => Date.parse(String(s).slice(0, 10) + 'T00:00:00Z');
const r2 = (x) => Math.round(x * 100) / 100;

const status = (st) => (!st ? 'Unknown' : st === 'ACTIVE' ? 'Active' : st.includes('PAUSED') || st === 'ARCHIVED' ? 'Paused' : 'Issue');

function agg(rows) {
  const s = { spend: 0, impressions: 0, inline_link_clicks: 0, landing_page_view: 0, initiate_checkout: 0, purchase: 0, purchase_value: 0 };
  for (const r of rows) for (const k in s) s[k] += Number(r[k]) || 0;
  const sp = s.spend, pu = s.purchase;
  return {
    spend: r2(sp), value: r2(s.purchase_value), purchases: Math.trunc(pu),
    roas: sp ? r2(s.purchase_value / sp) : null, cpa: pu ? r2(sp / pu) : null,
    ctr_pct: s.impressions ? r2((100 * s.inline_link_clicks) / s.impressions) : null,
    link_clicks: Math.trunc(s.inline_link_clicks), lpv: Math.trunc(s.landing_page_view), checkouts: Math.trunc(s.initiate_checkout),
  };
}

function group(rows, keyFn, win, stKey) {
  const g = new Map();
  for (const r of rows) { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  const out = [];
  for (const [name, rs] of g) {
    const a = agg(rs.filter((r) => inWin(r, win)));
    if (stKey) a.status_now = status(rs.reduce((m, r) => (r.date_start > m.date_start ? r : m))[stKey]);
    a.name = name;
    out.push(a);
  }
  return out.sort((a, b) => b.spend - a.spend);
}
const inWin = (r, w) => { const t = ms(r.date_start); return t >= w[0] && t <= w[1]; };

/** Tổng hợp dữ liệu (tương đương summarize_ads.py). utd/breakdowns: đúng format GET /ads-boosting. */
export function summarize(utd, breakdowns = [], taken = '') {
  if (!utd?.length) return null;
  const last = Math.max(...utd.map((r) => ms(r.date_start)));
  const fetched = utd.reduce((m, r) => ((r.status_fetched_at || '') > m ? r.status_fetched_at : m), '').slice(0, 10);
  const win = (n, back = 0) => { const end = last - n * back * DAY; return [end - (n - 1) * DAY, end]; };
  const W7 = win(7), P7 = win(7, 1), W3 = win(3), ALL = [-Infinity, Infinity];

  const daily = {};
  for (const r of utd) daily[r.date_start.slice(0, 10)] = (daily[r.date_start.slice(0, 10)] || 0) + (Number(r.spend) || 0);
  const days = Object.keys(daily).sort().slice(-10);

  const out = {
    data_as_of: taken, last_data_day: iso(last), day_in_progress: fetched,
    campaigns: [...new Set(utd.map((r) => r.campaign_name))].sort(),
    ad_account_id: (utd.find((r) => r.ad_account_id) || {}).ad_account_id || '',
    window_7d: [iso(W7[0]), iso(W7[1])],
    kpi_7d: agg(utd.filter((r) => inWin(r, W7))), kpi_prev_7d: agg(utd.filter((r) => inWin(r, P7))),
    kpi_3d: agg(utd.filter((r) => inWin(r, W3))), kpi_since_launch: agg(utd),
    daily_spend_last_10: Object.fromEntries(days.map((d) => [d, r2(daily[d])])),
    adsets_7d: group(utd, (r) => r.adset_name, W7, 'adset_effective_status'),
    adsets_since_launch: group(utd, (r) => r.adset_name, ALL, 'adset_effective_status'),
    ads_7d: group(utd, (r) => r.ad_name + '\u0000' + r.adset_name, W7, 'ad_effective_status')
      .filter((a) => a.spend > 0)
      .map((a) => { const [name, adset] = a.name.split('\u0000'); return { ...a, name, adset }; }),
    rules: RULES,
  };
  for (const tab of ['placement', 'age', 'gender']) {
    const rows = breakdowns.filter((r) => r.tab === tab);
    if (!rows.length) continue;
    out[`${tab}_7d`] = group(rows, (r) => r.segment, W7).filter((a) => a.spend > 0);
    out[`${tab}_data_spend_7d`] = r2(out[`${tab}_7d`].reduce((s, a) => s + a.spend, 0));
  }
  return out;
}

const m = (v) => 'S$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const x = (r) => (r == null ? 'n/a' : r.toFixed(2) + 'x');
const pl = (n) => `${n} purchase${n === 1 ? '' : 's'}`;

/** Sinh 1-3 ToDo (tương đương generate_todos.py). existing: các ToDo đang có (mọi ngày). */
export function generateTodos(S, existing = [], D, now = new Date()) {
  const done = (o) => ({ status: o.status, reason: o.reason, scores: o.scores || [], todos: o.todos || [] });
  if (existing.some((r) => r.date === D)) return done({ status: 'skip', reason: `ToDos for ${D} already exist` });
  if (!S?.adsets_7d?.length) return done({ status: 'skip', reason: 'no ad data in summary' });

  const { target_roas: TARGET, min_spend_before_cut: CUT, retry_roas: RETRY } = S.rules;
  const CAMPAIGN = S.campaigns.join(', ');
  const openRows = existing.filter((r) => !r.done);
  const openKeys = new Set(openRows.map((r) => r.kind + '|' + r.target));
  const openTargets = new Set(openRows.map((r) => r.target));
  const openVerbs = openRows.map((r) => (r.verb || '').toLowerCase()).join(' ');
  const doneRows = new Map(existing.filter((r) => r.done).map((r) => [r.kind + '|' + r.target, r]));

  const since = new Map(S.adsets_since_launch.map((a) => [a.name, a]));
  const adsBySet = new Map();
  for (const a of S.ads_7d) { if (!adsBySet.has(a.adset)) adsBySet.set(a.adset, []); adsBySet.get(a.adset).push(a); }
  const complete = Object.entries(S.daily_spend_last_10).sort().filter(([d]) => d !== S.day_in_progress);
  let lastDay = null, lastSp = 0, avg = 0, prevN = 0;
  if (complete.length >= 5) {
    [lastDay, lastSp] = complete[complete.length - 1];
    const prev = complete.slice(-8, -1).map(([, v]) => v); prevN = prev.length;
    avg = prev.reduce((s, v) => s + v, 0) / prevN;
  }
  const STALLED = avg > 0 && lastSp < STALL_RATIO * avg;

  const cands = [];
  const add = (score, kind, verb, level, target, why, steps, impact, conf, adset = '') =>
    cands.push({ score: r2(score), kind, verb, level, target, adset, why, steps, expected_impact: impact, confidence: conf });

  // 1. FIX: ad set Active nhưng mọi ad đều kẹt duyệt / lỗi
  for (const a of S.adsets_7d) {
    const ads = adsBySet.get(a.name) || [];
    if (a.status_now === 'Active' && ads.length && ads.every((ad) => ad.status_now === 'Issue')) {
      const best = ads.reduce((b, ad) => ((ad.roas || 0) > (b.roas || 0) || ((ad.roas || 0) === (b.roas || 0) && ad.spend > b.spend) ? ad : b));
      const sl = since.get(a.name) || a;
      add(2 * Math.max(a.value, sl.value / 4, 10), 'fix', 'Unstick ad review', 'Ad set', a.name,
        `This Active ad set (${x(a.roas)} ROAS in 7 days, ${m(a.spend)} for ${pl(a.purchases)}; ${m(sl.spend)} and ${sl.purchases} purchases since launch) has none of its ${ads.length} ads delivering normally (stuck in review or with issues), so it barely spends.`,
        [`In Ads Manager open the ads (${ads.map((ad) => ad.name).join(', ')}) and read the delivery/review status.`,
          `If still 'In process' or 'In review', duplicate ${best.name} (best ad, ${x(best.roas)}) into the same ad set and publish without edits.`,
          "If any ad is rejected or 'With issues', fix the flagged item or request review.",
          'Check tomorrow that the ad set spends again.'],
        'Restores delivery on an audience that has converted; volumes are small, so treat the gain as indicative.', 'medium');
    }
  }

  // 2. FIX: cả tài khoản gần như ngừng chi
  if (STALLED && !openVerbs.includes('delivery')) {
    add(avg * (S.kpi_7d.roas || 0) * 0.5, 'fix', 'Restart delivery', 'Account', S.ad_account_id || CAMPAIGN,
      `Spend fell to ${m(lastSp)} on ${lastDay} vs a ${m(avg)}/day average over the previous ${prevN} days, while the account is at ${x(S.kpi_7d.roas)} ROAS over 7 days.`,
      ['Check the account spending limit, payment method and any billing alert.',
        'Check each Active ad set for schedule end dates, budget or bid caps, and ads stuck in review.',
        'If nothing blocks it, raise the daily budget of the best Active ad set by about 20%.'],
      'Returning to the normal spend level should restore most of the recent purchase volume.', 'medium');
  }

  // 3. PAUSE: ad set Active quá ngưỡng cắt mà 0 purchase
  for (const a of S.adsets_since_launch) {
    if (a.status_now === 'Active' && a.spend >= CUT && a.purchases === 0) {
      add(a.spend, 'pause', 'Pause ad set', 'Ad set', a.name,
        `Active with ${m(a.spend)} spent since launch and 0 purchases, past the ${m(CUT)} cut rule.`,
        ['Pause the ad set in Ads Manager.', 'Move its budget to the best Active ad set.'],
        `Stops about ${m(a.spend)} of spend that has not produced a purchase.`, 'high');
    }
  }

  // 4. PAUSE: ad Active quá ngưỡng cắt mà 0 purchase
  for (const ad of S.ads_7d) {
    if (ad.status_now === 'Active' && ad.spend >= CUT && ad.purchases === 0) {
      add(ad.spend * 0.8, 'pause', 'Pause ad', 'Ad', ad.name,
        `Active ad with ${m(ad.spend)} spent in 7 days and 0 purchases (CTR ${ad.ctr_pct}%).`,
        [`In ad set ${ad.adset}, turn this ad off.`, "Keep the ad set's converting ads running."],
        "Shifts the ad set's budget to creatives that have converted.", 'medium', ad.adset);
    }
  }

  // 5. PAUSE: placement tốn tiền mà 0 purchase
  const pls = S.placement_7d || [], tot = S.placement_data_spend_7d || 0;
  const bestPl = pls.length ? pls.reduce((b, p) => (p.value > b.value ? p : b)) : null;
  const waste = pls.filter((p) => p.purchases === 0 && p.spend >= Math.max(CUT, 0.1 * tot));
  if (waste.length && bestPl) {
    const p = waste.reduce((b, q) => (q.spend > b.spend ? q : b));
    const others = pls.filter((q) => q.purchases === 0 && q !== p && q.spend >= CUT).map((q) => q.name);
    add(p.spend, 'pause', 'Exclude placement', 'Placement', p.name,
      `${p.name} took ${m(p.spend)} (${Math.round((100 * p.spend) / tot)}% of 7-day spend) with 0 purchases, while ${bestPl.name} returned ${x(bestPl.roas)} (${bestPl.purchases} purchases on ${m(bestPl.spend)}).` +
        (others.length ? ` Also 0 purchases: ${others.join(', ')}.` : ''),
      ['In each Active ad set, switch to manual placements.', `Untick ${p.name}.`,
        `Keep ${bestPl.name}; drop any other placement after another ${m(CUT)} with no purchase.`],
      `Moves about ${m(p.spend)} a week toward placements that convert; reach may drop slightly.`, 'medium');
  }

  // 6. SCALE: ad set Active vượt mục tiêu, >= 2 purchase, tài khoản không bị ngừng chi
  for (const a of S.adsets_7d) {
    const ads = adsBySet.get(a.name) || [{ status_now: 'x' }];
    if (!STALLED && a.status_now === 'Active' && (a.roas || 0) >= TARGET && a.purchases >= 2 && !ads.every((ad) => ad.status_now === 'Issue')) {
      add(a.value * 0.3, 'scale', 'Raise budget', 'Ad set', a.name,
        `${x(a.roas)} ROAS over 7 days (${a.purchases} purchases, ${m(a.value)} on ${m(a.spend)}), above the ${TARGET}x target.`,
        ['Raise the daily budget by about 20% (not more, to avoid resetting learning).', `Re-check in 3 days; roll back if ROAS falls under ${TARGET}x.`],
        'More spend on a proven audience; returns usually fall a little as budget rises.', 'medium');
    }
  }

  // 7. REOPEN / 8. RETRY: ad set Paused đã có purchase
  for (const a of S.adsets_since_launch) {
    if (a.status_now !== 'Paused' || a.purchases < 1 || a.roas == null) continue;
    const ads = (adsBySet.get(a.name) || []).filter((ad) => ad.purchases > 0).sort((p, q) => (q.roas || 0) - (p.roas || 0));
    const keep = ads.map((ad) => ad.name).join(', ') || 'the ads that had purchases';
    if (a.roas >= TARGET) {
      add(a.value * 0.5 + a.roas * 0.1, 'reopen', 'Reopen winner', 'Ad set', a.name,
        `Paused at ${x(a.roas)} ROAS (${m(a.spend)} spend, ${pl(a.purchases)} worth ${m(a.value)}), above the ${TARGET}x target.` +
          (a.purchases === 1 ? ' With 1 purchase it needs a proper test.' : ''),
        ['Turn the ad set back on with a small daily budget (about S$5).', `Keep only ${keep} active.`,
          `Review after S$15 more spend: keep if ROAS stays above ${TARGET}x, pause if 0 purchases.`],
        'Adds spend on an audience that has beaten target; thin evidence, so treat as a test.', 'medium');
    } else if (a.roas >= RETRY) {
      add(a.value * 0.25, 'retry', 'Retry new creative', 'Ad set', a.name,
        `Paused at ${x(a.roas)} ROAS (${pl(a.purchases)} on ${m(a.spend)}): converts, but below the ${TARGET}x target.`,
        ['Duplicate the ad set with a fresh creative (new image or hook).', 'Run at about S$5/day.', `Cut after ${m(CUT)} with no purchase.`],
        'A new creative may lift this audience above target; uncertain.', 'low');
    }
  }

  // Lọc trùng, mỗi kind 1 việc (trừ fix), xếp hạng
  const picked = [], seenKind = new Map();
  for (const c of [...cands].sort((a, b) => b.score - a.score)) {
    const key = c.kind + '|' + c.target;
    if (openKeys.has(key) || openTargets.has(c.target) || picked.some((p) => p.target === c.target)) continue;
    if (doneRows.has(key)) {
      const dr = doneRows.get(key);
      c.why += ` Back again after it was ticked done on ${String(dr.done_at || dr.date || '').slice(0, 10)}.`;
    }
    if (seenKind.has(c.kind) && c.kind !== 'fix') {
      const p = seenKind.get(c.kind);
      if (p.steps.length < 4) p.steps.push(`Optional next: same for '${c.target}'.`);
      continue;
    }
    if (picked.length && c.score < MIN_SCORE) continue;
    seenKind.set(c.kind, c);
    picked.push(c);
    if (picked.length === MAX_ITEMS) break;
  }

  const generated_at = new Date(now.getTime() + 8 * 36e5).toISOString().slice(0, 19) + '+08:00';
  const todos = picked.map((c, i) => ({
    schema: 1, date: D, rank: i + 1, generated_at, data_as_of: S.data_as_of, generated_by: 'Rule engine',
    kind: c.kind, verb: c.verb, level: c.level, target: c.target, campaign: CAMPAIGN, adset: c.adset,
    why: c.why, steps: c.steps, expected_impact: c.expected_impact, confidence: c.confidence,
    done: false, done_at: null, done_by: null,
  }));
  return done({ status: todos.length ? 'ok' : 'skip', reason: `${todos.length} todo(s) from ${cands.length} candidate(s)`, scores: picked.map((c) => c.score), todos });
}

/** Ngày hôm nay theo giờ Singapore, dạng YYYY-MM-DD. */
export const todaySGT = (now = new Date()) => new Date(now.getTime() + 8 * 36e5).toISOString().slice(0, 10);
