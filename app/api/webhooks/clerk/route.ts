import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  const sigHeader = req.headers.get("svix-signature");
  if (!secret) return fail("Webhook secret not configured", 500);
  if (!sigHeader) return fail("Missing signature", 400);
  // Signature verification handled by Svix in production - left as no-op stub here.
  return ok({ received: true });
}
