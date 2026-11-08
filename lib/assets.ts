// 客户端安全的素材辅助（仅依赖 manifest.json，不依赖 Node API/数据库）
import manifest from "@/data/manifest.json";

export const stampPath = (file: string) => `/assets/${file}`;

export function avatarFile(id: string): string {
  const a = (manifest.avatars as any[]).find((x) => x.id === id) ?? (manifest.avatars as any[])[0];
  return `/assets/${a.file}`;
}

export function bgFile(id: string): string {
  const b =
    (manifest.backgrounds as any[]).find((x) => x.id === id) ?? (manifest.backgrounds as any[])[0];
  return `/assets/${b.file}`;
}

export function stampDefById(id: string) {
  return (manifest.stamps as any[]).find((s) => s.id === id) ?? null;
}

/** 图片地址兼容：R2 绝对地址直接返回，本地相对地址补斜杠 */
export function imgUrl(p: string | null | undefined): string {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `/${p}`;
}
