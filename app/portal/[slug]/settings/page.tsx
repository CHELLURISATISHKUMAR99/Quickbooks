import { getClientBySlug, getIntegration } from "@/lib/supabase/queries";
import { PlaidConnectButton } from "@/components/portal/PlaidConnectButton";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils/format";
import { tenantHost } from "@/lib/links/app";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: { slug: string };
}) {
  const client = await getClientBySlug(params.slug);
  if (!client) notFound();
  const plaid = await getIntegration(client.id, "plaid");

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h2 className="font-semibold mb-2">Business</h2>
        <dl className="text-sm grid grid-cols-2 gap-y-2">
          <dt className="text-neutral-500">Business name</dt>
          <dd>{client.business_name}</dd>
          <dt className="text-neutral-500">Owner</dt>
          <dd>{client.owner_name}</dd>
          <dt className="text-neutral-500">Email</dt>
          <dd>{client.email}</dd>
          <dt className="text-neutral-500">Portal</dt>
          <dd>{tenantHost(client.slug)}</dd>
        </dl>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h2 className="font-semibold mb-1">Bank connection</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Securely connect your bank via Plaid. We never see your credentials.
        </p>
        {plaid ? (
          <div className="text-sm">
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-800 border border-green-200 rounded-full px-3 py-1 mb-3">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Connected {plaid.connected_at && `on ${formatDate(plaid.connected_at)}`}
            </div>
            <PlaidConnectButton connected />
          </div>
        ) : (
          <PlaidConnectButton connected={false} />
        )}
      </section>
    </div>
  );
}
