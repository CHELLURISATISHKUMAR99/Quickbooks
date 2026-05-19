import { getClientBySlug, listMessages } from "@/lib/supabase/queries";
import { notFound } from "next/navigation";
import { MessageThread } from "@/components/shared/MessageThread";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  params,
}: {
  params: { slug: string };
}) {
  const client = await getClientBySlug(params.slug);
  if (!client) notFound();
  const messages = await listMessages(client.id);
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-neutral-500">Reach out to Satish anytime.</p>
      </div>
      <MessageThread
        clientId={client.id}
        initial={messages}
        sendAs="client"
      />
    </div>
  );
}
