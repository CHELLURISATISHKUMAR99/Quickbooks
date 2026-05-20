// Single source-of-truth for absolute URLs the server emits — emails,
// notification link_urls, OAuth callback redirects, etc. Drives off
// NEXT_PUBLIC_APP_URL so flipping the env var (from the Vercel preview
// URL to the real production domain) re-targets every outbound URL
// without touching code.
const DEFAULT_APP_URL = "https://quickbooks-black.vercel.app";
const DEFAULT_ROOT_DOMAIN = "quad4consulting.com";

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
}

// For display labels ("Portal: aaa.quad4consulting.com"). Drives off
// NEXT_PUBLIC_ROOT_DOMAIN so labels stay accurate across environments.
// NEXT_PUBLIC_* env vars are inlined at build time, so this is safe to
// call from client components.
export function rootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? DEFAULT_ROOT_DOMAIN;
}

export function tenantHost(slug: string): string {
  return `${slug}.${rootDomain()}`;
}

export function adminAbsoluteHref(path: string = "/dashboard"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${appBaseUrl()}/admin${clean}`;
}
