import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  type PlaidEnvironments as Envs,
} from "plaid";

let plaidClient: PlaidApi | null = null;

export function getPlaid(): PlaidApi {
  if (plaidClient) return plaidClient;
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof Envs;
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
      },
    },
  });
  plaidClient = new PlaidApi(config);
  return plaidClient;
}
