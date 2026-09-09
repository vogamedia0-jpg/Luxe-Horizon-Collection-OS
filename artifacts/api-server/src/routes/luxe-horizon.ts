import { Router, type IRouter } from "express";
import {
  BulkUpdateProductsBody,
  CreateCollectionBody,
  CreateProductBody,
  GenerateCataloguePdfBody,
  GetCatalogueQueryParams,
  GetCollectionParams,
  GetProductParams,
  GetPublicProductParams,
  ListProductsQueryParams,
  UpdateCollectionBody,
  UpdateCollectionParams,
  UpdateProductBody,
  UpdateProductParams,
  UpdateSettingsBody,
  UploadProductsBody,
} from "@workspace/api-zod";

type Gender = "men" | "women" | "unknown";
type Category = "clothing" | "footwear" | "watches" | "bags" | "accessories" | "other";

type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  collection_id: string;
  brand: string | null;
  gender: string | null;
  category: string | null;
  ai_suggested_brand: string | null;
  ai_suggested_gender: string | null;
  ai_suggested_category: string | null;
  ai_confidence: number | null;
  review_status: string | null;
  is_active: boolean;
  is_published: boolean;
  sort_order?: number | null;
  created_at: string;
  updated_at: string;
};

type ProductImageRow = {
  id: string;
  product_id: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
  created_at?: string;
};

type ProductImage = { id: string; imagePath: string; isPrimary: boolean; sortOrder: number };
type Product = {
  id: string;
  collectionId: string;
  gender: Gender;
  category: Category;
  brand: string | null;
  aiGender: string | null;
  aiCategory: string | null;
  aiBrand: string | null;
  aiConfidence: number | null;
  reviewed: boolean;
  isActive: boolean;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
};

