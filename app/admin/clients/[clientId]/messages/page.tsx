import { getClientById, listMessages } from "@/lib/supabase/queries";
import { notFound } from "next/navigation";
import { MessageThread } from "@/components/shared/MessageThread";

export const dynamic = "force-dynamic";

export default async function ClientMessagesPage({
  params,
}: {
  params: { clientId: string };
}) {
  const client = await getClientById(params.clientId);
  if (!client) notFound();
  const messages = await listMessages(client.id);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">{client.business_name} — Messages</h1>
      <MessageThread clientId={client.id} initial={messages} sendAs="admin" />
    </div>
  );
}
