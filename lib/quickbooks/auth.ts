import { encrypt, decrypt } from "@/lib/encryption";
import {
  getIntegration,
  upsertIntegration,
} from "@/lib/supabase/queries";

const INTUIT_BASE =
  process.env.QB_ENVIRONMENT === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export function getAuthorizationUrl(state: string): string {
  const clientId = required("QB_CLIENT_ID");
  const redirect = required("QB_REDIRECT_URI");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: required("QB_REDIRECT_URI"),
    }),
  });
  if (!res.ok) {
    throw new Error(`QB token exchange failed: ${res.status}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`QB token refresh failed: ${res.status}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function saveTokens(
  clientId: string,
  tokens: TokenResponse,
  realmId: string,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000,
  ).toISOString();
  await upsertIntegration({
    clientId,
    type: "quickbooks",
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    tokenExpiresAt: expiresAt,
    realmId,
  });
}

export async function getValidAccessToken(
  clientId: string,
): Promise<{ accessToken: string; realmId: string }> {
  const integ = await getIntegration(clientId, "quickbooks");
  if (!integ) throw new Error("QuickBooks not connected for this client");
  if (!integ.realm_id) throw new Error("QuickBooks realm ID missing");

  const expiresAt = integ.token_expires_at
    ? new Date(integ.token_expires_at).getTime()
    : 0;
  const skewMs = 5 * 60 * 1000;
  if (Date.now() < expiresAt - skewMs) {
    return {
      accessToken: decrypt(integ.access_token),
      realmId: integ.realm_id,
    };
  }
  if (!integ.refresh_token) {
    throw new Error("QuickBooks access expired — reauth required");
  }
  const refreshed = await refreshAccessToken(decrypt(integ.refresh_token));
  await saveTokens(clientId, refreshed, integ.realm_id);
  return {
    accessToken: refreshed.access_token,
    realmId: integ.realm_id,
  };
}

export function qbApiBase(): string {
  return INTUIT_BASE;
}

function basicAuth(): string {
  const id = required("QB_CLIENT_ID");
  const secret = required("QB_CLIENT_SECRET");
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}
