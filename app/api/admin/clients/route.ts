import { NextRequest } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { fail, ok } from "@/lib/utils/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  createClient as createClientRow,
  slugExists,
} from "@/lib/supabase/queries";
import { isValidSlug } from "@/lib/utils/slug";
import { emailWelcome } from "@/lib/resend/send";
import { portalAbsoluteHref } from "@/lib/links/portal";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const schema = z.object({
  ownerName: z.string().min(2),
  businessName: z.string().min(2),
  email: z.string().email(),
  slug: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input");
  const { ownerName, businessName, email, slug } = parsed.data;

  if (!isValidSlug(slug)) return fail("Invalid slug");
  if (await slugExists(slug)) return fail("Slug is already taken");

  const tempPassword = randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) + "1!";

  const [firstName, ...rest] = ownerName.split(/\s+/);
  const lastName = rest.join(" ");

  const user = await clerkClient.users.createUser({
    emailAddress: [email],
    password: tempPassword,
    firstName,
    lastName: lastName || undefined,
    skipPasswordChecks: false,
    skipPasswordRequirement: false,
  });

  const clientRow = await createClientRow({
    clerkUserId: user.id,
    businessName,
    ownerName,
    email,
    slug,
  });

  await clerkClient.users.updateUser(user.id, {
    publicMetadata: { role: "client", clientId: clientRow.id },
  });

  const portalUrl = portalAbsoluteHref(slug, "/dashboard");
  try {
    await emailWelcome({
      to: email,
      ownerName,
      businessName,
      portalUrl,
      tempPassword,
    });
  } catch (err) {
    console.warn("welcome email failed", err);
  }

  return ok({ clientId: clientRow.id, portalUrl });
}
