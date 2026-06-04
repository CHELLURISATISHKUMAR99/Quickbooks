import { qbApiBase } from "./auth";
import { setIntegrationBookClose } from "@/lib/supabase/queries";
import type { DocumentRow } from "@/types";

// Minor version for every push-path call. 75 is current and backward
// compatible with the entity shapes we build; bumping it here (create +
// dedup/guard reads) keeps the idempotency + guard behavior on a known
// version without re-touching the chart-of-accounts sync.
export const QB_MINOR_VERSION = 75;

type DocPeriod = Pick<DocumentRow, "year" | "month">;

// Documents are monthly buckets (year + month, no day). We post them at
// the first of the month, so that is also the date the guards reason about.
export function docPostingDate(doc: DocPeriod): string {
  return `${doc.year}-${String(doc.month).padStart(2, "0")}-01`;
}

// Inclusive first/last calendar day of the document's month, used as the
// "small date window" for the existing-transaction duplicate check.
export function monthRange(year: number, month: number): {
  start: string;
  end: string;
} {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  // Day 0 of the *next* month is the last day of this one. month is 1-based.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

// Normalize a DATE/timestamptz string down to YYYY-MM-DD for lexicographic
// comparison (ISO date strings sort chronologically).
function asDate(value: string): string {
  return value.slice(0, 10);
}

// ── Guard 2: cutover scope gate ─────────────────────────────────────
// Out of scope iff the posting date is strictly before the cutover date.
// A null cutover means "no boundary configured" → never out of scope.
export function isBeforeCutover(
  doc: DocPeriod,
  cutoverDate: string | null,
): boolean {
  if (!cutoverDate) return false;
  return docPostingDate(doc) < asDate(cutoverDate);
}

// ── Guard 3: closed-period guard ────────────────────────────────────
// Refuse to post into a period on/before the QBO book-closing date.
export function isInClosedPeriod(
  doc: DocPeriod,
  bookCloseDate: string | null,
): boolean {
  if (!bookCloseDate) return false;
  return docPostingDate(doc) <= asDate(bookCloseDate);
}

// The closing date changes rarely; cache it per realm on the warm instance
// and persist it for admin visibility / cold starts. Reads are metered, so
// we never want one Preferences read per document.
interface BookCloseCacheEntry {
  date: string | null;
  expiresAt: number;
}
const BOOK_CLOSE_CACHE = new Map<string, BookCloseCacheEntry>();
const BOOK_CLOSE_TTL_MS = 10 * 60 * 1000;

interface PreferencesResponse {
  QueryResponse?: {
    Preferences?: { AccountingInfoPrefs?: { BookCloseDate?: string } }[];
  };
}

export async function getBookCloseDate(opts: {
  accessToken: string;
  realmId: string;
  clientId: string;
}): Promise<string | null> {
  const cached = BOOK_CLOSE_CACHE.get(opts.realmId);
  if (cached && cached.expiresAt > Date.now()) return cached.date;

  const query = "SELECT * FROM Preferences";
  const url = `${qbApiBase()}/v3/company/${opts.realmId}/query?query=${encodeURIComponent(
    query,
  )}&minorversion=${QB_MINOR_VERSION}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      // Fail open: a Preferences read hiccup shouldn't halt every push.
      // Fall back to the last value we persisted, if any.
      console.warn(`QB Preferences read failed: ${res.status}`);
      return cached?.date ?? null;
    }
    const json = (await res.json()) as PreferencesResponse;
    const date =
      json.QueryResponse?.Preferences?.[0]?.AccountingInfoPrefs
        ?.BookCloseDate ?? null;
    BOOK_CLOSE_CACHE.set(opts.realmId, {
      date,
      expiresAt: Date.now() + BOOK_CLOSE_TTL_MS,
    });
    // Persist for the admin client page + cold-start fallback; non-fatal.
    await setIntegrationBookClose(opts.clientId, date).catch(() => {
      /* best effort */
    });
    return date;
  } catch (err) {
    console.warn(`QB Preferences read error: ${(err as Error).message}`);
    return cached?.date ?? null;
  }
}

// ── Guard 4: existing-transaction duplicate check ───────────────────
export interface DuplicateMatch {
  id: string;
  txnDate?: string;
  totalAmt?: number;
}

interface PurchaseQueryResponse {
  QueryResponse?: {
    Purchase?: { Id: string; TxnDate?: string; TotalAmt?: number }[];
  };
}

// Cents tolerance when comparing money so float noise never hides a match.
const AMOUNT_EPSILON = 0.005;

// Look for an existing Purchase that already represents this transaction
// before we create a new one: same amount, within the document's calendar
// month. We filter by the date window in the query (QBO doesn't reliably
// allow filtering on the computed TotalAmt for Purchase) and match the
// amount in code. Vendor would narrow this further, but documents don't
// currently capture a vendor — add `AND EntityRef = '<vendorId>'` to the
// query once they do.
//
// One bounded query per Purchase create (one month of purchases). On any
// query error we fail open and let the RequestId header + PrivateNote tag
// be the fallback against duplicates, rather than blocking the push.
export async function findDuplicatePurchase(opts: {
  accessToken: string;
  realmId: string;
  amount: number;
  year: number;
  month: number;
}): Promise<DuplicateMatch | null> {
  const { start, end } = monthRange(opts.year, opts.month);
  const query =
    `SELECT Id, TxnDate, TotalAmt FROM Purchase ` +
    `WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' MAXRESULTS 200`;
  const url = `${qbApiBase()}/v3/company/${opts.realmId}/query?query=${encodeURIComponent(
    query,
  )}&minorversion=${QB_MINOR_VERSION}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`QB duplicate-check query failed: ${res.status}`);
      return null;
    }
    const json = (await res.json()) as PurchaseQueryResponse;
    const rows = json.QueryResponse?.Purchase ?? [];
    const hit = rows.find(
      (p) =>
        typeof p.TotalAmt === "number" &&
        Math.abs(p.TotalAmt - opts.amount) < AMOUNT_EPSILON,
    );
    if (!hit) return null;
    return { id: hit.Id, txnDate: hit.TxnDate, totalAmt: hit.TotalAmt };
  } catch (err) {
    console.warn(`QB duplicate-check query error: ${(err as Error).message}`);
    return null;
  }
}
