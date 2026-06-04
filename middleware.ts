import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com";

// Base domains we own. A request whose host is one of these (or a subdomain
// of one) is trusted, and *.vercel.app covers preview/production deploys.
const TRUSTED_BASE_DOMAINS = ["quad4consulting.io", "quad4consulting.com"];

function isTrustedHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".vercel.app")) return true;
  return TRUSTED_BASE_DOMAINS.some(
    (base) => host === base || host.endsWith(`.${base}`),
  );
}

// Clerk's `authorizedParties` is an exact-match allowlist against the token's
// `azp` claim — it does NOT expand globs. Client portals live on dynamic
// per-client subdomains (`{slug}.quad4consulting.io`), so we compute the
// allowlist per request: authorize the request's own origin when its host is
// one we trust. Untrusted hosts yield an empty list, which Clerk treats as
// "unrestricted" — i.e. no regression versus having no allowlist at all.
function buildAuthorizedParties(req: NextRequest): string[] {
  const parties = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) parties.add(appUrl.replace(/\/$/, ""));

  const rawHost = req.headers.get("host") ?? "";
  const host = rawHost.split(":")[0];
  if (host && isTrustedHost(host)) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    parties.add(`${proto}://${rawHost}`);
  }
  return [...parties];
}

function extractSubdomain(req: NextRequest): string | null {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2) return parts[0];
    return null;
  }
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    return host.slice(0, -1 * (ROOT_DOMAIN.length + 1));
  }
  return null;
}

function rewritePath(req: NextRequest, prefix: string): NextResponse {
  const url = req.nextUrl.clone();
  if (!url.pathname.startsWith(prefix)) {
    url.pathname = `${prefix}${url.pathname === "/" ? "" : url.pathname}`;
  }
  return NextResponse.rewrite(url);
}

function isPublicPath(path: string): boolean {
  return (
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/api/webhooks/") ||
    path === "/api/health"
  );
}

export default clerkMiddleware(
  (auth, req) => {
    const path = req.nextUrl.pathname;

    // Public routes: never rewritten, never gated. Keeps a subdomain's
    // /sign-in serving the real sign-in page rather than rewriting it into
    // the portal tree.
    if (isPublicPath(path)) {
      return NextResponse.next();
    }

    // Subdomain → path prefix rewrite (mirrors the previous beforeAuth):
    // skip API and Next internals, then admin → /admin, else → /portal/{sub}.
    const sub = extractSubdomain(req);
    const rewritten =
      !path.startsWith("/api/") && !path.startsWith("/_next/") && sub
        ? sub === "admin"
          ? rewritePath(req, "/admin")
          : rewritePath(req, `/portal/${sub}`)
        : null;

    const { userId, sessionClaims, redirectToSignIn } = auth();
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    const role = (sessionClaims as
      | { publicMetadata?: { role?: string } }
      | null
      | undefined)?.publicMetadata?.role;

    if (path.startsWith("/admin")) {
      if (role !== "admin") {
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
    }
    if (path.startsWith("/portal/")) {
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      }
      if (role !== "client") {
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
    }

    return rewritten ?? NextResponse.next();
  },
  (req) => ({ authorizedParties: buildAuthorizedParties(req) }),
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
