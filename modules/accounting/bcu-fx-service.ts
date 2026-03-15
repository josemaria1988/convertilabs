const DEFAULT_BCU_HANDLER_URL = "https://www.bcu.gub.uy/_layouts/15/BCU.Cotizaciones/handler/CotizacionesHandler.ashx?op=getcotizaciones";

export type BcuResolvedFxRate = {
  currencyCode: string;
  rate: number;
  dateUsed: string;
  seriesCode: string | null;
  source: "bcu";
};

type BcuCandidateRow = {
  date: string | null;
  currencyCode: string | null;
  rate: number | null;
  seriesCode: string | null;
};

const currencySeriesByCode: Record<string, { value: string; label: string }> = {
  USD: { value: "2224", label: "DLS. USA CABLE" },
};

function normalizeCurrencyCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized.length === 3 ? normalized : null;
}

function toDisplayDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function subtractDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().slice(0, 10);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const normalized = value
      .replace(/\s+/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(/,(?=\d{2,6}(?:\D|$))/g, ".")
      .replace(/[^0-9.\-]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const localMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (localMatch) {
    return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  }

  return null;
}

function collectRows(value: unknown, rows: BcuCandidateRow[] = []) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectRows(entry, rows);
    }
    return rows;
  }

  const record = asRecord(value);
  if (!record) {
    return rows;
  }

  const nestedValues = Object.values(record);
  const currencyCode = normalizeCurrencyCode(
    String(
      record.currencyCode
      ?? record.Moneda
      ?? record.moneda
      ?? record.CodigoISO
      ?? record.codigoISO
      ?? record.CodMoneda
      ?? "",
    ),
  );
  const date = parseDate(
    record.date
    ?? record.Fecha
    ?? record.fecha
    ?? record.FechaCotizacion
    ?? record.fechaCotizacion
    ?? null,
  );
  const rate = parseNumber(
    record.rate
    ?? record.Promedio
    ?? record.promedio
    ?? record.TCC
    ?? record.tcc
    ?? record.Valor
    ?? record.valor
    ?? record.Cotizacion
    ?? record.cotizacion
    ?? null,
  );
  const seriesCode =
    typeof record.seriesCode === "string"
      ? record.seriesCode
      : typeof record.CodigoMoneda === "string"
        ? record.CodigoMoneda
        : typeof record.codigoMoneda === "string"
          ? record.codigoMoneda
          : null;

  if (date && rate) {
    rows.push({
      date,
      currencyCode,
      rate,
      seriesCode,
    });
  }

  for (const nested of nestedValues) {
    collectRows(nested, rows);
  }

  return rows;
}

async function fetchViaConfiguredProxy(input: {
  endpoint: string;
  currencyCode: string;
  documentDate: string;
  fetchImpl: typeof fetch;
}) {
  const url = new URL(input.endpoint);
  url.searchParams.set("currency_code", input.currencyCode);
  url.searchParams.set("document_date", input.documentDate);
  const response = await input.fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BCU proxy respondio ${response.status}.`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const rate = parseNumber(payload.rate);
  const dateUsed = parseDate(payload.date_used ?? payload.date ?? payload.fx_date);

  if (!rate || !dateUsed) {
    throw new Error("El proxy BCU no devolvio rate/date validos.");
  }

  return {
    currencyCode: input.currencyCode,
    rate,
    dateUsed,
    seriesCode:
      typeof payload.series_code === "string"
        ? payload.series_code
        : null,
    source: "bcu",
  } satisfies BcuResolvedFxRate;
}

async function fetchViaDefaultHandler(input: {
  currencyCode: string;
  documentDate: string;
  fetchImpl: typeof fetch;
}) {
  const series = currencySeriesByCode[input.currencyCode];

  if (!series) {
    throw new Error(`No hay serie BCU configurada para ${input.currencyCode}.`);
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const candidateDate = subtractDays(input.documentDate, offset);
    const body = {
      Monedas: [{ Val: series.value, Text: series.label }],
      FechaDesde: toDisplayDate(candidateDate),
      FechaHasta: toDisplayDate(candidateDate),
      Grupo: "2",
    };
    const response = await input.fetchImpl(DEFAULT_BCU_HANDLER_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      continue;
    }

    const payload = await response.json().catch(() => null);
    const rows = collectRows(payload);
    const matching = rows.find((row) =>
      row.rate
      && row.date === candidateDate
      && (!row.currencyCode || row.currencyCode === input.currencyCode));

    if (matching?.rate) {
      return {
        currencyCode: input.currencyCode,
        rate: matching.rate,
        dateUsed: matching.date ?? candidateDate,
        seriesCode: matching.seriesCode ?? series.value,
        source: "bcu",
      } satisfies BcuResolvedFxRate;
    }
  }

  throw new Error("No se encontro cotizacion BCU disponible para la fecha requerida.");
}

export async function resolveBcuFiscalFxRate(input: {
  currencyCode: string | null | undefined;
  documentDate: string | null | undefined;
  fetchImpl?: typeof fetch;
}) {
  const currencyCode = normalizeCurrencyCode(input.currencyCode);
  const documentDate = parseDate(input.documentDate ?? null);

  if (!currencyCode || !documentDate) {
    throw new Error("Falta moneda o fecha documental para consultar BCU.");
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const configuredProxy = process.env.BCU_FX_PROXY_URL?.trim();

  if (configuredProxy) {
    return fetchViaConfiguredProxy({
      endpoint: configuredProxy,
      currencyCode,
      documentDate,
      fetchImpl,
    });
  }

  return fetchViaDefaultHandler({
    currencyCode,
    documentDate,
    fetchImpl,
  });
}
