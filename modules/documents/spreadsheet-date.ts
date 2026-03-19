import { roundCurrency } from "@/modules/accounting";

function formatIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || year < 1900
    || year > 2200
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseLocalizedNumber(value: string) {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{1,4}(?:\D|$))/g, ".")
    .replace(/[^0-9.\-]/g, "");

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? roundCurrency(parsed) : null;
}

export function parseSpreadsheetDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  const isoWithOptionalTime = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(normalized);

  if (isoWithOptionalTime) {
    const year = Number.parseInt(isoWithOptionalTime[1], 10);
    const month = Number.parseInt(isoWithOptionalTime[2], 10);
    const day = Number.parseInt(isoWithOptionalTime[3], 10);

    return isValidCalendarDate(year, month, day)
      ? formatIsoDate(year, month, day)
      : null;
  }

  const delimitedDate = /^(\d{1,4})([\/.-])(\d{1,2})\2(\d{1,4})(?:[T\s].*)?$/.exec(normalized);

  if (delimitedDate) {
    const left = Number.parseInt(delimitedDate[1], 10);
    const middle = Number.parseInt(delimitedDate[3], 10);
    const rightRaw = Number.parseInt(delimitedDate[4], 10);

    if (delimitedDate[1].length === 4) {
      const year = left;
      const month = middle;
      const day = rightRaw;

      return isValidCalendarDate(year, month, day)
        ? formatIsoDate(year, month, day)
        : null;
    }

    const day = left;
    const month = middle;
    const year = rightRaw < 100 ? 2000 + rightRaw : rightRaw;

    return isValidCalendarDate(year, month, day)
      ? formatIsoDate(year, month, day)
      : null;
  }

  if (/^-?\d+(?:[.,]\d+)?$/.test(normalized)) {
    const numericValue = parseLocalizedNumber(normalized);

    if (typeof numericValue === "number") {
      const wholeDays = Math.floor(numericValue);

      if (wholeDays < 1 || wholeDays > 400_000) {
        return null;
      }

      const epoch = Date.UTC(1899, 11, 30);
      const date = new Date(epoch + (wholeDays * 86_400_000));

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date.toISOString().slice(0, 10);
    }
  }

  return null;
}
