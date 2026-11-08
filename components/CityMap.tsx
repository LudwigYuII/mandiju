"use client";

import { useEffect, useRef } from "react";

const COORDS: Record<string, [number, number]> = {
  北京: [116.4, 39.9], 上海: [121.47, 31.23], 杭州: [120.15, 30.28], 广州: [113.26, 23.13],
  深圳: [114.06, 22.55], 成都: [104.07, 30.57], 重庆: [106.55, 29.56], 武汉: [114.3, 30.59],
  西安: [108.94, 34.34], 南京: [118.8, 32.06], 苏州: [120.6, 31.3], 天津: [117.2, 39.1],
  长沙: [112.94, 28.23], 郑州: [113.6, 34.75], 济南: [117.0, 36.65], 青岛: [120.38, 36.07],
  大连: [121.6, 38.9], 沈阳: [123.4, 41.8], 哈尔滨: [126.5, 45.8], 长春: [125.3, 43.9],
  福州: [119.3, 26.08], 厦门: [118.09, 24.48], 昆明: [102.7, 25.04], 贵阳: [106.6, 26.65],
  南宁: [108.3, 22.82], 海口: [110.3, 20.04], 石家庄: [114.5, 38.04], 太原: [112.5, 37.87],
  呼和浩特: [111.7, 40.84], 兰州: [103.8, 36.06], 西宁: [101.78, 36.62], 银川: [106.2, 38.47],
  乌鲁木齐: [87.6, 43.8], 拉萨: [91.1, 29.65], 合肥: [117.2, 31.8], 南昌: [115.9, 28.68],
  宁波: [121.5, 29.87], 无锡: [120.3, 31.49], 常州: [119.95, 31.79], 徐州: [117.2, 34.2],
  温州: [120.7, 28.0], 珠海: [113.55, 22.27], 东莞: [113.75, 23.02], 佛山: [113.1, 23.02],
  汕头: [116.68, 23.35], 三亚: [109.5, 18.25], 桂林: [110.28, 25.28], 洛阳: [112.45, 34.6],
  烟台: [121.45, 37.46], 潍坊: [119.1, 36.7], 威海: [122.1, 37.5], 香港: [114.17, 22.28],
  澳门: [113.55, 22.2], 台北: [121.5, 25.05],
};

export default function CityMap({ data }: { data: { city: string; count: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let chart: any = null;
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await import("echarts");
        const echarts = mod.default ?? mod;
        const geo = await (await fetch("/geo/china.json")).json();
        if (cancelled || !ref.current) return;
        echarts.registerMap("china", geo);
        chart = echarts.init(ref.current, undefined, { renderer: "svg" });
        const points = data
          .filter((d) => COORDS[d.city])
          .map((d) => ({
            name: d.city,
            value: [...COORDS[d.city], d.count],
          }));
        chart.setOption({
          backgroundColor: "transparent",
          tooltip: {
            trigger: "item",
            formatter: (p: any) =>
              p.name ? `${p.name} · ${p.value ? p.value[2] : 0} 封信` : "",
          },
          geo: {
            map: "china",
            roam: false,
            itemStyle: {
              areaColor: "#efe7d3",
              borderColor: "#c9bda0",
              borderWidth: 0.8,
            },
            emphasis: { itemStyle: { areaColor: "#e7dcc0" }, label: { show: false } },
          },
          series: [
            {
              name: "足迹",
              type: "scatter",
              coordinateSystem: "geo",
              data: points,
              symbolSize: (v: number[]) => Math.min(8 + v[2] * 3, 26),
              itemStyle: { color: "#c03a2b", opacity: 0.9 },
              label: {
                show: true,
                position: "right",
                formatter: "{b}",
                color: "#6e6455",
                fontSize: 10,
              },
            },
            {
              name: "最近",
              type: "effectScatter",
              coordinateSystem: "geo",
              data: points.slice(0, 1),
              symbolSize: 12,
              showEffectOn: "render",
              rippleEffect: { brushType: "stroke", scale: 3 },
              itemStyle: { color: "#c03a2b" },
            },
          ],
        });
        const onResize = () => chart?.resize();
        window.addEventListener("resize", onResize);
        (chart as any).__cleanup = onResize;
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (chart) {
        const onResize = (chart as any).__cleanup;
        if (onResize) window.removeEventListener("resize", onResize);
        chart.dispose();
      }
    };
  }, [data]);

  const unknown = data.filter((d) => !COORDS[d.city]);

  return (
    <div>
      <div ref={ref} className="h-[380px] w-full" />
      {unknown.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {unknown.map((d) => (
            <span key={d.city} className="rounded-full border border-vermilion/30 px-3 py-1 text-xs text-vermilion">
              {d.city} × {d.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
