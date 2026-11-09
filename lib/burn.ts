// 阅后即焚：纯常量与判定（客户端可安全引用，勿在此 import 数据库）
export const BURN_OPTIONS = [30, 60, 180] as const;

export function burnLabel(seconds: number): string {
  return seconds === 30 ? "30 秒" : seconds === 60 ? "1 分钟" : "3 分钟";
}
