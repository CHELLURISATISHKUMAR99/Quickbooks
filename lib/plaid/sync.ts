import { CountryCode, Products } from "plaid";
import { getPlaid } from "./client";
import { decrypt, encrypt } from "@/lib/encryption";
import {
  getIntegration,
  insertPlaidTransactions,
  markIntegrationSynced,
  upsertIntegration,
} from "@/lib/supabase/queries";

export async function createLinkToken(input: {
  clientId: string;
  clientName: string;
}): Promise<string> {
  const plaid = getPlaid();
  const res = await plaid.linkTokenCreate({
    user: { client_user_id: input.clientId },
    client_name: input.clientName,
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return res.data.link_token;
}

export async function exchangePublicToken(input: {
  clientId: string;
  publicToken: string;
}): Promise<void> {
  const plaid = getPlaid();
  const res = await plaid.itemPublicTokenExchange({
    public_token: input.publicToken,
  });
  await upsertIntegration({
    clientId: input.clientId,
    type: "plaid",
    accessToken: encrypt(res.data.access_token),
    plaidItemId: res.data.item_id,
  });
  await initialSync(input.clientId);
}

export async function initialSync(clientId: string): Promise<number> {
  const integ = await getIntegration(clientId, "plaid");
  if (!integ) throw new Error("Plaid not connected");
  const accessToken = decrypt(integ.access_token);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  return syncRange(clientId, accessToken, start, end);
}

export async function dailySync(clientId: string): Promise<number> {
  const integ = await getIntegration(clientId, "plaid");
  if (!integ) throw new Error("Plaid not connected");
  const accessToken = decrypt(integ.access_token);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  return syncRange(clientId, accessToken, start, end);
}

async function syncRange(
  clientId: string,
  accessToken: string,
  start: Date,
  end: Date,
): Promise<number> {
  const plaid = getPlaid();
  const res = await plaid.transactionsGet({
    access_token: accessToken,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  });
  const txs = res.data.transactions.map((t) => ({
    client_id: clientId,
    plaid_transaction_id: t.transaction_id,
    account_id: t.account_id,
    date: t.date,
    description: t.name,
    amount: t.amount,
    category: t.category?.[0] ?? null,
  }));
  await insertPlaidTransactions(txs);
  await markIntegrationSynced(clientId, "plaid");
  return txs.length;
}

export interface PlaidAccountBalance {
  accountId: string;
  name: string;
  mask: string | null;
  available: number | null;
  current: number | null;
}

export async function getAccountBalances(
  clientId: string,
): Promise<PlaidAccountBalance[]> {
  const integ = await getIntegration(clientId, "plaid");
  if (!integ) return [];
  const accessToken = decrypt(integ.access_token);
  const res = await getPlaid().accountsBalanceGet({ access_token: accessToken });
  return res.data.accounts.map((a) => ({
    accountId: a.account_id,
    name: a.name,
    mask: a.mask ?? null,
    available: a.balances.available,
    current: a.balances.current,
  }));
}
