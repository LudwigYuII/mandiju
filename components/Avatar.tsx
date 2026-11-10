import { avatarFile, bgFile, imgUrl } from "@/lib/assets";

/** 判断一个用户字段是否是「上传文件」（upload:<path>） */
export function isUploaded(v: string | null | undefined): boolean {
  return String(v ?? "").startsWith("upload:");
}

/** 「我的身份」：上传背景图（毛玻璃雾化）+ 官方汉服小人；整图上传的头像仍按整图显示 */
export default function Avatar({
  pen,
  avatarId,
  bgId,
  size = 44,
  className = "",
}: {
  pen: string;
  avatarId: string;
  bgId: string;
  size?: number;
  className?: string;
}) {
  // 用户上传的整图头像：直接显示（不再叠小人）
  if (isUploaded(avatarId)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgUrl(String(avatarId).slice(7))}
        alt={pen}
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const uploadedBg = isUploaded(bgId);
  const bgSrc = uploadedBg ? imgUrl(String(bgId).slice(7)) : bgFile(bgId);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      {uploadedBg ? (
        <>
          {/* 上传背景：放大 + 模糊，模拟毛玻璃底 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgSrc}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-125 object-cover blur-[3px]"
          />
          <div className="absolute inset-0 bg-white/10" />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgSrc})` }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarFile(avatarId)}
        alt={pen}
        className="absolute bottom-0 left-1/2 h-[88%] -translate-x-1/2 drop-shadow-sm"
      />
    </div>
  );
}
