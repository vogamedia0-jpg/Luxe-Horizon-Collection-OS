# Luxe Horizon Collection OS

Mobile-first collection operations for Luxe Horizon: upload and review product imagery privately, then publish a premium customer catalogue.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/luxe-horizon run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Supabase auth variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Optional `VITE_LUXE_HORIZON_WHATSAPP` provides the initial enquiry number in the UI

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/luxe-horizon/src/App.tsx` — public catalogue, private admin routes, and shared product workflows
- `artifacts/luxe-horizon/src/index.css` — centralized Luxe Horizon tokens and typography
- `artifacts/luxe-horizon/src/lib/supabase.ts` — optional Supabase Auth client, enabled by public env values
- `artifacts/api-server/src/routes/luxe-horizon.ts` — API preview contract handlers and seed data
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and Zod schemas
- `attached_assets/` — supplied Luxe Horizon brand reference assets

## Architecture decisions

- The public catalogue and private admin workflows share one React artifact but have separate route shells and visual priorities.
- The API uses the locked collection/product vocabulary and keeps the public catalogue filtered to active, published products.
- Supabase Auth is a real browser-side gate when configured; the preview remains usable in explicit demo mode until deployment values are provided.
- Product image bytes stay outside the API database contract; image paths are passed through the upload and product-image models for Supabase Storage integration.

## Product

Luxe Horizon can stage multi-image mobile uploads, apply AI classification suggestions, review uncertain items, manage recurring collections, publish filtered customer views, copy shareable catalogue links, generate admin-only PDF requests, and route customer enquiries to WhatsApp.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- The web build expects the workflow-provided `PORT` and `BASE_PATH`; use the managed web workflow for preview.
- Supabase public variables are deliberately optional for local preview, but production admin routes should be configured before publishing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
