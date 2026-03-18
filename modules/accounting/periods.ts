function parseIsoDate(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

export function isAccountingMonthKey(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim());
}

export function getAccountingMonthKey(value: string | null | undefined) {
  if (isAccountingMonthKey(value)) {
    return value.trim();
  }

  const parsed = parseIsoDate(value);

  if (!parsed) {
    return null;
  }

  return `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}`;
}

export function buildAccountingMonthRange(value: string | null | undefined) {
  const periodKey = getAccountingMonthKey(value);

  if (!periodKey) {
    return null;
  }

  const year = Number.parseInt(periodKey.slice(0, 4), 10);
  const month = Number.parseInt(periodKey.slice(5, 7), 10);
  const startDate = `${periodKey}-01`;
  const nextStartDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  return {
    periodKey,
    year,
    month,
    startDate,
    endDate,
    nextStartDate,
    code: periodKey,
    label: `Periodo ${periodKey}`,
  };
}

export function compareAccountingMonthKeysDesc(left: string, right: string) {
  return right.localeCompare(left);
}

export function sortAccountingMonthKeysDesc(values: Iterable<string>) {
  return Array.from(new Set(values)).sort(compareAccountingMonthKeysDesc);
}
