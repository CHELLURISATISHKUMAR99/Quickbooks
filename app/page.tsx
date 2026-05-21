import Link from "next/link";
import { redirect } from "next/navigation";
import { COMPANY_NAME } from "@/lib/utils/constants";
import { getSession } from "@/lib/auth/session";
import { getClientById } from "@/lib/supabase/queries";
import { portalHref } from "@/lib/links/portal";

// Marketing page serves un-signed-in users. Already-signed-in users
// land here when:
//   1. <SignIn fallbackRedirectUrl="/" /> bounces them after auth
//   2. They bookmark / share the root URL
//   3. They hit /sign-in while already signed in (Clerk redirects them
//      out, ultimately to fallbackRedirectUrl = "/")
// In all three cases, "/" is the wrong final destination. Route them
// to their proper home based on role, server-side, before render.
export default async function MarketingPage() {
  const session = await getSession();
  if (session?.role === "admin") {
    redirect("/admin/dashboard");
  }
  if (session?.role === "client" && session.clientId) {
    const client = await getClientById(session.clientId);
    if (client) {
      redirect(portalHref(client.slug, "/dashboard"));
    }
  }
  return <MarketingContent />;
}

function MarketingContent() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="q4-logo">Q4</div>
            <span className="font-semibold text-lg">{COMPANY_NAME}</span>
          </div>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-brand hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>
      <section className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Bookkeeping, organized.
          </h1>
          <p className="text-lg text-neutral-600 mb-8">
            Upload documents, see your dashboard, and let us handle the books.
            Built for small US businesses.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-block bg-brand text-white px-6 py-3 rounded-md font-medium hover:opacity-90"
            >
              Sign in to your portal
            </Link>
            <div className="text-sm text-neutral-500">
              Admin? Go to <Link href="/admin/dashboard" className="text-brand hover:underline">/admin</Link>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t border-neutral-200 bg-white text-xs text-neutral-500 py-4 text-center">
        Secured by {COMPANY_NAME}
      </footer>
    </main>
  );
}
