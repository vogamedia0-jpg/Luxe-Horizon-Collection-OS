import { onRequest } from '../functions/api/[[path]].js';

function cleanUrl(value = '') {
  return String(value).replace(/\/$/, '');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function createCollection(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);

  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !secret) return json({ error: 'Supabase server configuration is missing.' }, 503);

  const token = auth.slice(7).trim();
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: secret, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return json({ error: 'Invalid or expired admin session.' }, 401);

  const input = await request.json();
  const name = String(input?.name || '').trim();
  const slug = String(input?.slug || '').trim();
  if (!name || !slug) return json({ error: 'Collection name and slug are required.' }, 400);

  // The original Supabase table was created with start/end date fields.
  // They are operationally unused by the app, but some existing schemas require values.
  // Use today's date only as a compatibility value; publishing remains fully manual.
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    name,
    slug,
    start_date: input.startDate || today,
    end_date: input.endDate || today,
    is_published: false,
    published_at: null,
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/collections`, {
    method: 'POST',
    headers: {
      apikey: secret,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Collection creation failed:', detail);
    return json({ error: detail || `Collection creation failed (${response.status}).` }, response.status);
  }

  const rows = await response.json();
  const row = rows?.[0];
  if (!row) return json({ error: 'Collection was not returned after creation.' }, 500);

  return json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/collections') {
      try {
        return await createCollection(request, env);
      } catch (error) {
        console.error('Collection creation error:', error);
        return json({ error: error instanceof Error ? error.message : 'Collection creation failed.' }, 500);
      }
    }
    return onRequest({ request, env });
  },
};
