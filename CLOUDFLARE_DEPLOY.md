# Luxe Horizon — Cloudflare production deployment

This repository is prepared to run the Luxe Horizon catalogue on Cloudflare Pages + Pages Functions, while keeping Supabase for authentication/database and Cloudflare R2 for product-image blobs.

## Production architecture

- **Cloudflare Pages** — Vite/React customer catalogue + private admin UI
- **Cloudflare Pages Functions** — `/api/*` server API
- **Cloudflare R2** — original product image files
- **Supabase Auth** — admin sign-in
- **Supabase Postgres** — collections, products and product image metadata
- **jsPDF in the browser** — catalogue PDFs are generated on demand and downloaded; they are not permanently stored

## Cloudflare project settings

Use the repository root as the project root.

- Framework preset: **None / Vite-compatible custom build**
- Build command: `pnpm run build:cloudflare`
- Build output directory: `artifacts/luxe-horizon/dist`
- Production branch while testing: `chatgpt/v1-completion`

The repository's `wrangler.toml` declares the Pages output directory and an R2 binding named `PRODUCT_IMAGES`.

## R2

Create this bucket before the first production deployment:

`luxe-horizon-product-images`

Keep the R2 bucket private. The app serves image objects through `/api/images/*`; bucket listing/public access is not required.

## Environment variables

### Build-time browser variables

These values are used by Vite and may be available in the browser bundle as intended:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_LUXE_HORIZON_WHATSAPP`

### Runtime server variables / secrets

Configure these for Pages Functions. Never prefix the secret with `VITE_` and never commit the value to GitHub:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

The current Supabase secret-key format (`sb_secret_...`) is sent to Supabase using the `apikey` header only. User sessions continue to use their Supabase Auth bearer JWT.

## Storage behavior

The admin upload screen still uses its existing upload UI, but the storage adapter now sends the binary file to `/api/storage/*`. The Pages Function writes that file into R2. The database stores only the R2 object key in `product_images.image_path`.

When a product is deleted, its R2 image objects are deleted as well.

The existing Supabase `product-images` bucket can remain private during migration. New production uploads no longer depend on it.

## SPA routing

`artifacts/luxe-horizon/public/_redirects` rewrites customer/admin client-side routes to `index.html`. Requests handled by Pages Functions under `/api/*` are not affected by Pages static redirects.

## First live test after deployment

1. Sign in at `/admin` with the existing Supabase Auth admin account.
2. Create a collection.
3. Upload one product image.
4. Confirm the R2 object was created and `product_images.image_path` contains its object key.
5. Review the product and publish it.
6. Publish the collection.
7. Open `/catalogue` and the product detail page.
8. Test WhatsApp enquiry.
9. Generate the catalogue PDF and confirm product images render at usable quality.

Do not upload a large real collection until this end-to-end test passes.
