const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

function apiError(message, status = 500) {
  return json({ error: message }, status);
}

function cleanUrl(value = '') {
  return value.replace(/\/$/, '');
}

function encode(value) {
  return encodeURIComponent(String(value));
}

function imageUrl(path) {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith('/assets/')) return path;
  return `/api/images/${String(path).split('/').map(encodeURIComponent).join('/')}`;
}

function collectionFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function supabaseRequest(env, path, init = {}) {
  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !secret) {
    throw Object.assign(new Error('Supabase server configuration is missing.'), { status: 503 });
  }

  const headers = new Headers(init.headers || {});
  headers.set('apikey', secret);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!headers.has('Prefer')) headers.set('Prefer', 'return=representation');

  const response = await fetch(`${supabaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(text || `Supabase request failed (${response.status})`), { status: response.status });
  }

  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  return JSON.parse(text);
}

async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    throw Object.assign(new Error('Authentication required.'), { status: 401 });
  }

  const token = auth.slice(7).trim();
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });

  const supabaseUrl = cleanUrl(env.SUPABASE_URL || '');
  const secret = env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !secret) {
    throw Object.assign(new Error('Supabase server configuration is missing.'), { status: 503 });
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: secret,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw Object.assign(new Error('Invalid or expired admin session.'), { status: 401 });
  return response.json();
}

async function imagesForProducts(env, productIds) {
  const map = new Map();
  if (!productIds.length) return map;

  const ids = productIds.join(',');
  const rows = await supabaseRequest(
    env,
    `/rest/v1/product_images?product_id=in.(${encode(ids)})&order=sort_order.asc`,
  );

  for (const row of rows || []) {
    const storedPath = row.image_path ?? row.storage_path ?? '';
    const item = {
      id: row.id,
      imagePath: imageUrl(storedPath),
      isPrimary: Boolean(row.is_primary),
      sortOrder: row.sort_order ?? 0,
    };
    map.set(row.product_id, [...(map.get(row.product_id) || []), item]);
  }
  return map;
}

async function productsFromRows(env, rows) {
  const images = await imagesForProducts(env, (rows || []).map((row) => row.id));
  return (rows || []).map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    gender: String(row.gender || 'unknown').toLowerCase(),
    category: String(row.category || 'other').toLowerCase(),
    brand: row.brand ?? null,
    aiGender: row.ai_suggested_gender ?? null,
    aiCategory: row.ai_suggested_category ?? null,
    aiBrand: row.ai_suggested_brand ?? null,
    aiConfidence: row.ai_confidence ?? null,
    reviewed: row.review_status === 'reviewed' || row.review_status === 'approved',
    isActive: row.is_active !== false,
    isPublished: Boolean(row.is_published),
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images.get(row.id) || [],
  }));
}

async function currentCollection(env) {
  const rows = await supabaseRequest(
    env,
    '/rest/v1/collections?order=is_published.desc,published_at.desc,created_at.desc&limit=1',
  );
  return rows?.[0] || null;
}

async function getDashboard(env) {
  const collection = await currentCollection(env);
  if (!collection) {
    return {
      collection: null,
      totalUploaded: 0,
      men: 0,
      women: 0,
      unknown: 0,
      needsReview: 0,
      published: 0,
      categories: {},
    };
  }

  const rows = await supabaseRequest(
    env,
    `/rest/v1/products?collection_id=eq.${encode(collection.id)}&order=created_at.desc`,
  );
  const products = await productsFromRows(env, rows || []);
  const categories = {};
  for (const product of products) categories[product.category] = (categories[product.category] || 0) + 1;

  return {
    collection: collectionFromRow(collection),
    totalUploaded: products.length,
    men: products.filter((product) => product.gender === 'men').length,
    women: products.filter((product) => product.gender === 'women').length,
    unknown: products.filter((product) => product.gender !== 'men' && product.gender !== 'women').length,
    needsReview: products.filter((product) => !product.reviewed).length,
    published: products.filter((product) => product.isPublished && product.isActive).length,
    categories,
  };
}

async function getCatalogue(env) {
  const collections = await supabaseRequest(
    env,
    '/rest/v1/collections?is_published=eq.true&order=published_at.desc&limit=1',
  );
  const collection = collections?.[0];
  if (!collection) return { collection: null, products: [], availableBrands: [] };

  const rows = await supabaseRequest(
    env,
    `/rest/v1/products?collection_id=eq.${encode(collection.id)}&is_active=eq.true&is_published=eq.true&order=created_at.desc`,
  );
  const products = await productsFromRows(env, rows || []);
  products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const availableBrands = [...new Set(products.flatMap((product) => product.brand ? [product.brand] : []))]
    .sort((a, b) => a.localeCompare(b));
  return { collection: collectionFromRow(collection), products, availableBrands };
}

async function getPublicProduct(env, productId) {
  const rows = await supabaseRequest(
    env,
    `/rest/v1/products?id=eq.${encode(productId)}&is_active=eq.true&is_published=eq.true&limit=1`,
  );
  const row = rows?.[0];
  if (!row) return null;

  const collections = await supabaseRequest(
    env,
    `/rest/v1/collections?id=eq.${encode(row.collection_id)}&is_published=eq.true&limit=1`,
  );
  if (!collections?.length) return null;
  return (await productsFromRows(env, [row]))[0];
}

async function insertProduct(env, collectionId, gender) {
  const payload = {
    collection_id: collectionId,
    gender,
    category: 'other',
    brand: null,
    ai_suggested_gender: gender === 'unknown' ? null : gender,
    ai_suggested_category: 'other',
    review_status: 'pending',
    is_active: true,
    is_published: false,
  };
  const rows = await supabaseRequest(env, '/rest/v1/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return rows[0];
}

async function insertImages(env, productId, paths) {
  const rows = paths.map((path, index) => ({
    product_id: productId,
    image_path: path,
    is_primary: index === 0,
    sort_order: index + 1,
  }));
  return supabaseRequest(env, '/rest/v1/product_images', {
    method: 'POST',
    body: JSON.stringify(rows),
  });
}

async function deleteProduct(env, productId) {
  const imageRows = await supabaseRequest(
    env,
    `/rest/v1/product_images?product_id=eq.${encode(productId)}`,
  );
  const keys = (imageRows || [])
    .map((row) => row.image_path ?? row.storage_path)
    .filter((value) => value && !/^https?:\/\//i.test(value) && !String(value).startsWith('/assets/'));

  if (env.PRODUCT_IMAGES && keys.length) await env.PRODUCT_IMAGES.delete(keys);

  await supabaseRequest(env, `/rest/v1/product_images?product_id=eq.${encode(productId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  await supabaseRequest(env, `/rest/v1/products?id=eq.${encode(productId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

async function handleR2Upload(request, env, pathname) {
  if (!env.PRODUCT_IMAGES) return apiError('Cloudflare R2 binding PRODUCT_IMAGES is missing.', 503);
  await requireAdmin(request, env);

  const prefix = '/api/storage/';
  const key = pathname.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  if (!key || key.includes('..')) return apiError('Invalid image path.', 400);

  const upsert = request.headers.get('X-Luxe-Upsert') === 'true';
  if (!upsert) {
    const existing = await env.PRODUCT_IMAGES.head(key);
    if (existing) return apiError('An image already exists at this path.', 409);
  }

  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  await env.PRODUCT_IMAGES.put(key, request.body, {
    httpMetadata: { contentType },
    customMetadata: { source: 'luxe-horizon-admin' },
  });
  return json({ path: key }, 201);
}

async function handleR2Image(env, pathname) {
  if (!env.PRODUCT_IMAGES) return new Response('Image storage unavailable.', { status: 503 });
  const prefix = '/api/images/';
  const key = pathname.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  const object = await env.PRODUCT_IMAGES.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return new Response(object.body, { headers });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'GET' && pathname === '/api/health') {
    return json({ ok: true, storage: Boolean(env.PRODUCT_IMAGES), database: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) });
  }

  if (method === 'GET' && pathname.startsWith('/api/images/')) return handleR2Image(env, pathname);
  if (method === 'PUT' && pathname.startsWith('/api/storage/')) return handleR2Upload(request, env, pathname);

  if (method === 'GET' && pathname === '/api/catalogue') return json(await getCatalogue(env));
  if (method === 'GET' && pathname.startsWith('/api/catalogue/')) {
    const productId = decodeURIComponent(pathname.slice('/api/catalogue/'.length));
    const product = await getPublicProduct(env, productId);
    return product ? json(product) : apiError('Product not found.', 404);
  }

  await requireAdmin(request, env);

  if (method === 'GET' && pathname === '/api/dashboard') return json(await getDashboard(env));

  if (method === 'GET' && pathname === '/api/collections') {
    const rows = await supabaseRequest(env, '/rest/v1/collections?order=created_at.desc');
    return json((rows || []).map(collectionFromRow));
  }

  if (method === 'POST' && pathname === '/api/collections') {
    const input = await request.json();
    if (!input?.name || !input?.slug) return apiError('Collection name and slug are required.', 400);
    const rows = await supabaseRequest(env, '/rest/v1/collections', {
      method: 'POST',
      body: JSON.stringify({
        name: String(input.name).trim(),
        slug: String(input.slug).trim(),
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        is_published: false,
        published_at: null,
      }),
    });
    return json(collectionFromRow(rows[0]), 201);
  }

  const collectionMatch = pathname.match(/^\/api\/collections\/([^/]+)$/);
  if (collectionMatch && method === 'PATCH') {
    const collectionId = decodeURIComponent(collectionMatch[1]);
    const input = await request.json();
    const patch = {};
    if (typeof input.name === 'string') patch.name = input.name.trim();
    if (typeof input.slug === 'string') patch.slug = input.slug.trim();
    if ('startDate' in input) patch.start_date = input.startDate ?? null;
    if ('endDate' in input) patch.end_date = input.endDate ?? null;
    if (typeof input.isPublished === 'boolean') {
      patch.is_published = input.isPublished;
      if (input.isPublished) {
        patch.published_at = new Date().toISOString();
        await supabaseRequest(env, `/rest/v1/collections?is_published=eq.true&id=neq.${encode(collectionId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_published: false }),
        });
      }
    }
    const rows = await supabaseRequest(env, `/rest/v1/collections?id=eq.${encode(collectionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return rows?.length ? json(collectionFromRow(rows[0])) : apiError('Collection not found.', 404);
  }

  if (collectionMatch && method === 'DELETE') {
    const collectionId = decodeURIComponent(collectionMatch[1]);
    const products = await supabaseRequest(env, `/rest/v1/products?collection_id=eq.${encode(collectionId)}`);
    for (const product of products || []) await deleteProduct(env, product.id);
    await supabaseRequest(env, `/rest/v1/collections?id=eq.${encode(collectionId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    return new Response(null, { status: 204 });
  }

  if (method === 'GET' && pathname === '/api/products') {
    const filters = ['order=created_at.desc'];
    for (const [queryName, column] of [
      ['collectionId', 'collection_id'],
      ['gender', 'gender'],
      ['category', 'category'],
    ]) {
      const value = url.searchParams.get(queryName);
      if (value) filters.push(`${column}=eq.${encode(value)}`);
    }
    if (url.searchParams.has('published')) filters.push(`is_published=eq.${url.searchParams.get('published') === 'true'}`);
    if (url.searchParams.has('reviewed')) filters.push(`review_status=eq.${url.searchParams.get('reviewed') === 'true' ? 'reviewed' : 'pending'}`);
    const rows = await supabaseRequest(env, `/rest/v1/products?${filters.join('&')}`);
    return json(await productsFromRows(env, rows || []));
  }

  if (method === 'POST' && pathname === '/api/products/upload') {
    const input = await request.json();
    if (!input?.collectionId || !Array.isArray(input?.images) || !input.images.length) {
      return apiError('collectionId and product images are required.', 400);
    }
    const gender = input.batchHint === 'men' ? 'men' : input.batchHint === 'women' ? 'women' : 'unknown';
    const created = [];
    for (const item of input.images) {
      if (!item?.imagePath) continue;
      const product = await insertProduct(env, input.collectionId, gender);
      await insertImages(env, product.id, [item.imagePath]);
      created.push((await productsFromRows(env, [product]))[0]);
    }
    return json(created, 201);
  }

  if (method === 'POST' && pathname === '/api/products/upload-grouped') {
    const input = await request.json();
    if (!input?.collectionId || !Array.isArray(input?.groups) || !input.groups.length) {
      return apiError('collectionId and at least one image group are required.', 400);
    }
    const gender = input.batchHint === 'men' ? 'men' : input.batchHint === 'women' ? 'women' : 'unknown';
    const created = [];
    for (const group of input.groups) {
      const paths = Array.isArray(group?.imagePaths) ? group.imagePaths.filter(Boolean) : [];
      if (!paths.length) continue;
      const product = await insertProduct(env, input.collectionId, gender);
      await insertImages(env, product.id, paths);
      created.push((await productsFromRows(env, [product]))[0]);
    }
    return json(created, 201);
  }

  const flexibleMatch = pathname.match(/^\/api\/products\/([^/]+)\/flexible$/);
  if (flexibleMatch && method === 'PATCH') {
    const productId = decodeURIComponent(flexibleMatch[1]);
    const input = await request.json();
    const patch = {};
    if (typeof input.gender === 'string') patch.gender = input.gender;
    if (typeof input.category === 'string') patch.category = input.category;
    if (typeof input.brand === 'string' || input.brand === null) patch.brand = input.brand;
    if (typeof input.reviewed === 'boolean') patch.review_status = input.reviewed ? 'reviewed' : 'pending';
    if (typeof input.isActive === 'boolean') patch.is_active = input.isActive;
    if (typeof input.isPublished === 'boolean') patch.is_published = input.isPublished;
    if (typeof input.sortOrder === 'number') patch.sort_order = input.sortOrder;
    if (typeof input.collectionId === 'string') patch.collection_id = input.collectionId;
    const rows = await supabaseRequest(env, `/rest/v1/products?id=eq.${encode(productId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return rows?.length ? json((await productsFromRows(env, rows))[0]) : apiError('Product not found.', 404);
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && method === 'DELETE') {
    await deleteProduct(env, decodeURIComponent(productMatch[1]));
    return new Response(null, { status: 204 });
  }

  return apiError('API route not found.', 404);
}

export async function onRequest(context) {
  try {
    return await handleApi(context.request, context.env);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    console.error('Luxe Horizon API error:', message);
    return apiError(status >= 500 ? 'Server request failed.' : message, status);
  }
}
