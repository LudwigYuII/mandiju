// Open-Meteo 天气代码 → 展示图标
export function weatherEmoji(code: number | null | undefined): string {
  if (code == null) return "✉️";
  if (code === 0) return "☀️";
  if (code === 1) return "🌤️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌥️";
}

export function weatherLabel(code: number | null | undefined): string {
  if (code == null) return "晴";
  if (code === 0) return "晴";
  if (code === 1) return "多云转晴";
  if (code === 2) return "多云";
  if (code === 3) return "阴";
  if (code === 45 || code === 48) return "雾";
  if (code >= 51 && code <= 57) return "毛毛雨";
  if (code === 61 || code === 63 || code === 80 || code === 81) return "雨";
  if (code === 65 || code === 66 || code === 67 || code === 82) return "大雨";
  if (code === 71 || code === 73 || code === 85) return "雪";
  if (code === 75 || code === 77 || code === 86) return "大雪";
  if (code >= 95) return "雷雨";
  return "晴";
}

export type WeatherInfo = { city: string; temp: number | null; code: number | null; gust: number | null; manual: boolean };
