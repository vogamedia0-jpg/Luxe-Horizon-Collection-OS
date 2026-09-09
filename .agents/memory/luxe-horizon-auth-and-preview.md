---
name: Luxe Horizon auth and preview
description: The collection OS uses Supabase Auth in configured environments and an explicit demo fallback for previews.
---

The admin shell must keep the Supabase Auth gate when the public Supabase URL and publishable key are present. Without those values, demo mode is intentional so the visual/admin workflows remain previewable; do not replace this with local credentials or a second auth system.

**Why:** The locked V1 spec names an existing Supabase Auth setup, while the build workspace may not have deployment-specific public variables yet.

**How to apply:** Preserve the configured-vs-demo split when adding admin routes or deployment wiring, and never expose service-role credentials in browser code.