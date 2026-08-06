/**
 * T-B6 — product image URL origin allowlist.
 *
 * Product `imageUrl` is rendered into <Image>/<img> on public surfaces, so only
 * trusted origins may be stored:
 *   - a local asset path (`/icons/...`, a single leading slash — project-owned),
 *   - the app's own Supabase storage origin (served off NEXT_PUBLIC_SUPABASE_URL),
 *   - or any `.supabase.co/storage/...` object URL.
 * Every other scheme-origin (external hosts, javascript:, data:, etc.) is
 * rejected server-side so a manager edit can't inject an arbitrary URL.
 */
const LOCAL_PATH_RE = /^\/(?!\/)/;

export function sanitizeImageUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;

  if (LOCAL_PATH_RE.test(value)) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null; // not parseable as a URL → disallowed
  }

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseOrigin = envUrl ? new URL(envUrl).origin : null;
  if (supabaseOrigin && parsed.origin === supabaseOrigin) return value;

  const isSupabaseStorage =
    parsed.hostname.endsWith(".supabase.co") && parsed.pathname.startsWith("/storage/");
  if (isSupabaseStorage) return value;

  return null;
}
