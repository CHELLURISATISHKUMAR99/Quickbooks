"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  ALLOWED_EXT,
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  MONTHS,
} from "@/lib/utils/constants";
import type { DocumentCategory } from "@/types";
import { formatBytes } from "@/lib/utils/format";

interface QueuedFile {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

export function DocumentUpload() {
  const now = new Date();
  const [category, setCategory] = useState<DocumentCategory>("receipts");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: MAX_FILE_SIZE_BYTES,
    onDrop: (accepted, rejected) => {
      const queued: QueuedFile[] = accepted.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "queued",
      }));
      const errored: QueuedFile[] = rejected.map((r) => ({
        id: crypto.randomUUID(),
        file: r.file,
        status: "error",
        error: r.errors[0]?.message ?? "Rejected",
      }));
      setFiles((prev) => [...prev, ...queued, ...errored]);
    },
  });

  async function uploadAll() {
    setSubmitting(true);
    setResultMessage(null);
    let successCount = 0;
    for (const qf of files) {
      if (qf.status !== "queued") continue;
      setFiles((prev) =>
        prev.map((p) => (p.id === qf.id ? { ...p, status: "uploading" } : p)),
      );
      const fd = new FormData();
      fd.append("file", qf.file);
      fd.append("category", category);
      fd.append("month", String(month));
      fd.append("year", String(year));
      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (json.success) {
          successCount++;
          setFiles((prev) =>
            prev.map((p) => (p.id === qf.id ? { ...p, status: "done" } : p)),
          );
        } else {
          setFiles((prev) =>
            prev.map((p) =>
              p.id === qf.id
                ? { ...p, status: "error", error: json.error ?? "Failed" }
                : p,
            ),
          );
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((p) =>
            p.id === qf.id
              ? { ...p, status: "error", error: (err as Error).message }
              : p,
          ),
        );
      }
    }
    setSubmitting(false);
    if (successCount > 0) {
      setResultMessage(
        `${successCount} file${successCount === 1 ? "" : "s"} uploaded — pending review`,
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Category</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {DOCUMENT_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`text-left p-3 rounded-md border ${
                category === c.value
                  ? "border-brand bg-brand-50"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <div className="font-medium text-sm">{c.label}</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {c.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer ${
          isDragActive
            ? "border-brand bg-brand-50"
            : "border-neutral-300 bg-white hover:bg-neutral-50"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-neutral-600">
          {isDragActive
            ? "Drop files here…"
            : "Drag files or click to browse"}
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          Accepted: {ALLOWED_EXT.join(", ")} · Max 10MB each
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((qf) => (
            <li
              key={qf.id}
              className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{qf.file.name}</div>
                <div className="text-xs text-neutral-500">
                  {formatBytes(qf.file.size)}
                </div>
              </div>
              <div className="text-xs">
                {qf.status === "queued" && (
                  <span className="text-neutral-500">Queued</span>
                )}
                {qf.status === "uploading" && (
                  <span className="text-brand">Uploading…</span>
                )}
                {qf.status === "done" && (
                  <span className="text-green-600">✓ Uploaded</span>
                )}
                {qf.status === "error" && (
                  <span className="text-red-600">✗ {qf.error}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {resultMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-md p-3">
          {resultMessage}
        </div>
      )}

      <button
        type="button"
        onClick={() => void uploadAll()}
        disabled={
          submitting || files.filter((f) => f.status === "queued").length === 0
        }
        className="bg-brand text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {submitting ? "Uploading…" : "Upload all"}
      </button>
    </div>
  );
}
