/**
 * assets.ts — Asset URL resolution helper for Aegean Tycoon
 *
 * Resolves static asset paths against Vite's configured BASE_URL so that
 * all assets load reliably in local dev, subpath hosting (GitHub Pages /aegean-tycoon-v2/),
 * or custom domain roots.
 */
export function assetUrl(path: string): string {
  // Fall back to './' if BASE_URL is not set (e.g. in test environments)
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
    ? import.meta.env.BASE_URL
    : './';

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  if (base.endsWith('/')) {
    return `${base}${cleanPath}`;
  }
  return `${base}/${cleanPath}`;
}
