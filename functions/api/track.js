const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function cleanUrl(value = '') { return value.replace(/\/$/, ''); }

async function supabaseRequest(env, path, init = {}) {
  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !secret) throw new Error('Supabase server configuration is missing.');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', secret);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!headers.has('Prefer')) headers.set('Prefer', 'return=representation');
  const response = await fetch(`${supabaseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(await response.text() || `Supabase request failed (${response.status})`);
  if (response.status === 204) return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

export async function onRequestPost(context) {
  try {
    const input = await context.request.json();
    const visitorId = String(input?.visitorId || '').trim().slice(0, 120);
    const sessionId = String(input?.sessionId || '').trim().slice(0, 120) || null;
    const eventType = String(input?.eventType || 'site_visit').trim().slice(0, 40);
    const path = String(input?.path || '/').slice(0, 500);
    const ref = input?.ref ? String(input.ref).slice(0, 120) : null;
    const productId = input?.productId ? String(input.productId).slice(0, 120) : null;
    const durationSeconds = Number.isFinite(Number(input?.durationSeconds)) ? Math.max(0, Math.min(86400, Math.round(Number(input.durationSeconds)))) : null;
    const scrollDepth = Number.isFinite(Number(input?.scrollDepth)) ? Math.max(0, Math.min(100, Math.round(Number(input.scrollDepth)))) : null;
    const allowed = ['site_visit', 'product_view', 'product_click', 'whatsapp_click', 'engaged_visit', 'scroll_depth', 'session_end'];
    if (!visitorId || !allowed.includes(eventType)) return json({ error: 'Invalid analytics event.' }, 400);

    const cf = context.request.cf || {};
    const country = cf.country ? String(cf.country).slice(0, 8) : null;
    const city = cf.city ? String(cf.city).slice(0, 120) : null;

    await supabaseRequest(context.env, '/rest/v1/site_visits', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        visitor_id: visitorId,
        session_id: sessionId,
        event_type: eventType,
        path,
        ref,
        product_id: productId,
        country,
        city,
        duration_seconds: durationSeconds,
        scroll_depth: scrollDepth,
      }),
    });
    return new Response(null, { status: 204 });
  } catch {
    // Analytics must never interfere with the public catalogue.
    return new Response(null, { status: 204 });
  }
}
