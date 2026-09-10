import { Router, type IRouter } from "express";

const router: IRouter = Router();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
    const rows = await request<Record<string, unknown>[]>(`/rest/v1/products?id=eq.${encode(productId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!rows.length) return void res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

router.post("/products/upload-grouped", async (req, res, next) => {
  try {
    const { collectionId, batchHint = "mixed", groups = [] } = req.body as {
      collectionId?: string;
      batchHint?: "mixed" | "men" | "women";
      groups?: { imagePaths?: string[] }[];
    };
    if (!collectionId || !Array.isArray(groups) || groups.length === 0) {
      return void res.status(400).json({ error: "collectionId and at least one image group are required" });
    }
    const gender = batchHint === "men" ? "men" : batchHint === "women" ? "women" : "unknown";
    const created: Record<string, unknown>[] = [];
    for (const group of groups) {
      const imagePaths = Array.isArray(group.imagePaths) ? group.imagePaths.filter(Boolean) : [];
      if (!imagePaths.length) continue;
      const products = await request<Record<string, unknown>[]>("/rest/v1/products", {
        method: "POST",
        body: JSON.stringify({
          collection_id: collectionId,
          gender,
          category: "other",
          brand: null,
          ai_suggested_gender: gender === "unknown" ? null : gender,
          ai_suggested_category: "other",
          review_status: "pending",
          is_active: true,
          is_published: false,
        }),
      });
      const product = products[0];
      const productId = String(product.id);
      const imageRows = imagePaths.map((storagePath, index) => ({
        product_id: productId,
        storage_path: storagePath,
        is_primary: index === 0,
        sort_order: index + 1,
      }));
      await request<Record<string, unknown>[]>("/rest/v1/product_images", {
        method: "POST",
        body: JSON.stringify(imageRows),
      });
      created.push(product);
    }
    res.status(201).json(created);
  } catch (error) { next(error); }
});

export default router;
