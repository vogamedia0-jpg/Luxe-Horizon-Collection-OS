import { onRequest } from '../functions/api/[[path]].js';

function cleanUrl(value = '') { return String(value).replace(/\/$/, ''); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }); }
function enc(value) { return encodeURIComponent(String(value)); }

const categoryValues = new Set(['clothing','footwear','watches','bags','accessories','eyewear','jewellery','wallets','belts','hats','scarves','other']);
const genderValues = new Set(['men','women','unknown']);
function cleanCategory(value) { const item = String(value || 'other').trim().toLowerCase(); return categoryValues.has(item) ? item : 'other'; }
function cleanGender(value) { const item = String(value || 'unknown').trim().toLowerCase(); return genderValues.has(item) ? item : 'unknown'; }
function friendlyError(error) {
  let message = error instanceof Error ? error.message : 'Request failed.';
  for (let i = 0; i < 2; i += 1) {
    try {
      const parsed = JSON.parse(message);
      message = parsed.error || parsed.message || parsed.details || message;
    } catch {
      break;
    }
  }
  if (message.includes('products_category_check')) {
    return 'The Supabase category rule is still on the old list. Run the Luxe Horizon category migration once, then approve again.';
  }
  if (message.includes('check constraint')) return 'The database rejected this product update. Check brand, gender and category, then try again.';
  if (message.length > 180) return 'Server request failed. Refresh once and try again.';
  return message;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return { error: json({ error: 'Authentication required.' }, 401) };
  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !secret) return { error: json({ error: 'Supabase server configuration is missing.' }, 503) };
  const token = auth.slice(7).trim();
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: secret, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) return { error: json({ error: 'Invalid or expired admin session.' }, 401) };
  return { supabaseUrl, secret };
}

