import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
function secret() {
  const value = process.env.MDJ_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32))
    throw new Error(
      "MDJ_SECRET must be configured with at least 32 characters",
    );
  return new TextEncoder().encode(
    value || "local-development-only-do-not-deploy",
  );
}
export type Session = { uid: string; pen: string };
export async function getSession(): Promise<Session | null> {
  const key = secret();
  const token = (await cookies()).get("mdj_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string") return null;
    const u = (
      await db.execute({
        sql: "SELECT pen_name, banned, auth_version FROM users WHERE id=?",
        args: [payload.uid],
      })
    ).rows[0];
    if (
      !u ||
      Number(u.banned) ||
      Number(payload.av ?? 0) !== Number(u.auth_version)
    )
      return null;
    return { uid: payload.uid, pen: String(u.pen_name) };
  } catch {
    return null;
  }
}
export async function createSession(uid: string, pen: string) {
  const u = (
    await db.execute({
      sql: "SELECT auth_version FROM users WHERE id=?",
      args: [uid],
    })
  ).rows[0];
  const token = await new SignJWT({
    uid,
    pen,
    av: Number(u?.auth_version ?? 0),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set("mdj_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 2592000,
  });
}
export async function clearSession() {
  (await cookies()).delete("mdj_session");
}
