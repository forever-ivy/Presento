export function sqlText(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

export function sqlTimestamp(value: string | null | undefined) {
  if (!value) return "NULL";
  return `${sqlText(value)}::timestamptz`;
}

export function sqlJson(value: unknown) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

export function sqlBoolean(value: boolean) {
  return value ? "true" : "false";
}

export function sqlNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.max(0, Math.trunc(value)));
}
