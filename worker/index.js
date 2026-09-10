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

async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return { error: json({ error: 'Authentication required.' }, 401) };

  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !secret) return { error: json({ error: 'Supabase server configuration is missing.' }, 503) };

  const token = auth.slice(7).trim();
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: secret, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return { error: json({ error: 'Invalid or expired admin session.' }, 401) };
  return { supabaseUrl, secret };
}

async function rest(envConfig, path, init = {}) {
  const response = await fetch(`${envConfig.supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: envConfig.secret,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
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
  const cfg = await requireAdmin(request, env);
  if (cfg.error) return cfg.error;

  const input = await request.json();
  const name = String(input?.name || '').trim();
  const slug = String(input?.slug || '').trim();
  if (!name || !slug) return json({ error: 'Collection name and slug are required.' }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const rows = await rest(cfg, '/rest/v1/collections', {
    method: 'POST',
    body: JSON.stringify({
      name,
      slug,
      start_date: input.startDate || today,
      end_date: input.endDate || today,
      is_published: false,
      published_at: null,
    }),
  });

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

async function createProductWithImages(cfg, collectionId, gender, imagePaths) {
  // Only use columns verified to exist in the live products table.
  const productRows = await rest(cfg, '/rest/v1/products', {
    method: 'POST',
    body: JSON.stringify({
      collection_id: collectionId,
      gender,
      category: 'other',
      brand: null,
    }),
  });

  const product = productRows?.[0];
  if (!product?.id) throw new Error('Product was not returned after creation.');

  const imageRows = imagePaths.map((imagePath, index) => ({
    product_id: product.id,
    image_path: imagePath,
    is_primary: index === 0,
    sort_order: index + 1,
  }));
  await rest(cfg, '/rest/v1/product_images', {
    method: 'POST',
    body: JSON.stringify(imageRows),
  });

  return {
    id: product.id,
    collectionId: product.collection_id,
    gender: String(product.gender || gender || 'unknown').toLowerCase(),
    category: String(product.category || 'other').toLowerCase(),
    brand: product.brand ?? null,
    aiGender: null,
    aiCategory: null,
    aiBrand: null,
    aiConfidence: null,
    reviewed: false,
    isActive: product.is_active !== false,
    isPublished: Boolean(product.is_published),
    sortOrder: product.sort_order ?? 0,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    images: imageRows.map((image, index) => ({
      id: `${product.id}-${index}`,
      imagePath: `/api/images/${String(image.image_path).split('/').map(encodeURIComponent).join('/')}`,
      isPrimary: image.is_primary,
      sortOrder: image.sort_order,
    })),
  };
}

async function uploadProducts(request, env, grouped) {
  const cfg = await requireAdmin(request, env);
  if (cfg.error) return cfg.error;

  const input = await request.json();
  const collectionId = String(input?.collectionId || '');
  if (!collectionId) return json({ error: 'collectionId is required.' }, 400);

  const gender = input.batchHint === 'men' ? 'men' : input.batchHint === 'women' ? 'women' : 'unknown';
  const created = [];

  if (grouped) {
    const groups = Array.isArray(input?.groups) ? input.groups : [];
    if (!groups.length) return json({ error: 'At least one image group is required.' }, 400);
    for (const group of groups) {
      const paths = Array.isArray(group?.imagePaths) ? group.imagePaths.filter(Boolean) : [];
      if (!paths.length) continue;
      created.push(await createProductWithImages(cfg, collectionId, gender, paths));
    }
  } else {
    const images = Array.isArray(input?.images) ? input.images : [];
    if (!images.length) return json({ error: 'Product images are required.' }, 400);
    for (const item of images) {
      if (!item?.imagePath) continue;
      created.push(await createProductWithImages(cfg, collectionId, gender, [item.imagePath]));
    }
  }

  return json(created, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/api/collections') {
        return await createCollection(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/products/upload') {
        return await uploadProducts(request, env, false);
      }
      if (request.method === 'POST' && url.pathname === '/api/products/upload-grouped') {
        return await uploadProducts(request, env, true);
      }
      return onRequest({ request, env });
    } catch (error) {
      console.error('Luxe Horizon Worker error:', error);
      return json({ error: error instanceof Error ? error.message : 'Request failed.' }, Number(error?.status) || 500);
    }
  },
};
