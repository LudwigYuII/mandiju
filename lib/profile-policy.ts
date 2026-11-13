export function validBirthday(value: string) {
  if (!/^(?:\d{4}-)?\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split("-").map(Number);
  const [year, month, day] = parts.length === 3 ? parts : [2000, ...parts];
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1)
    return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
