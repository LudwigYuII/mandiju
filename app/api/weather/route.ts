import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  if (!lat || !lon) {
    return Response.json({ error: "缺少坐标" }, { status: 400 });
  }

  let temp: number | null = null;
  let code: number | null = null;
  let gust: number | null = null;
  let city = "";

  try {
    const w = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_gusts_10m`,
      { cache: "no-store" }
    );
    if (w.ok) {
      const j = await w.json();
      temp = j?.current?.temperature_2m ?? null;
      code = j?.current?.weather_code ?? null;
      gust = j?.current?.wind_gusts_10m ?? null;
    }
  } catch {}

  try {
    const g = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=zh`,
      { headers: { "User-Agent": "mandiju/0.1 (personal site)" }, cache: "no-store" }
    );
    if (g.ok) {
      const gj = await g.json();
      city = gj?.address?.city || gj?.address?.town || gj?.address?.county || gj?.address?.state || "";
    }
  } catch {}

  return Response.json({ city, temp, code, gust });
}
