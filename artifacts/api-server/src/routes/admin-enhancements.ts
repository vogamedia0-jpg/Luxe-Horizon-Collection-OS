import { Router, type IRouter } from "express";

const router: IRouter = Router();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const storageBucket = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";

function assertSupabase() {
  if (!supabaseUrl || !supabaseSecret) {
    const error = new Error("Supabase server configuration is missing.");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertSupabase();
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseSecret,
      Authorization: `Bearer ${supabaseSecret}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Supabase request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const encode = (value: string) => encodeURIComponent(value);

async function signedImagePath(imagePath: string) {
  if (!imagePath || imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("/assets/")) return imagePath;
  try {
    const result = await request<{ signedURL?: string; signedUrl?: string }>(
      `/storage/v1/object/sign/${encode(storageBucket)}/${imagePath.split("/").map(encode).join("/")}`,
      { method: "POST", body: JSON.stringify({ expiresIn: 3600 }) },
    );
    const signed = result.signedURL || result.signedUrl;
    return signed ? (signed.startsWith("http") ? signed : `${supabaseUrl}/storage/v1${signed}`) : imagePath;
  } catch {
    return imagePath;
  }
}

async function productsFromRows(rows: Record<string, any>[], signImages = true) {
  if (!rows.length) return [];
  const ids = rows.map((row) => `"${row.id}"`).join(",");
  const imageRows = await request<Record<string, any>[]>(`/rest/v1/product_images?product_id=in.(${encode(ids)})&order=sort_order.asc`);
  const imageMap = new Map<string, any[]>();
  for (const image of imageRows) {
    // The live Luxe Horizon schema uses product_images.image_path.
    // Keep a storage_path fallback so older rows remain readable if present.
    const storedPath = image.image_path ?? image.storage_path ?? "";
    const imagePath = signImages ? await signedImagePath(storedPath) : storedPath;
    const item = { id: image.id, imagePath, isPrimary: Boolean(image.is_primary), sortOrder: image.sort_order ?? 0 };
    imageMap.set(image.product_id, [...(imageMap.get(image.product_id) || []), item]);
  }
  return rows.map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    gender: row.gender || "unknown",
    category: row.category || "other",
    brand: row.brand,
    aiGender: row.ai_suggested_gender ?? null,
    aiCategory: row.ai_suggested_category ?? null,
    aiBrand: row.ai_suggested_brand ?? null,
    aiConfidence: row.ai_confidence ?? null,
    reviewed: row.review_status === "reviewed" || row.review_status === "approved",
    isActive: row.is_active !== false,
    isPublished: Boolean(row.is_published),
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: imageMap.get(row.id) || [],
  }));
}

function collectionFromRow(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    startDate: row.start_date,
    endDate: row.end_date,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/products", async (req, res, next) => {
  try {
    const filters = ["order=created_at.desc"];
    if (typeof req.query.collectionId === "string") filters.push(`collection_id=eq.${encode(req.query.collectionId)}`);
    if (typeof req.query.gender === "string") filters.push(`gender=eq.${encode(req.query.gender)}`);
    if (typeof req.query.category === "string") filters.push(`category=eq.${encode(req.query.category)}`);
    if (typeof req.query.published === "string") filters.push(`is_published=eq.${req.query.published === "true"}`);
    if (typeof req.query.reviewed === "string") filters.push(`review_status=eq.${req.query.reviewed === "true" ? "reviewed" : "pending"}`);
    const rows = await request<Record<string, any>[]>(`/rest/v1/products?${filters.join("&")}`);
    res.json(await productsFromRows(rows));
  } catch (error) { next(error); }
});

router.get("/dashboard", async (_req, res, next) => {
  try {
    const collections = await request<Record<string, any>[]>("/rest/v1/collections?order=is_published.desc,published_at.desc,created_at.desc&limit=1");
    if (!collections.length) return void res.json({ collection: null, totalUploaded: 0, men: 0, women: 0, unknown: 0, needsReview: 0, published: 0, categories: {} });
    const collection = collections[0];
    const rows = await request<Record<string, any>[]>(`/rest/v1/products?collection_id=eq.${encode(collection.id)}`);
    const products = await productsFromRows(rows, false);
    const categories = products.reduce<Record<string, number>>((summary, product) => { summary[product.category] = (summary[product.category] || 0) + 1; return summary; }, {});
    res.json({
      collection: collectionFromRow(collection),
      totalUploaded: products.length,
      men: products.filter((item) => item.gender === "men").length,
      women: products.filter((item) => item.gender === "women").length,
      unknown: products.filter((item) => item.gender === "unknown").length,
      needsReview: products.filter((item) => !item.reviewed).length,
      published: products.filter((item) => item.isPublished && item.isActive).length,
      categories,
    });
  } catch (error) { next(error); }
});

router.get("/catalogue", async (_req, res, next) => {
  try {
    const collections = await request<Record<string, any>[]>("/rest/v1/collections?is_published=eq.true&order=published_at.desc&limit=1");
    const collection = collections[0];
    if (!collection) return void res.json({ collection: null, products: [], availableBrands: [] });
    const rows = await request<Record<string, any>[]>(`/rest/v1/products?collection_id=eq.${encode(collection.id)}&is_active=eq.true&is_published=eq.true&order=sort_order.asc,created_at.desc`);
    const products = await productsFromRows(rows);
    const availableBrands = [...new Set(products.flatMap((product) => product.brand ? [product.brand] : []))].sort();
    res.json({ collection: collectionFromRow(collection), products, availableBrands });
  } catch (error) { next(error); }
});

router.get("/catalogue/:productId", async (req, res, next) => {
  try {
    const rows = await request<Record<string, any>[]>(`/rest/v1/products?id=eq.${encode(req.params.productId)}&is_active=eq.true&is_published=eq.true&limit=1`);
    if (!rows.length) return void res.status(404).json({ error: "Product not found" });
    res.json((await productsFromRows(rows))[0]);
  } catch (error) { next(error); }
});

router.patch("/products/:productId/flexible", async (req, res, next) => {
  try {
    const { productId } = req.params;
    const input = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (typeof input.gender === "string") patch.gender = input.gender;
    if (typeof input.category === "string") patch.category = input.category;
    if (typeof input.brand === "string" || input.brand === null) patch.brand = input.brand;
    if (typeof input.reviewed === "boolean") patch.review_status = input.reviewed ? "reviewed" : "pending";
    if (typeof input.isActive === "boolean") patch.is_active = input.isActive;
    if (typeof input.isPublished === "boolean") patch.is_published = input.isPublished;
    if (typeof input.sortOrder === "number") patch.sort_order = input.sortOrder;
    const rows = await request<Record<string, unknown>[]>(`/rest/v1/products?id=eq.${encode(productId)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!rows.length) return void res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

router.post("/products/upload-grouped", async (req, res, next) => {
  try {
    const { collectionId, batchHint = "mixed", groups = [] } = req.body as { collectionId?: string; batchHint?: "mixed" | "men" | "women"; groups?: { imagePaths?: string[] }[] };
    if (!collectionId || !Array.isArray(groups) || groups.length === 0) return void res.status(400).json({ error: "collectionId and at least one image group are required" });
    const gender = batchHint === "men" ? "men" : batchHint === "women" ? "women" : "unknown";
    const created: Record<string, unknown>[] = [];
    for (const group of groups) {
      const imagePaths = Array.isArray(group.imagePaths) ? group.imagePaths.filter(Boolean) : [];
      if (!imagePaths.length) continue;

      // Only write columns confirmed in the live products table. AI suggestions are
      // review-layer metadata and must not make ingestion depend on optional columns.
      const products = await request<Record<string, unknown>[]>("/rest/v1/products", {
        method: "POST",
        body: JSON.stringify({
          collection_id: collectionId,
          gender,
          category: "other",
          brand: null,
        }),
      });
      const product = products[0];
      const productId = String(product.id);

      // Live Supabase schema uses image_path (not storage_path).
      await request<Record<string, unknown>[]>("/rest/v1/product_images", {
        method: "POST",
        body: JSON.stringify(imagePaths.map((imagePath, index) => ({
          product_id: productId,
          image_path: imagePath,
          is_primary: index === 0,
          sort_order: index + 1,
        }))),
      });
      created.push(product);
    }
    res.status(201).json(created);
  } catch (error) { next(error); }
});

export default router;
