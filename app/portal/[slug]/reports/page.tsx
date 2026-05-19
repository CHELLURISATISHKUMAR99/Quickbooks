import { ReportGenerator } from "@/components/portal/ReportGenerator";
import { getClientBySlug, listReports } from "@/lib/supabase/queries";
import { REPORT_TYPE_LABEL } from "@/lib/utils/constants";
import { formatDate } from "@/lib/utils/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  params,
}: {
  params: { slug: string };
}) {
  const client = await getClientBySlug(params.slug);
  if (!client) notFound();
  const history = await listReports(client.id);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-neutral-500">
          Generate a report from your QuickBooks data and download as PDF.
        </p>
      </div>

      <ReportGenerator />

      <section>
        <h2 className="text-lg font-semibold mb-3">History</h2>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Report</th>
                <th className="px-4 py-2">Range</th>
                <th className="px-4 py-2">Generated</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-neutral-500"
                  >
                    No reports yet
                  </td>
                </tr>
              )}
              {history.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2">{REPORT_TYPE_LABEL[r.report_type]}</td>
                  <td className="px-4 py-2">
                    {formatDate(r.date_range_start)} – {formatDate(r.date_range_end)}
                  </td>
                  <td className="px-4 py-2">{formatDate(r.generated_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/api/reports/${r.id}/pdf`}
                      className="text-brand hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
