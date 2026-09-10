import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

const client = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Luxe Horizon uses Supabase for authentication/database access and Cloudflare
 * R2 for product-image blobs. The small storage adapter below preserves the
 * existing admin upload API (`supabase.storage.from(...).upload(...)`) while
 * sending the actual file to the authenticated Cloudflare Pages Function.
 */
export const supabase = client
  ? {
      auth: client.auth,
      storage: {
        from: (_bucket: string) => ({
          upload: async (
            path: string,
            file: Blob,
            options?: { contentType?: string; upsert?: boolean },
          ) => {
            try {
              const { data } = await client.auth.getSession();
              const token = data.session?.access_token;
              if (!token) {
                return { data: null, error: new Error('Admin session is required to upload images.') };
              }

              const encodedPath = path
                .split('/')
                .map((part) => encodeURIComponent(part))
                .join('/');
              const response = await fetch(`/api/storage/${encodedPath}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': options?.contentType || file.type || 'application/octet-stream',
                  'X-Luxe-Upsert': options?.upsert ? 'true' : 'false',
                },
                body: file,
              });

              if (!response.ok) {
                return {
                  data: null,
                  error: new Error((await response.text()) || `Upload failed (${response.status})`),
                };
              }

              return {
                data: { path, fullPath: path },
                error: null,
              };
            } catch (error) {
              return {
                data: null,
                error: error instanceof Error ? error : new Error('Upload failed.'),
              };
            }
          },
        }),
      },
    }
  : null;
