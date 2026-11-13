import { db } from "./db";
import { blockedBetween } from "./study-service";
import { canReadLetter, canInteractWithLetter } from "./letter-policy";
export async function readableLetter(id: string, userId?: string | null) {
  const row = (
    await db.execute({ sql: "SELECT * FROM letters WHERE id=?", args: [id] })
  ).rows[0] as any;
  return row && canReadLetter(row, userId) ? row : null;
}
export async function interactiveLetter(id: string, userId: string) {
  const row = await readableLetter(id, userId);
  return row && canInteractWithLetter(row, userId) && !(await blockedBetween(db,userId,String(row.author_id))) ? row : null;
}
