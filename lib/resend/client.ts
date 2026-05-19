import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  client = new Resend(key);
  return client;
}

export function fromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ?? "portal@quad4consulting.com"
  );
}

export function replyToAddress(): string {
  return (
    process.env.RESEND_REPLY_TO ?? "satish@quad4consulting.com"
  );
}
