import { listClients } from "@/lib/supabase/queries";
import { ClientListClient } from "@/components/admin/ClientListClient";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const clients = await listClients();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Clients</h1>
      <ClientListClient clients={clients} />
    </div>
  );
}
