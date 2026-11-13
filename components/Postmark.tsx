import { UiText } from "@/components/UiText";

import { siteDateKey } from "@/lib/time";
import { useId } from "react";
import { fmtTime } from "@/lib/delivery";

/**
 * 仿真邮政日戳（参考邮电部《邮电日戳印模规格与使用管理规定》）
 * 上环地名（以戳面中心为指向、自顶部中间向两边延伸）＋中部年月日＋下环「邮局」＋左侧五条正弦水波纹
 */
export default function Postmark({
  city,
  time,
  size = 96,
  firstDay = false,
}: {
  city?: string | null;
  time: number;
  size?: number;
  firstDay?: boolean;
}) {
  const dateStr = siteDateKey(new Date(time)).replaceAll("-", "·");
  const stampId = useId().replaceAll(":", "");
  const cityLabel = (city || "慢递").slice(0, 6);
  const c = "var(--vermilion)";
  const font =
    '"MdjFang","Zhuque Fangsong","FangSong","STFangsong","SimSun",serif';
  return (
    <div className="relative flex flex-col items-center" title="官戳">
      {firstDay && (
        <span className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-vermilion px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
          <UiText text={"首日"} />
        </span>
      )}
      <svg
        width={size}
        height={size * 0.8}
        viewBox="0 0 150 120"
        aria-label="官戳"
      >
        <defs>
          <path id={`${stampId}-top`} d="M 33 60 a 55 55 0 0 1 110 0" />
          <path id={`${stampId}-bottom`} d="M 33 60 a 55 55 0 0 0 110 0" />
        </defs>

        {/* 五条正弦水波纹 */}
        <g stroke={c} fill="none" strokeWidth="1.1" opacity="0.8">
          {[46, 52, 58, 64, 70].map((y) => (
            <path key={y} d={`M2 ${y} q2.5 -2.1 5 0 t5 0 t5 0`} />
          ))}
        </g>

        {/* 圆戳：外圈实线 + 内圈细线 */}
        <circle
          cx="88"
          cy="60"
          r="55"
          fill="none"
          stroke={c}
          strokeWidth="1.9"
        />
        <circle
          cx="88"
          cy="60"
          r="47.5"
          fill="none"
          stroke={c}
          strokeWidth="0.9"
          opacity="0.45"
        />

        {/* 上环：城市名，顶部中间向两边延伸 */}
        <text fontSize="13" fill={c} letterSpacing="2.5" fontFamily={font}>
          <textPath
            href={`#${stampId}-top`}
            startOffset="50%"
            textAnchor="middle"
          >
            {cityLabel}
          </textPath>
        </text>

        {/* 下环：邮局 */}
        <text fontSize="12" fill={c} letterSpacing="3" fontFamily={font}>
          <textPath
            href={`#${stampId}-bottom`}
            startOffset="50%"
            textAnchor="middle"
          >
            <UiText text={"邮 局"} />
          </textPath>
        </text>

        {/* 中部：年月日 */}
        <text
          x="88"
          y="66"
          textAnchor="middle"
          fontSize="12.5"
          fill={c}
          fontWeight="600"
          letterSpacing="0.6"
          fontFamily={font}
        >
          {dateStr}
        </text>
      </svg>
      <span className="mt-1 text-xs tracking-wider text-ink-soft">
        {fmtTime(time)}
      </span>
    </div>
  );
}
