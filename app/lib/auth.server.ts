import { getSession, createSession as createSessionRow, deleteSession as deleteSessionRow } from "./db.server";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 2 weeks in seconds

export function getSessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1].trim() : null;
}

export async function validateSession(
  db: D1Database,
  token: string | null
): Promise<boolean> {
  if (!token) return false;
  const session = await getSession(db, token);
  if (!session) return false;
  if (new Date(session.expires_at) <= new Date()) return false;
  return true;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(db: D1Database): Promise<{
  token: string;
  expiresAt: string;
}> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await createSessionRow(db, token, expiresAt);
  return { token, expiresAt };
}

export async function destroySession(
  db: D1Database,
  token: string
): Promise<void> {
  await deleteSessionRow(db, token);
}

export function sessionCookieHeader(
  token: string,
  expiresAt: string,
  mode: "set" | "clear",
  options?: { secure?: boolean }
): string {
  const maxAge = mode === "set" ? SESSION_MAX_AGE : 0;
  const value = mode === "set" ? token : "";
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (options?.secure) {
    parts.push("Secure");
  }
  if (mode === "set") {
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  } else {
    parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  }
  return parts.join("; ");
}
