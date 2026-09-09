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
type Category =
  | "clothing"
  | "footwear"
  | "watches"
  | "bags"
  | "accessories"
  | "other";

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

type ProductImage = {
  id: string;
  imagePath: string;
  isPrimary: boolean;
  sortOrder: number;
};

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

const now = "2026-09-07T09:00:00.000Z";

const collections: Collection[] = [
  {
    id: "collection-week-36",
    name: "New Collection — 07 September 2026",
    slug: "new-collection-07-september-2026",
    startDate: "2026-09-07",
    endDate: "2026-09-13",
    isPublished: true,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "collection-week-35",
    name: "New Collection — 31 August 2026",
    slug: "new-collection-31-august-2026",
    startDate: "2026-08-31",
    endDate: "2026-09-06",
    isPublished: false,
    publishedAt: null,
    createdAt: "2026-08-31T09:00:00.000Z",
    updatedAt: "2026-08-31T09:00:00.000Z",
  },
];

const products: Product[] = [
  {
    id: "product-marble-night",
    collectionId: "collection-week-36",
    gender: "women",
    category: "clothing",
    brand: null,
    aiGender: "women",
    aiCategory: "clothing",
    aiBrand: null,
    aiConfidence: 0.91,
    reviewed: true,
    isActive: true,
    isPublished: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
    images: [
      {
        id: "image-marble-night",
        imagePath: "Luxe_Horizon_in_Marble_Elegance_1788985336468.png",
        isPrimary: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "product-burgundy-box",
    collectionId: "collection-week-36",
    gender: "women",
    category: "bags",
    brand: "Chanel",
    aiGender: "women",
    aiCategory: "bags",
    aiBrand: "Chanel",
    aiConfidence: 0.96,
    reviewed: true,
    isActive: true,
    isPublished: true,
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
    images: [
      {
        id: "image-burgundy-box",
        imagePath: "Luxe_Horizon_Luxury_Brand_Mockup_1788985388415.png",
        isPrimary: true,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "product-rose-timepiece",
    collectionId: "collection-week-36",
    gender: "men",
    category: "watches",
    brand: "Rolex",
    aiGender: "men",
    aiCategory: "watches",
    aiBrand: "Rolex",
    aiConfidence: 0.74,
    reviewed: false,
    isActive: true,
    isPublished: false,
    sortOrder: 3,
    createdAt: now,
    updatedAt: now,
    images: [
      {
        id: "image-rose-timepiece",
        imagePath: "Luxe_Horizon_Luxury_Brand_Mockup_1788985388415.png",
        isPrimary: true,
        sortOrder: 1,
      },
    ],
  },
];

let settings = {
  whatsappNumber: "",
  businessName: "Luxe horizon",
  tagline: "The pinnacle of luxury shopping",
};

const router: IRouter = Router();

const timestamp = () => new Date().toISOString();
const dateValue = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value ?? null;
const getCollection = (id: string) => collections.find((item) => item.id === id);
const getProduct = (id: string) => products.find((item) => item.id === id);

router.get("/collections", (_req, res) => {
  res.json(collections);
});

router.post("/collections", (req, res) => {
  const input = CreateCollectionBody.parse(req.body);
  const createdAt = timestamp();
  const collection: Collection = {
    id: `collection-${Date.now()}`,
    name: input.name,
    slug: input.slug,
    startDate: dateValue(input.startDate),
    endDate: dateValue(input.endDate),
    isPublished: false,
    publishedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
  collections.unshift(collection);
  res.status(201).json(collection);
});

router.get("/collections/:collectionId", (req, res) => {
  const { collectionId } = GetCollectionParams.parse(req.params);
  const collection = getCollection(collectionId);
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  res.json(collection);
});

router.patch("/collections/:collectionId", (req, res) => {
  const params = UpdateCollectionParams.parse(req.params);
  const input = UpdateCollectionBody.parse(req.body);
  const collection = getCollection(params.collectionId);
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  Object.assign(collection, {
    ...input,
    startDate: dateValue(input.startDate) ?? collection.startDate,
    endDate: dateValue(input.endDate) ?? collection.endDate,
    publishedAt: input.isPublished ? timestamp() : collection.publishedAt,
    updatedAt: timestamp(),
  });
  res.json(collection);
});

router.delete("/collections/:collectionId", (req, res) => {
  const { collectionId } = GetCollectionParams.parse(req.params);
  const index = collections.findIndex((item) => item.id === collectionId);
  if (index === -1) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  collections.splice(index, 1);
  res.status(204).send();
});

router.get("/dashboard", (_req, res) => {
  const collection = collections.find((item) => item.isPublished) ?? collections[0];
  const currentProducts = products.filter((item) => item.collectionId === collection.id);
  const categories = currentProducts.reduce<Record<string, number>>((summary, product) => {
    summary[product.category] = (summary[product.category] ?? 0) + 1;
    return summary;
  }, {});
  res.json({
    collection,
    totalUploaded: currentProducts.length,
    men: currentProducts.filter((item) => item.gender === "men").length,
    women: currentProducts.filter((item) => item.gender === "women").length,
    unknown: currentProducts.filter((item) => item.gender === "unknown").length,
    needsReview: currentProducts.filter((item) => !item.reviewed).length,
    published: currentProducts.filter((item) => item.isPublished && item.isActive).length,
    categories,
  });
});

router.get("/products", (req, res) => {
  const query = ListProductsQueryParams.parse(req.query);
  const result = products.filter((product) => {
    if (query.collectionId && product.collectionId !== query.collectionId) return false;
    if (query.gender && product.gender !== query.gender) return false;
    if (query.category && product.category !== query.category) return false;
    if (query.reviewed !== undefined && product.reviewed !== query.reviewed) return false;
    if (query.published !== undefined && product.isPublished !== query.published) return false;
    return true;
  });
  res.json(result);
});

router.post("/products", (req, res) => {
  const input = CreateProductBody.parse(req.body);
  const createdAt = timestamp();
  const product: Product = {
    id: `product-${Date.now()}`,
    collectionId: input.collectionId,
    gender: input.gender,
    category: input.category,
    brand: input.brand ?? null,
    aiGender: null,
    aiCategory: null,
    aiBrand: null,
    aiConfidence: null,
    reviewed: false,
    isActive: true,
    isPublished: false,
    sortOrder: products.length + 1,
    createdAt,
    updatedAt: createdAt,
    images: [
      {
        id: `image-${Date.now()}`,
        imagePath: input.imagePath,
        isPrimary: true,
        sortOrder: 1,
      },
    ],
  };
  products.unshift(product);
  res.status(201).json(product);
});

router.post("/products/upload", (req, res) => {
  const input = UploadProductsBody.parse(req.body);
  const createdAt = timestamp();
  const uploaded = input.images.map((image, index) => {
    const gender: Gender = input.batchHint === "men" ? "men" : input.batchHint === "women" ? "women" : "unknown";
    const product: Product = {
      id: `product-${Date.now()}-${index}`,
      collectionId: input.collectionId,
      gender,
      category: "other",
      brand: null,
      aiGender: gender === "unknown" ? null : gender,
      aiCategory: "other",
      aiBrand: null,
      aiConfidence: null,
      reviewed: false,
      isActive: true,
      isPublished: false,
      sortOrder: products.length + index + 1,
      createdAt,
      updatedAt: createdAt,
      images: [
        {
          id: `image-${Date.now()}-${index}`,
          imagePath: image.imagePath,
          isPrimary: true,
          sortOrder: 1,
        },
      ],
    };
    products.unshift(product);
    return product;
  });
  res.status(201).json(uploaded);
});

router.get("/products/:productId", (req, res) => {
  const { productId } = GetProductParams.parse(req.params);
  const product = getProduct(productId);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

router.patch("/products/bulk", (req, res) => {
  const input = BulkUpdateProductsBody.parse(req.body);
  const updated = products.filter((product) => input.productIds.includes(product.id));
  updated.forEach((product) => {
    Object.assign(product, {
      gender: input.gender ?? product.gender,
      category: input.category ?? product.category,
      brand: input.brand === undefined ? product.brand : input.brand,
      reviewed: input.reviewed ?? product.reviewed,
      isPublished: input.isPublished ?? product.isPublished,
      updatedAt: timestamp(),
    });
  });
  res.json(updated);
});

router.patch("/products/:productId", (req, res) => {
  const params = UpdateProductParams.parse(req.params);
  const input = UpdateProductBody.parse(req.body);
  const product = getProduct(params.productId);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  Object.assign(product, { ...input, updatedAt: timestamp() });
  res.json(product);
});

router.delete("/products/:productId", (req, res) => {
  const { productId } = GetProductParams.parse(req.params);
  const index = products.findIndex((item) => item.id === productId);
  if (index === -1) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  products.splice(index, 1);
  res.status(204).send();
});

router.get("/catalogue", (req, res) => {
  const query = GetCatalogueQueryParams.parse(req.query);
  const collection =
    (query.collectionId ? getCollection(query.collectionId) : collections.find((item) => item.isPublished)) ??
    collections[0];
  const visible = products.filter((product) => {
    if (product.collectionId !== collection.id || !product.isActive || !product.isPublished) return false;
    if (query.gender && product.gender !== query.gender) return false;
    if (query.category && product.category !== query.category) return false;
    if (query.brand && product.brand !== query.brand) return false;
    return true;
  });
  const availableBrands = [...new Set(visible.flatMap((product) => (product.brand ? [product.brand] : [])))].sort();
  res.json({ collection, products: visible, availableBrands });
});

router.get("/catalogue/:productId", (req, res) => {
  const { productId } = GetPublicProductParams.parse(req.params);
  const product = getProduct(productId);
  if (!product || !product.isActive || !product.isPublished) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

router.post("/catalogue/pdf", (req, res) => {
  const input = GenerateCataloguePdfBody.parse(req.body);
  res.json({
    status: "ready",
    downloadUrl: null,
    title: input.title,
  });
});

router.get("/settings", (_req, res) => {
  res.json(settings);
});

router.patch("/settings", (req, res) => {
  const input = UpdateSettingsBody.parse(req.body);
  settings = { ...settings, ...input };
  res.json(settings);
});

export default router;