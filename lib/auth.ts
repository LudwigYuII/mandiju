import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const secret = new TextEncoder().encode(
  process.env.MDJ_SECRET || "mandiju-dev-secret-change-me-in-production"
);

export type Session = { uid: string; pen: string };

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get("mdj_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const uid = String(payload.uid);
    // 每日首次登录自动发 300 文
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await db.execute({
      sql: "UPDATE users SET coins = coins + 300, last_coin_at = ? WHERE id = ? AND (last_coin_at IS NULL OR last_coin_at < ?)",
      args: [Date.now(), uid, today.getTime()],
    });
    return { uid, pen: String(payload.pen) };
  } catch {
    return null;
  }
}

export async function createSession(uid: string, pen: string) {
  const token = await new SignJWT({ uid, pen })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const store = await cookies();
  store.set("mdj_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete("mdj_session");
}
