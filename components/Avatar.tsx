import { avatarFile, bgFile, imgUrl } from "@/lib/assets";

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
  const isUpload = String(avatarId).startsWith("upload:");
  if (isUpload) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgUrl(String(avatarId).slice(7))}
        alt={pen}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${bgFile(bgId)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarFile(avatarId)}
        alt={pen}
        className="absolute bottom-0 left-1/2 h-[88%] -translate-x-1/2"
      />
    </div>
  );
}
