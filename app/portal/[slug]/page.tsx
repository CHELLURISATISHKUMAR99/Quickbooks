import { redirect } from "next/navigation";
import { portalHref } from "@/lib/links/portal";

// Portal root: clients landing on aaa.<root>/ (rewritten to /portal/aaa
// by middleware) get bounced to their dashboard. Without this, the
// portal root would 404. Layout guards in app/portal/[slug]/layout.tsx
// still handle the auth and tenant checks before this page renders.
export default function PortalIndex({
  params,
}: {
  params: { slug: string };
}) {
  redirect(portalHref(params.slug, "/dashboard"));
}
