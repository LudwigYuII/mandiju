export default function Seal({
  char,
  size = 40,
  tone = "vermilion",
}: {
  char: string;
  size?: number;
  tone?: "vermilion" | "blue" | "ink";
}) {
  const color =
    tone === "vermilion" ? "var(--vermilion)" : tone === "blue" ? "var(--postblue)" : "var(--ink-soft)";
  const text = char || "印";
  const fontSize = text.length > 1 ? 34 : 54;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect x="7" y="7" width="86" height="86" rx="16" fill="none" stroke={color} strokeWidth="7" />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill={color}
        fontFamily='"MdjKai","LXGW WenKai","KaiTi","STKaiti","SimSun",serif'
      >
        {text}
      </text>
    </svg>
  );
}
