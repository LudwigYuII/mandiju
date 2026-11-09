export default function Stamp({
  file,
  size = 88,
  grayscale = false,
}: {
  file: string;
  size?: number;
  grayscale?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/assets/${file}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ filter: grayscale ? "grayscale(1) opacity(0.45)" : undefined }}
      className="rounded-[3px] drop-shadow-sm"
    />
  );
}
