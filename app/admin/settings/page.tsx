export default function AdminSettings() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="bg-white border border-neutral-200 rounded-lg p-5 text-sm text-neutral-600">
        <p>All environment configuration is managed via Vercel env vars.</p>
        <ul className="list-disc list-inside mt-2 text-xs text-neutral-500">
          <li>Clerk keys</li>
          <li>Supabase keys + service role</li>
          <li>QuickBooks OAuth (production)</li>
          <li>Plaid production keys</li>
          <li>Resend API key + sender domain</li>
        </ul>
      </div>
    </div>
  );
}
