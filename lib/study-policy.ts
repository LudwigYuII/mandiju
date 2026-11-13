/** Shared, pure rules; no user-authored text is translated. */
export const GIFT_KINDS = {
  plum: "一枝梅",
  tea: "一盏茶",
  snow: "一片雪",
  leaf: "一枚落叶",
} as const;
export const HOLD_UNTIL = 253402300799000;
export const VISIT_COOLDOWN = 30 * 86400000;
export function plainText(value: unknown, max: number, min = 0): string {
  const text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  const length = Array.from(text).length;
  if (
    length < min ||
    length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
  )
    throw new Error("文字长度不合适，或含有无法使用的字符");
  return text;
}
export function canEnterStudy(
  owner: string,
  viewer: string | undefined,
  status?: string,
  blocked = false,
) {
  return viewer === owner || (!!viewer && !blocked && status === "accepted");
}
export function giftVisible(
  gift: { sender_id: unknown; recipient_id: unknown; available_at: unknown },
  viewer: string,
  now = Date.now(),
) {
  return (
    String(gift.sender_id) === viewer ||
    (String(gift.recipient_id) === viewer && Number(gift.available_at) <= now)
  );
}
