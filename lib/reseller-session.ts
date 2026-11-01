import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { promisify } from "node:util";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "ventex_reseller_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const scryptAsync = promisify(scrypt);

export type ResellerSession = {
  userId: string;
  email: string;
  discordId: string;
  membership: "basic" | "premium";
  activatedAt: string | null;
  invitedAt: string;
};

export async function hashResellerPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt.toString("base64url")}.${derivedKey.toString("base64url")}`;
}

export async function verifyResellerPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltText, keyText, extra] = storedHash.split(".");
  if (!saltText || !keyText || extra) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expectedKey = Buffer.from(keyText, "base64url");
    if (salt.length !== 16 || expectedKey.length !== 64) return false;
    const actualKey = (await scryptAsync(password, salt, expectedKey.length)) as Buffer;
    return timingSafeEqual(expectedKey, actualKey);
  } catch {
    return false;
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createResellerSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("reseller_portal_sessions").insert({
    user_id: userId,
    token_hash: hashSessionToken(token),
    expires_at: expiresAt,
  });
  if (error) throw new Error("Could not create reseller session.");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/reseller",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getResellerSession(): Promise<ResellerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;

  const admin = createSupabaseAdminClient();
  const { data: storedSession, error: sessionError } = await admin
    .from("reseller_portal_sessions")
    .select("id, user_id, expires_at")
    .eq("token_hash", hashSessionToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError || !storedSession) return null;

  const { data: profile, error: profileError } = await admin
    .from("reseller_profiles")
    .select("email, discord_id, membership, account_status, activated_at, invited_at")
    .eq("user_id", storedSession.user_id)
    .maybeSingle();
  if (profileError || profile?.account_status !== "active") {
    await admin.from("reseller_portal_sessions").delete().eq("id", storedSession.id);
    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/reseller",
      maxAge: 0,
    });
    return null;
  }

  return {
    userId: storedSession.user_id,
    email: profile.email,
    discordId: profile.discord_id,
    membership: profile.membership,
    activatedAt: profile.activated_at,
    invitedAt: profile.invited_at,
  };
}

export async function clearResellerSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token && /^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    await createSupabaseAdminClient()
      .from("reseller_portal_sessions")
      .delete()
      .eq("token_hash", hashSessionToken(token));
  }
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/reseller",
    maxAge: 0,
  });
}
