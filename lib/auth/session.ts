import { auth, clerkClient } from "@clerk/nextjs/server";
import type { ClerkPublicMetadata } from "@/types";

export interface SessionInfo {
  userId: string;
  role: "client" | "admin" | null;
  clientId: string | null;
}

export async function getSession(): Promise<SessionInfo | null> {
  const { userId } = auth();
  if (!userId) return null;
  const user = await clerkClient.users.getUser(userId);
  const meta = user.publicMetadata as ClerkPublicMetadata;
  return {
    userId,
    role: meta.role ?? null,
    clientId: meta.clientId ?? null,
  };
}

export async function requireAdmin(): Promise<SessionInfo> {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  if (s.role !== "admin") throw new Error("Forbidden");
  return s;
}

export async function requireClient(): Promise<SessionInfo> {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  if (s.role !== "client" || !s.clientId) throw new Error("Forbidden");
  return s;
}
