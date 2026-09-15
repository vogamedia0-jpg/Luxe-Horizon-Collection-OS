const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: jsonHeaders }); }
function cleanUrl(value = '') { return value.replace(/\/$/, ''); }
function encode(value) { return encodeURIComponent(String(value)); }

async function supabaseRequest(env, path, init = {}) {
  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !secret) throw Object.assign(new Error('Supabase server configuration is missing.'), { status: 503 });
  const headers = new Headers(init.headers || {});
  headers.set('apikey', secret);
  if (!headers.has('Prefer')) headers.set('Prefer', 'return=representation');
  const response = await fetch(`${supabaseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw Object.assign(new Error(await response.text() || `Supabase request failed (${response.status})`), { status: response.status });
  if (response.status === 204) return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const token = auth.slice(7).trim();
  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!token || !supabaseUrl || !secret) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: secret, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw Object.assign(new Error('Invalid or expired admin session.'), { status: 401 });
  return response.json();
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
function countryLabel(code) { if (!code) return 'Unknown'; try { return countryNames.of(code) || code; } catch { return code; } }

async function getAnalytics(env) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseRequest(env, `/rest/v1/site_visits?created_at=gte.${encode(since)}&order=created_at.desc&limit=10000`) || [];
  const visits = rows.filter((row) => row.event_type === 'site_visit');
  const uniqueVisitors = new Set(visits.map((row) => row.visitor_id).filter(Boolean));
  const engagedEvents = rows.filter((row) => row.event_type === 'engaged_visit');
  const productViewEvents = rows.filter((row) => row.event_type === 'product_view');
  const whatsappEvents = rows.filter((row) => row.event_type === 'whatsapp_click');
  const engagedVisitors = new Set(engagedEvents.map((row) => row.visitor_id).filter(Boolean));
  const browsedVisitors = new Set(productViewEvents.map((row) => row.visitor_id).filter(Boolean));
  const whatsappVisitors = new Set(whatsappEvents.map((row) => row.visitor_id).filter(Boolean));
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  const todayVisits = visits.filter((row) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date(row.created_at)) === todayKey);

  const countryMap = new Map();
  for (const row of visits) {
    if (!row.visitor_id) continue;
    const key = `${row.visitor_id}|${row.country || 'XX'}`;
    if (!countryMap.has(key)) countryMap.set(key, row);
  }
  const countries = new Map();
  for (const row of countryMap.values()) {
    const code = row.country || 'XX';
    const current = countries.get(code) || { code, country: countryLabel(code === 'XX' ? null : code), visitors: 0 };
    current.visitors += 1;
    countries.set(code, current);
  }

  const cityMap = new Map();
  for (const row of visits) {
    if (!row.visitor_id) continue;
    const key = `${row.visitor_id}|${row.country || 'XX'}|${row.city || 'Unknown'}`;
    if (!cityMap.has(key)) cityMap.set(key, row);
  }
  const cities = new Map();
  for (const row of cityMap.values()) {
    const key = `${row.country || 'XX'}|${row.city || 'Unknown'}`;
    const current = cities.get(key) || { countryCode: row.country || null, country: countryLabel(row.country), city: row.city || 'Unknown', visitors: 0 };
    current.visitors += 1;
    cities.set(key, current);
  }

  const refs = {};
  for (const row of visits) { const key = row.ref || 'direct'; refs[key] = (refs[key] || 0) + 1; }
  const durations = engagedEvents.map((row) => Number(row.duration_seconds)).filter((value) => Number.isFinite(value) && value > 0);
  const avgEngagementSeconds = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const bouncedVisitors = Math.max(0, uniqueVisitors.size - browsedVisitors.size - whatsappVisitors.size);
  const recent = rows.slice(0, 40).map((row) => ({
    createdAt: row.created_at,
    eventType: row.event_type,
    ref: row.ref || 'direct',
    path: row.path || '/',
    countryCode: row.country || null,
    country: countryLabel(row.country),
    city: row.city || null,
    productId: row.product_id || null,
    durationSeconds: row.duration_seconds || null,
    scrollDepth: row.scroll_depth || null,
  }));

  return {
    periodDays: 30,
    totalVisits: visits.length,
    uniqueVisitors: uniqueVisitors.size,
    todayVisits: todayVisits.length,
    browsedVisitors: browsedVisitors.size,
    engagedVisitors: engagedVisitors.size,
    bouncedVisitors,
    productViews: productViewEvents.length,
    whatsappClicks: whatsappEvents.length,
    whatsappVisitors: whatsappVisitors.size,
    avgEngagementSeconds,
    countries: [...countries.values()].sort((a, b) => b.visitors - a.visitors),
    cities: [...cities.values()].sort((a, b) => b.visitors - a.visitors).slice(0, 30),
    refs: Object.entries(refs).sort((a, b) => b[1] - a[1]).map(([ref, count]) => ({ ref, count })),
    recent,
  };
}

export async function onRequestGet(context) {
  try {
    await requireAdmin(context.request, context.env);
    return json(await getAnalytics(context.env));
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json({ error: status >= 500 ? 'Server request failed.' : error?.message || 'Request failed.' }, status);
  }
}
