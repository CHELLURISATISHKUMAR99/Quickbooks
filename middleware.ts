import { authMiddleware, redirectToSignIn } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com";

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
  afterAuth: (auth, req) => {
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

    const role = (auth.sessionClaims?.publicMetadata as
      | { role?: string }
      | undefined)?.role;

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
