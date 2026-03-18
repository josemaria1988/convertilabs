export function formatAccountingAmount(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAccountingDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const normalized = value.includes("T") ? value : `${value}T00:00:00`;

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(normalized));
}

export function formatAccountingDateTime(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getLifecycleStatusPillClass(value: string | null | undefined) {
  switch (value) {
    case "posted":
    case "exported":
    case "settled":
    case "completed":
      return "status-pill status-pill--success";
    case "open":
    case "partially_settled":
    case "needs_review":
    case "draft":
      return "status-pill status-pill--warning";
    case "failed":
    case "cancelled":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--info";
  }
}

export function getConfirmabilityPillClass(value: string | null | undefined) {
  switch (value) {
    case "confirmable":
      return "status-pill status-pill--success";
    case "needs_regeneration":
      return "status-pill status-pill--warning";
    case "blocked_by_kernel":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--info";
  }
}

export function getLineagePillClass(value: string | null | undefined) {
  switch (value) {
    case "reversal":
      return "status-pill status-pill--warning";
    case "adjustment":
      return "status-pill status-pill--info";
    default:
      return "status-pill status-pill--success";
  }
}