async function rest(cfg, path, init = {}) {
  const response = await fetch(`${cfg.supabaseUrl}${path}`, {
    ...init,
    headers: { apikey: cfg.secret, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(detail || `Supabase request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function createCollection(request, env) {
  const cfg = await requireAdmin(request, env); if (cfg.error) return cfg.error;
  const input = await request.json();
  const name = String(input?.name || '').trim(); const slug = String(input?.slug || '').trim();
  if (!name || !slug) return json({ error: 'Collection name and slug are required.' }, 400);
  const today = new Date().toISOString().slice(0, 10);
  const rows = await rest(cfg, '/rest/v1/collections', { method: 'POST', body: JSON.stringify({ name, slug, start_date: input.startDate || today, end_date: input.endDate || today, is_published: false, published_at: null }) });
  const row = rows?.[0]; if (!row) return json({ error: 'Collection was not returned after creation.' }, 500);
  return json({ id: row.id, name: row.name, slug: row.slug, startDate: row.start_date ?? null, endDate: row.end_date ?? null, isPublished: Boolean(row.is_published), publishedAt: row.published_at ?? null, createdAt: row.created_at, updatedAt: row.updated_at }, 201);
}

async function createProductWithImages(cfg, collectionId, gender, imagePaths) {
  const productRows = await rest(cfg, '/rest/v1/products', {
    method: 'POST',
    body: JSON.stringify({ collection_id: collectionId, gender: cleanGender(gender), category: 'other', brand: '', review_status: 'pending', is_active: true, is_published: false }),
  });
  const product = productRows?.[0]; if (!product?.id) throw new Error('Product was not returned after creation.');
  const imageRows = imagePaths.map((imagePath, index) => ({ product_id: product.id, image_path: imagePath, is_primary: index === 0, sort_order: index + 1 }));
  await rest(cfg, '/rest/v1/product_images', { method: 'POST', body: JSON.stringify(imageRows) });
  return { id: product.id };
}

async function uploadProducts(request, env, grouped) {
  const cfg = await requireAdmin(request, env); if (cfg.error) return cfg.error;
  const input = await request.json(); const collectionId = String(input?.collectionId || '');
  if (!collectionId) return json({ error: 'collectionId is required.' }, 400);
  const gender = cleanGender(input.batchHint === 'men' ? 'men' : input.batchHint === 'women' ? 'women' : 'unknown');
  const groups = grouped
    ? (Array.isArray(input?.groups) ? input.groups.map((g) => Array.isArray(g?.imagePaths) ? g.imagePaths.filter(Boolean) : []).filter((g) => g.length) : [])
    : (Array.isArray(input?.images) ? input.images.filter((i) => i?.imagePath).map((i) => [i.imagePath]) : []);
  if (!groups.length) return json({ error: 'Product images are required.' }, 400);

  const concurrency = 6;
  const created = [];
  for (let i = 0; i < groups.length; i += concurrency) {
    const batch = await Promise.all(groups.slice(i, i + concurrency).map((paths) => createProductWithImages(cfg, collectionId, gender, paths)));
    created.push(...batch);
  }
  return json(created, 201);
}

async function bulkUpdate(request, env) {
  const cfg = await requireAdmin(request, env); if (cfg.error) return cfg.error;
  const input = await request.json();
  const ids = Array.isArray(input?.ids) ? [...new Set(input.ids.map(String).filter(Boolean))] : [];
  if (!ids.length) return json({ error: 'Select at least one product.' }, 400);
  const allowed = ['gender','category','brand','reviewed','isPublished','isActive'];
  const patch = {};
  if ('gender' in input) patch.gender = cleanGender(input.gender);
  if ('category' in input) patch.category = cleanCategory(input.category);
  if ('brand' in input) patch.brand = String(input.brand || '').trim();
  if ('reviewed' in input) patch.review_status = input.reviewed ? 'reviewed' : 'pending';
  if ('isPublished' in input) patch.is_published = Boolean(input.isPublished);
  if ('isActive' in input) patch.is_active = Boolean(input.isActive);
  if (!Object.keys(patch).length) return json({ error: `No supported fields supplied (${allowed.join(', ')}).` }, 400);
  const rows = await rest(cfg, `/rest/v1/products?id=in.(${ids.map(enc).join(',')})`, { method: 'PATCH', body: JSON.stringify(patch) });
  return json({ updated: rows?.length || ids.length });
}

async function updateFlexible(request, env, productId) {
  const cfg = await requireAdmin(request, env); if (cfg.error) return cfg.error;
  const input = await request.json();
  const patch = {};
  if (typeof input.gender === 'string') patch.gender = cleanGender(input.gender);
  if (typeof input.category === 'string') patch.category = cleanCategory(input.category);
  if (typeof input.brand === 'string' || input.brand === null) patch.brand = String(input.brand || '').trim();
  if (typeof input.reviewed === 'boolean') patch.review_status = input.reviewed ? 'reviewed' : 'pending';
  if (typeof input.isActive === 'boolean') patch.is_active = input.isActive;
  if (typeof input.isPublished === 'boolean') patch.is_published = input.isPublished;
  if (typeof input.sortOrder === 'number') patch.sort_order = input.sortOrder;
  if (typeof input.collectionId === 'string') patch.collection_id = input.collectionId;
  if (!Object.keys(patch).length) return json({ error: 'No product changes were supplied.' }, 400);
  const rows = await rest(cfg, `/rest/v1/products?id=eq.${enc(productId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  return rows?.length ? json(rows[0]) : json({ error: 'Product not found.' }, 404);
}

async function approvePublishReady(request, env) {
  const cfg = await requireAdmin(request, env); if (cfg.error) return cfg.error;
  const input = await request.json();
  const collectionId = String(input?.collectionId || '');
  if (!collectionId) return json({ error: 'collectionId is required.' }, 400);
  const rows = await rest(cfg, `/rest/v1/products?collection_id=eq.${enc(collectionId)}&review_status=eq.reviewed&is_active=eq.true`);
  const ready = (rows || []).filter((p) => p.brand && p.gender !== 'unknown' && p.category !== 'other');
  if (!ready.length) return json({ updated: 0 });
  const ids = ready.map((p) => p.id);
  await rest(cfg, `/rest/v1/products?id=in.(${ids.map(enc).join(',')})`, { method: 'PATCH', body: JSON.stringify({ is_published: true }) });
  return json({ updated: ids.length });
}

async function mergeProducts(request, env) {
  const cfg = await requireAdmin(request, env); if (cfg.error) return cfg.error;
  const input = await request.json();
  const ids = Array.isArray(input?.productIds) ? [...new Set(input.productIds.map(String).filter(Boolean))] : [];
  if (ids.length < 2) return json({ error: 'Select at least two products to merge.' }, 400);
  const products = await rest(cfg, `/rest/v1/products?id=in.(${ids.map(enc).join(',')})`);
  if (!products || products.length !== ids.length) return json({ error: 'One or more products could not be found.' }, 404);
  const collectionIds = [...new Set(products.map((p) => p.collection_id))];
  if (collectionIds.length !== 1) return json({ error: 'Products must belong to the same collection.' }, 400);
  const targetId = String(input?.targetId || ids[0]);
  if (!ids.includes(targetId)) return json({ error: 'Invalid target product.' }, 400);
  const sourceIds = ids.filter((id) => id !== targetId);

  const existing = await rest(cfg, `/rest/v1/product_images?product_id=eq.${enc(targetId)}&order=sort_order.asc`);
  const moving = await rest(cfg, `/rest/v1/product_images?product_id=in.(${sourceIds.map(enc).join(',')})&order=sort_order.asc`);
  let sortOrder = existing?.length || 0;
  await Promise.all((moving || []).map((image) => {
    sortOrder += 1;
    return rest(cfg, `/rest/v1/product_images?id=eq.${enc(image.id)}`, { method: 'PATCH', body: JSON.stringify({ product_id: targetId, is_primary: false, sort_order: sortOrder }) });
  }));
  await rest(cfg, `/rest/v1/products?id=in.(${sourceIds.map(enc).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return json({ targetId, merged: ids.length, images: sortOrder });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/api/collections') return await createCollection(request, env);
      if (request.method === 'POST' && url.pathname === '/api/products/upload') return await uploadProducts(request, env, false);
      if (request.method === 'POST' && url.pathname === '/api/products/upload-grouped') return await uploadProducts(request, env, true);
      if (request.method === 'POST' && url.pathname === '/api/products/bulk-update') return await bulkUpdate(request, env);
      if (request.method === 'POST' && url.pathname === '/api/products/publish-ready') return await approvePublishReady(request, env);
      if (request.method === 'POST' && url.pathname === '/api/products/merge') return await mergeProducts(request, env);
      const flexibleMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/flexible$/);
      if (request.method === 'PATCH' && flexibleMatch) return await updateFlexible(request, env, decodeURIComponent(flexibleMatch[1]));
      return onRequest({ request, env });
    } catch (error) {
      console.error('Luxe Horizon Worker error:', error);
      return json({ error: friendlyError(error) }, Number(error?.status) || 500);
    }
  },
};
