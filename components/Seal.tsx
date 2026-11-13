export type SealTone = "vermilion" | "blue" | "ink" | "jade";
export type SealPattern = "plain" | "wave" | "star" | "rings";

/** 信件表里存储的火漆色（靛蓝渲染为蓝色调） */
export type LetterSealTone = "vermilion" | "indigo" | "ink" | "jade";

export const LETTER_SEAL_TONES: LetterSealTone[] = [
  "vermilion",
  "indigo",
  "ink",
  "jade",
];
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

export default function Seal({char,size=40,tone="vermilion",pattern="plain"}:{char:string;size?:number;tone?:SealTone;pattern?:SealPattern}) {
 const yin=char.startsWith('yin:');
 const chars=Array.from((yin?char.slice(4):char)||'印').slice(0,4);
 const color=TONE_COLORS[tone]||TONE_COLORS.vermilion;
 const positions=chars.length===1?[[50,52]]:chars.length===2?[[50,32],[50,71]]:chars.length===3?[[70,32],[70,70],[30,50]]:[[70,32],[70,70],[30,32],[30,70]];
 return <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={chars.join('')+(yin?'阴刻印章':'阳刻印章')}>
 <rect x="6" y="6" width="88" height="88" rx="3" fill={yin?color:'none'} stroke={color} strokeWidth="4"/>
 <rect x="13" y="13" width="74" height="74" rx="1" fill="none" stroke={yin?'var(--paper)':color} strokeWidth="1.5"/>
 {chars.map((c,i)=><text key={i} x={positions[i][0]} y={positions[i][1]} textAnchor="middle" dominantBaseline="central" fontSize={chars.length===1?57:34} fill={yin?'var(--paper)':color} fontFamily='"MdjKai","Noto Serif TC","Noto Serif SC",serif'>{c}</text>)}
 </svg>;
}
