// Cross-browser helpers for <input type="datetime-local"> values
// iOS Safari can fail to parse "YYYY-MM-DDTHH:mm" via `new Date(value)`.

export function dateTimeLocalToISOString(value: string): string | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}
