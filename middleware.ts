import { authMiddleware, clerkClient, redirectToSignIn } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com";

// Why this exists: Clerk Development instances don't include
// `publicMetadata` in the session JWT by default. The dashboard fix
// (Sessions -> "Customize session token" -> add publicMetadata)
// wasn't applied to our instance, so `auth.sessionClaims.publicMetadata`
// is undefined here even when the user object has role/clientId set.
// Without this fallback, every signed-in admin/client gets redirected
// to /sign-in, which then bounces them to / via signInFallbackRedirectUrl
// because <SignIn> won't render for an already-signed-in user. Dead end.
//
// Fast path: read from claims (zero-latency; works automatically if the
// JWT template is ever configured). Slow path: fetch the user from
// Clerk's API and cache per warm function instance for 60s, since
// middleware runs on every request and we don't want to hit Clerk's
// API on each one. Bounded by user count (admin + handful of clients),
// no eviction policy needed.
interface CachedMetadata {
  role: string | null;
  clientId: string | null;
  expiresAt: number;
}
const METADATA_CACHE = new Map<string, CachedMetadata>();
const METADATA_TTL_MS = 60_000;

async function resolveUserMetadata(
  userId: string,
  sessionClaims: Record<string, unknown> | null | undefined,
): Promise<{ role: string | null; clientId: string | null }> {
  const claimed = sessionClaims?.publicMetadata as
    | { role?: string; clientId?: string }
    | undefined;
  if (claimed?.role) {
    return { role: claimed.role, clientId: claimed.clientId ?? null };
  }
  const cached = METADATA_CACHE.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { role: cached.role, clientId: cached.clientId };
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    const meta = user.publicMetadata as { role?: string; clientId?: string };
    const resolved = {
      role: meta.role ?? null,
      clientId: meta.clientId ?? null,
    };
    METADATA_CACHE.set(userId, {
      ...resolved,
      expiresAt: Date.now() + METADATA_TTL_MS,
    });
    return resolved;
  } catch (err) {
    // Fail closed: treat as no role. The redirect target is /sign-in,
    // which is a public route, so we don't infinite-loop — the user
    // lands at / (marketing) via signInFallbackRedirectUrl. Worst case
    // a Clerk API outage makes admin pages temporarily inaccessible.
    console.warn(
      `Clerk getUser failed for ${userId}:`,
      (err as Error).message,
    );
    return { role: null, clientId: null };
  }
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
  // portal.<root> is the app's primary user-facing entry point: the
  // sign-in page and any links from emails land here. No rewrite —
  // serves /sign-in and /portal/* paths directly. Distinct from
  // admin.<root> (admin app) and <slug>.<root> (tenant portals).
  if (host === `portal.${ROOT_DOMAIN}`) return null;
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

export default authMiddleware({
  publicRoutes: [
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/webhooks/(.*)",
    "/api/health",
  ],
  beforeAuth: (req) => {
    const sub = extractSubdomain(req);
    const path = req.nextUrl.pathname;

    if (path.startsWith("/api/") || path.startsWith("/_next/")) {
      return NextResponse.next();
    }

    if (!sub) {
      return NextResponse.next();
    }

    if (sub === "admin") {
      return rewritePath(req, "/admin");
    }

    return rewritePath(req, `/portal/${sub}`);
  },
  afterAuth: async (auth, req) => {
    const path = req.nextUrl.pathname;

    if (path.startsWith("/sign-in") || path.startsWith("/sign-up")) {
      return NextResponse.next();
    }
    if (path.startsWith("/api/webhooks/") || path === "/api/health") {
      return NextResponse.next();
    }

    if (!auth.userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    const { role } = await resolveUserMetadata(
      auth.userId,
      auth.sessionClaims as Record<string, unknown> | undefined,
    );

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
    return NextResponse.next();
  },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
