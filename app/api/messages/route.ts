import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/utils/api";
import { getSession } from "@/lib/auth/session";
import {
  getClientById,
  insertMessage,
  insertNotification,
} from "@/lib/supabase/queries";
import { emailNewMessage } from "@/lib/resend/send";

export const runtime = "nodejs";

const schema = z.object({
  clientId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input");
  const { clientId, body } = parsed.data;

  if (session.role === "client" && session.clientId !== clientId) {
    return fail("Forbidden", 403);
  }
  if (session.role !== "admin" && session.role !== "client") {
    return fail("Forbidden", 403);
  }

  const client = await getClientById(clientId);
  if (!client) return fail("Client not found", 404);

  const sender = session.role === "admin" ? "admin" : "client";
  const msg = await insertMessage({ clientId, senderRole: sender, body });

  if (sender === "client") {
    try {
      await emailNewMessage({
        to: process.env.RESEND_REPLY_TO ?? "satish@quad4consulting.com",
        fromName: client.business_name,
        preview: body.slice(0, 200),
        url: `https://admin.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com"}/clients/${client.id}/messages`,
      });
    } catch {
      /* ignore */
    }
  } else {
    await insertNotification({
      clientId: client.id,
      type: "message",
      title: "New message from Satish",
      message: body.slice(0, 120),
    });
    try {
      await emailNewMessage({
        to: client.email,
        fromName: "Satish",
        preview: body.slice(0, 200),
        url: `https://${client.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com"}/messages`,
      });
    } catch {
      /* ignore */
    }
  }

  return ok(msg);
}
