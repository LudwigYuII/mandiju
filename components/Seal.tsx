export type SealTone = "vermilion" | "blue" | "ink" | "jade";
export type SealPattern = "plain" | "wave" | "star" | "rings";

/** 信件表里存储的火漆色（靛蓝渲染为蓝色调） */
export type LetterSealTone = "vermilion" | "indigo" | "ink" | "jade";

export const LETTER_SEAL_TONES: LetterSealTone[] = ["vermilion", "indigo", "ink", "jade"];
export const SEAL_PATTERNS: SealPattern[] = ["plain", "wave", "star", "rings"];

/** 归一化数据库里的火漆色（旧信可能为空，回落朱红） */
export function sealToneOf(v: string | null | undefined): LetterSealTone {
  return (LETTER_SEAL_TONES as string[]).includes(String(v))
    ? (String(v) as LetterSealTone)
    : "vermilion";
}

/** 归一化数据库里的火漆纹样（旧信可能为空，回落素面） */
export function sealPatternOf(v: string | null | undefined): SealPattern {
  return (SEAL_PATTERNS as string[]).includes(String(v))
    ? (String(v) as SealPattern)
    : "plain";
}

/** 靛蓝（indigo）在印章渲染里对应蓝色调（blue） */
export function sealToneToRender(t: LetterSealTone): SealTone {
  return t === "indigo" ? "blue" : t;
}

const TONE_COLORS: Record<SealTone, string> = {
  vermilion: "var(--vermilion)",
  blue: "var(--postblue)",
  ink: "var(--ink-soft)",
  jade: "var(--jade, #3f7d6e)",
};

/** 四角小星点 */
function starPath(cx: number, cy: number, r: number) {
  const i = r * 0.34;
  return `M ${cx} ${cy - r} L ${cx + i} ${cy - i} L ${cx + r} ${cy} L ${cx + i} ${cy + i} L ${cx} ${cy + r} L ${cx - i} ${cy + i} L ${cx - r} ${cy} L ${cx - i} ${cy - i} Z`;
}

export default function Seal({
  char,
  size = 40,
  tone = "vermilion",
  pattern = "plain",
}: {
  char: string;
  size?: number;
  tone?: SealTone;
  pattern?: SealPattern;
}) {
  const color = TONE_COLORS[tone] ?? TONE_COLORS.vermilion;
  const text = char || "印";
  const fontSize = text.length > 1 ? 34 : 54;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect x="7" y="7" width="86" height="86" rx="16" fill="none" stroke={color} strokeWidth="7" />

      {/* 纹样：水波（底部两行细波纹） */}
      {pattern === "wave" && (
        <g stroke={color} fill="none" strokeWidth="2" strokeLinecap="round" opacity="0.85">
          <path d="M22 82 q3 -2.6 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" />
          <path d="M22 87.5 q3 -2.6 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" opacity="0.5" />
        </g>
      )}

      {/* 纹样：星光（四角小星点） */}
      {pattern === "star" && (
        <g fill={color} opacity="0.9">
          {[
            [25, 25],
            [75, 25],
            [25, 75],
            [75, 75],
          ].map(([cx, cy]) => (
            <path key={`${cx}-${cy}`} d={starPath(cx, cy, 3.4)} />
          ))}
        </g>
      )}

      {/* 纹样：回纹（框内一圈细回纹线） */}
      {pattern === "rings" && (
        <rect
          x="19"
          y="19"
          width="62"
          height="62"
          rx="9"
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeDasharray="4.5 3"
          opacity="0.75"
        />
      )}

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
