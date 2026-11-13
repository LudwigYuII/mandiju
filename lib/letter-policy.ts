/** Pure authorization rules, shared by queries and regression tests. */
export type LetterAccess = {
  author_id: unknown;
  recipient_id: unknown;
  deliver_at: unknown;
  postage?: unknown;
  moderation_hidden?: unknown;
  burn_seconds?: unknown;
  burned?: unknown;
};
export function canReadLetter(
  letter: LetterAccess,
  userId?: string | null,
  now = Date.now(),
): boolean {
  if (Number(letter.moderation_hidden) && String(letter.author_id) !== userId)
    return false;
  const delivered = Number(letter.deliver_at) <= now;
  if (userId && String(letter.author_id) === userId) {
    // Preserve the existing time-capsule unlock promise; pending metadata remains in the sender's box.
    return letter.postage !== "capsule" || delivered;
  }
  return (
    delivered &&
    (!letter.recipient_id ||
      (!!userId && String(letter.recipient_id) === userId))
  );
}
export function canInteractWithLetter(
  letter: LetterAccess,
  userId?: string | null,
  now = Date.now(),
): boolean {
  return (
    !!userId &&
    Number(letter.deliver_at) <= now &&
    !Number(letter.burn_seconds) &&
    !Number(letter.burned) &&
    canReadLetter(letter, userId, now)
  );
}