type Collection = {
  id: string;
  name: string;
  slug: string;
  startDate: string | null;
  endDate: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const router: IRouter = Router();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const storageBucket = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";

function assertSupabase() {
  if (!supabaseUrl || !supabaseSecret) {
    const error = new Error("Supabase server configuration is missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    const body = await response.text();
    const error = new Error(body || `Supabase request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const encode = (value: string) => encodeURIComponent(value);
const dateValue = (value: Date | string | null | undefined) => value instanceof Date ? value.toISOString().slice(0, 10) : value ?? null;
const normalizeGender = (value?: string | null): Gender => value?.toLowerCase() === "men" ? "men" : value?.toLowerCase() === "women" ? "women" : "unknown";
const normalizeCategory = (value?: string | null): Category => {
  const normalized = value?.toLowerCase();
  return normalized === "clothing" || normalized === "footwear" || normalized === "watches" || normalized === "bags" || normalized === "accessories" ? normalized : "other";
};
const collectionFromRow = (row: CollectionRow): Collection => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  startDate: row.start_date,
  endDate: row.end_date,
  isPublished: row.is_published,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function signedImagePath(storagePath: string) {
  if (!storagePath || storagePath.startsWith("http://") || storagePath.startsWith("https://") || storagePath.startsWith("/assets/")) return storagePath;
  try {
    const result = await supabaseRequest<{ signedURL?: string; signedUrl?: string }>(
      `/storage/v1/object/sign/${encode(storageBucket)}/${storagePath.split("/").map(encode).join("/")}`,
      { method: "POST", body: JSON.stringify({ expiresIn: 3600 }) },
    );
    const signed = result.signedURL || result.signedUrl;
    return signed ? (signed.startsWith("http") ? signed : `${supabaseUrl}/storage/v1${signed}`) : storagePath;
  } catch {
    return storagePath;
  }
}

async function imagesForProducts(productIds: string[], signImages = false) {
  if (!productIds.length) return new Map<string, ProductImage[]>();
  const ids = productIds.map((id) => `"${id}"`).join(",");
  const rows = await supabaseRequest<ProductImageRow[]>(`/rest/v1/product_images?product_id=in.(${encode(ids)})&order=sort_order.asc`);
  const map = new Map<string, ProductImage[]>();
  for (const row of rows) {
    const imagePath = signImages ? await signedImagePath(row.storage_path) : row.storage_path;
    const item = { id: row.id, imagePath, isPrimary: row.is_primary, sortOrder: row.sort_order ?? 0 };
    map.set(row.product_id, [...(map.get(row.product_id) || []), item]);
  }
  return map;
}

async function productsFromRows(rows: ProductRow[], signImages = false): Promise<Product[]> {
  const images = await imagesForProducts(rows.map((row) => row.id), signImages);
  return rows.map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    gender: normalizeGender(row.gender),
    category: normalizeCategory(row.category),
    brand: row.brand,
    aiGender: row.ai_suggested_gender,
    aiCategory: row.ai_suggested_category,
    aiBrand: row.ai_suggested_brand,
    aiConfidence: row.ai_confidence,
    reviewed: row.review_status === "reviewed" || row.review_status === "approved",
    isActive: row.is_active,
    isPublished: row.is_published,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images.get(row.id) || [],
  }));
}

async function getCollectionRow(id: string) {
  const rows = await supabaseRequest<CollectionRow[]>(`/rest/v1/collections?id=eq.${encode(id)}&limit=1`);
  return rows[0] || null;
}

async function getProductRow(id: string) {
  const rows = await supabaseRequest<ProductRow[]>(`/rest/v1/products?id=eq.${encode(id)}&limit=1`);
  return rows[0] || null;
}

router.get("/collections", async (_req, res, next) => {
  try {
    const rows = await supabaseRequest<CollectionRow[]>("/rest/v1/collections?order=created_at.desc");
    res.json(rows.map(collectionFromRow));
  } catch (error) { next(error); }
});

router.post("/collections", async (req, res, next) => {
  try {
    const input = CreateCollectionBody.parse(req.body);
    const rows = await supabaseRequest<CollectionRow[]>("/rest/v1/collections", {
      method: "POST",
      body: JSON.stringify({ name: input.name, slug: input.slug, start_date: dateValue(input.startDate), end_date: dateValue(input.endDate), is_published: false, published_at: null }),
    });
    res.status(201).json(collectionFromRow(rows[0]));
  } catch (error) { next(error); }
});

router.get("/collections/:collectionId", async (req, res, next) => {
  try {
    const { collectionId } = GetCollectionParams.parse(req.params);
    const row = await getCollectionRow(collectionId);
    if (!row) return void res.status(404).json({ error: "Collection not found" });
    res.json(collectionFromRow(row));
  } catch (error) { next(error); }
});

router.patch("/collections/:collectionId", async (req, res, next) => {
  try {
    const { collectionId } = UpdateCollectionParams.parse(req.params);
    const input = UpdateCollectionBody.parse(req.body);
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.startDate !== undefined) patch.start_date = dateValue(input.startDate);
    if (input.endDate !== undefined) patch.end_date = dateValue(input.endDate);
    if (input.isPublished !== undefined) {
      patch.is_published = input.isPublished;
      patch.published_at = input.isPublished ? new Date().toISOString() : null;
    }
    const rows = await supabaseRequest<CollectionRow[]>(`/rest/v1/collections?id=eq.${encode(collectionId)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!rows.length) return void res.status(404).json({ error: "Collection not found" });
    res.json(collectionFromRow(rows[0]));
  } catch (error) { next(error); }
});

router.delete("/collections/:collectionId", async (req, res, next) => {
  try {
    const { collectionId } = GetCollectionParams.parse(req.params);
    await supabaseRequest<void>(`/rest/v1/collections?id=eq.${encode(collectionId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.get("/dashboard", async (_req, res, next) => {
  try {
    const collections = await supabaseRequest<CollectionRow[]>("/rest/v1/collections?order=is_published.desc,created_at.desc&limit=1");
    if (!collections.length) return void res.json({ collection: null, totalUploaded: 0, men: 0, women: 0, unknown: 0, needsReview: 0, published: 0, categories: {} });
    const collection = collections[0];
    const rows = await supabaseRequest<ProductRow[]>(`/rest/v1/products?collection_id=eq.${encode(collection.id)}`);
    const products = await productsFromRows(rows);
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

router.get("/products", async (req, res, next) => {
  try {
    const query = ListProductsQueryParams.parse(req.query);
    const filters = ["order=created_at.desc"];
    if (query.collectionId) filters.push(`collection_id=eq.${encode(query.collectionId)}`);
    if (query.gender) filters.push(`gender=eq.${encode(query.gender)}`);
    if (query.category) filters.push(`category=eq.${encode(query.category)}`);
    if (query.published !== undefined) filters.push(`is_published=eq.${query.published}`);
    if (query.reviewed !== undefined) filters.push(`review_status=eq.${query.reviewed ? "reviewed" : "pending"}`);
    const rows = await supabaseRequest<ProductRow[]>(`/rest/v1/products?${filters.join("&")}`);
    res.json(await productsFromRows(rows, true));
  } catch (error) { next(error); }
});

router.post("/products", async (req, res, next) => {
  try {
    const input = CreateProductBody.parse(req.body);
    const rows = await supabaseRequest<ProductRow[]>("/rest/v1/products", {
      method: "POST",
      body: JSON.stringify({ collection_id: input.collectionId, gender: input.gender, category: input.category, brand: input.brand ?? null, review_status: "pending", is_active: true, is_published: false }),
    });
    const product = rows[0];
    if (input.imagePath) {
      await supabaseRequest<ProductImageRow[]>("/rest/v1/product_images", { method: "POST", body: JSON.stringify({ product_id: product.id, storage_path: input.imagePath, is_primary: true, sort_order: 1 }) });
    }
    res.status(201).json((await productsFromRows([product], true))[0]);
  } catch (error) { next(error); }
});

router.post("/products/upload", async (req, res, next) => {
  try {
    const input = UploadProductsBody.parse(req.body);
    const gender: Gender = input.batchHint === "men" ? "men" : input.batchHint === "women" ? "women" : "unknown";
    const created: Product[] = [];
    for (const image of input.images) {
      const rows = await supabaseRequest<ProductRow[]>("/rest/v1/products", { method: "POST", body: JSON.stringify({ collection_id: input.collectionId, gender, category: "other", brand: null, ai_suggested_gender: gender === "unknown" ? null : gender, ai_suggested_category: "other", review_status: "pending", is_active: true, is_published: false }) });
      const product = rows[0];
      await supabaseRequest<ProductImageRow[]>("/rest/v1/product_images", { method: "POST", body: JSON.stringify({ product_id: product.id, storage_path: image.imagePath, is_primary: true, sort_order: 1 }) });
      created.push((await productsFromRows([product], true))[0]);
    }
    res.status(201).json(created);
  } catch (error) { next(error); }
});

router.patch("/products/bulk", async (req, res, next) => {
  try {
    const input = BulkUpdateProductsBody.parse(req.body);
    const patch: Record<string, unknown> = {};
    if (input.gender !== undefined) patch.gender = input.gender;
    if (input.category !== undefined) patch.category = input.category;
    if (input.brand !== undefined) patch.brand = input.brand;
    if (input.reviewed !== undefined) patch.review_status = input.reviewed ? "reviewed" : "pending";
    if (input.isPublished !== undefined) patch.is_published = input.isPublished;
    const updated: ProductRow[] = [];
    for (const productId of input.productIds) {
      const rows = await supabaseRequest<ProductRow[]>(`/rest/v1/products?id=eq.${encode(productId)}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (rows[0]) updated.push(rows[0]);
    }
    res.json(await productsFromRows(updated, true));
  } catch (error) { next(error); }
});

router.get("/products/:productId", async (req, res, next) => {
  try {
    const { productId } = GetProductParams.parse(req.params);
    const row = await getProductRow(productId);
    if (!row) return void res.status(404).json({ error: "Product not found" });
    res.json((await productsFromRows([row], true))[0]);
  } catch (error) { next(error); }
});

router.patch("/products/:productId", async (req, res, next) => {
  try {
    const { productId } = UpdateProductParams.parse(req.params);
    const input = UpdateProductBody.parse(req.body);
    const patch: Record<string, unknown> = {};
    if (input.gender !== undefined) patch.gender = input.gender;
    if (input.category !== undefined) patch.category = input.category;
    if (input.brand !== undefined) patch.brand = input.brand;
    if (input.reviewed !== undefined) patch.review_status = input.reviewed ? "reviewed" : "pending";
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.isPublished !== undefined) patch.is_published = input.isPublished;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
    const rows = await supabaseRequest<ProductRow[]>(`/rest/v1/products?id=eq.${encode(productId)}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!rows.length) return void res.status(404).json({ error: "Product not found" });
    res.json((await productsFromRows(rows, true))[0]);
  } catch (error) { next(error); }
});

router.delete("/products/:productId", async (req, res, next) => {
  try {
    const { productId } = GetProductParams.parse(req.params);
    await supabaseRequest<void>(`/rest/v1/products?id=eq.${encode(productId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.get("/catalogue", async (req, res, next) => {
  try {
    const query = GetCatalogueQueryParams.parse(req.query);
    let collection: CollectionRow | null = null;
    if (query.collectionId) collection = await getCollectionRow(query.collectionId);
    else {
      const rows = await supabaseRequest<CollectionRow[]>("/rest/v1/collections?is_published=eq.true&order=published_at.desc&limit=1");
      collection = rows[0] || null;
    }
    if (!collection) return void res.json({ collection: null, products: [], availableBrands: [] });
    const filters = [`collection_id=eq.${encode(collection.id)}`, "is_active=eq.true", "is_published=eq.true", "order=created_at.desc"];
    if (query.gender) filters.push(`gender=eq.${encode(query.gender)}`);
    if (query.category) filters.push(`category=eq.${encode(query.category)}`);
    if (query.brand) filters.push(`brand=eq.${encode(query.brand)}`);
    const rows = await supabaseRequest<ProductRow[]>(`/rest/v1/products?${filters.join("&")}`);
    const products = await productsFromRows(rows, true);
    const availableBrands = [...new Set(products.flatMap((product) => product.brand ? [product.brand] : []))].sort();
    res.json({ collection: collectionFromRow(collection), products, availableBrands });
  } catch (error) { next(error); }
});

router.get("/catalogue/:productId", async (req, res, next) => {
  try {
    const { productId } = GetPublicProductParams.parse(req.params);
    const rows = await supabaseRequest<ProductRow[]>(`/rest/v1/products?id=eq.${encode(productId)}&is_active=eq.true&is_published=eq.true&limit=1`);
    if (!rows.length) return void res.status(404).json({ error: "Product not found" });
    res.json((await productsFromRows(rows, true))[0]);
  } catch (error) { next(error); }
});

router.post("/catalogue/pdf", (req, res) => {
  const input = GenerateCataloguePdfBody.parse(req.body);
  res.json({ status: "ready", downloadUrl: null, title: input.title });
});

router.get("/settings", (_req, res) => {
  res.json({ whatsappNumber: process.env.LUXE_HORIZON_WHATSAPP || process.env.VITE_LUXE_HORIZON_WHATSAPP || "", businessName: "Luxe horizon", tagline: "The pinnacle of luxury shopping" });
});

router.patch("/settings", (req, res) => {
  const input = UpdateSettingsBody.parse(req.body);
  res.json({ whatsappNumber: input.whatsappNumber ?? process.env.LUXE_HORIZON_WHATSAPP ?? "", businessName: input.businessName ?? "Luxe horizon", tagline: input.tagline ?? "The pinnacle of luxury shopping" });
});

export default router;
