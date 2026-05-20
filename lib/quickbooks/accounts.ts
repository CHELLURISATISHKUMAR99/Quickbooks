import { getValidAccessToken, qbApiBase } from "./auth";
import { upsertClientQbAccounts, type UpsertQbAccountInput } from "@/lib/supabase/queries";
import type { QbAccountClassification } from "@/types";

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

interface QbAccountApi {
  Id: string;
  Name: string;
  AccountType?: string;
  AccountSubType?: string;
  Classification?: string;
  FullyQualifiedName?: string;
  Active?: boolean;
}

interface QbAccountQueryResponse {
  QueryResponse?: { Account?: QbAccountApi[] };
}

const VALID_CLASSIFICATIONS: ReadonlySet<string> = new Set([
  "Asset",
  "Equity",
  "Expense",
  "Liability",
  "Revenue",
]);

function normalizeClassification(
  raw: string | undefined,
): QbAccountClassification | null {
  if (!raw) return null;
  return VALID_CLASSIFICATIONS.has(raw)
    ? (raw as QbAccountClassification)
    : null;
}

export async function syncAccountsForClient(clientId: string): Promise<number> {
  const { accessToken, realmId } = await getValidAccessToken(clientId);
  let startPosition = 1;
  let totalSynced = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = `SELECT Id, Name, AccountType, AccountSubType, Classification, FullyQualifiedName, Active FROM Account STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`;
    const url = `${qbApiBase()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=70`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`QB Account query failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as QbAccountQueryResponse;
    const accounts = json.QueryResponse?.Account ?? [];
    if (accounts.length === 0) break;

    const rows: UpsertQbAccountInput[] = accounts.map((a) => ({
      qbAccountId: a.Id,
      name: a.Name,
      accountType: a.AccountType ?? null,
      accountSubType: a.AccountSubType ?? null,
      classification: normalizeClassification(a.Classification),
      fullyQualifiedName: a.FullyQualifiedName ?? null,
      active: a.Active ?? true,
    }));
    await upsertClientQbAccounts(clientId, rows);
    totalSynced += accounts.length;

    if (accounts.length < PAGE_SIZE) break;
    startPosition += PAGE_SIZE;
  }

  return totalSynced;
}
