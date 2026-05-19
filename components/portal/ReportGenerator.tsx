"use client";

import { useState } from "react";
import { REPORT_TYPE_LABEL } from "@/lib/utils/constants";
import type { ReportType } from "@/types";

type RangePreset = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

interface ReportRowResult {
  label: string;
  amount: number;
}

interface ReportResult {
  rows: ReportRowResult[];
  totals: { revenue: number; expenses: number; net: number };
}

export function ReportGenerator() {
  const [type, setType] = useState<ReportType>("pnl");
  const [preset, setPreset] = useState<RangePreset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resolveRange(): { start: string; end: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (preset === "this_month") {
      return {
        start: new Date(y, m, 1).toISOString().slice(0, 10),
        end: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      };
    }
    if (preset === "last_month") {
      return {
        start: new Date(y, m - 1, 1).toISOString().slice(0, 10),
        end: new Date(y, m, 0).toISOString().slice(0, 10),
      };
    }
    if (preset === "this_quarter") {
      const q = Math.floor(m / 3);
      return {
        start: new Date(y, q * 3, 1).toISOString().slice(0, 10),
        end: new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10),
      };
    }
    if (preset === "this_year") {
      return {
        start: new Date(y, 0, 1).toISOString().slice(0, 10),
        end: new Date(y, 11, 31).toISOString().slice(0, 10),
      };
    }
    return { start: customStart, end: customEnd };
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setReportId(null);
    try {
      const { start, end } = resolveRange();
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, start, end }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { report: ReportResult; reportId: string };
        error?: string;
      };
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed");
      setResult(json.data.report);
      setReportId(json.data.reportId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Report</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {Object.entries(REPORT_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date range</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RangePreset)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="this_quarter">This quarter</option>
            <option value="this_year">This year</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="bg-brand text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50 w-full md:w-auto"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {preset === "custom" && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
            <h3 className="font-semibold">{REPORT_TYPE_LABEL[type]}</h3>
            {reportId && (
              <a
                href={`/api/reports/${reportId}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand hover:underline"
              >
                Download PDF
              </a>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Line item</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    ${r.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-neutral-200 font-semibold bg-neutral-50">
                <td className="px-4 py-2">Net</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  ${result.totals.net.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
