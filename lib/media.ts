import { db } from "./db";
export function mediaId(ref: string) {
  return /^(?:upload:)?\/?api\/media\/([a-f0-9-]{36})$/i.exec(ref)?.[1] ?? null;
}
export async function ownedMedia(ref: string, owner: string, purpose: string) {
  const id = mediaId(ref);
  if (!id) return false;
  return (
    (
      await db.execute({
        sql: "SELECT 1 FROM media WHERE id=? AND owner_id=? AND purpose=?",
        args: [id, owner, purpose],
      })
    ).rows.length > 0
  );
}
export function mediaUrl(id: string) {
  return `api/media/${id}`;
}
