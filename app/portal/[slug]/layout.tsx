import { notFound, redirect } from "next/navigation";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { getSession } from "@/lib/auth/session";
import { getClientBySlug } from "@/lib/supabase/queries";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const client = await getClientBySlug(params.slug);
  if (!client) notFound();
  if (!client.is_active) redirect("/sign-in?reason=inactive");

  if (session.role !== "client" || session.clientId !== client.id) {
    redirect("/sign-in?reason=forbidden");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PortalHeader businessName={client.business_name} booksUpToDate />
      <div className="flex flex-1">
        <PortalSidebar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
