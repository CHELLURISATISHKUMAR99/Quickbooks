import { appBaseUrl } from "./app";

// Always emits /portal/<slug>/<path>. On real subdomain hosts the
// middleware rewrite makes the bare /<path> form work too, but emitting
// the prefixed form guarantees correctness on every host shape we ever
// serve: real subdomains (aaa.quad4consulting.com), flat preview URLs
// (quickbooks-black.vercel.app), localhost, future custom domains.
// One code path, no host detection, no React context needed — safe to
// call from any server or client component.
export function portalHref(slug: string, path: string = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/portal/${slug}${clean === "/" ? "" : clean}`;
}

// For server-side code that needs a full URL (emails, notification
// link_urls, anywhere an absolute href is required). Derives from
// NEXT_PUBLIC_APP_URL so flipping the env var re-targets every email.
export function portalAbsoluteHref(slug: string, path: string = "/"): string {
  return `${appBaseUrl()}${portalHref(slug, path)}`;
}
