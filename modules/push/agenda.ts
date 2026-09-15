import { createHash } from "node:crypto";
import { addDays, validDay } from "./validation";

type Metadata = Record<string, unknown>;
export type AgendaTask = { id: string; title: string; status: string; due_date: string | null; party_id?: string | null; metadata_json: Metadata };
export type AgendaObligation = { id: string; title: string; status: string; frequency: string; next_due_date: string | null; party_id?: string | null; metadata_json: Metadata };
export type AgendaOccurrence = { id: string; obligation_id: string; due_date: string; status: string; task_id: string | null };
export type PushEvent = { key: string; sourceType: "task" | "obligation" | "test"; sourceId: string | null; sourceDueDate: string; title: string; body: string };
const activeTask = (status: string) => ["pending", "in_progress", "blocked"].includes(status);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
export function eventKey(identity: string) { return createHash("sha256").update(identity).digest("hex"); }
function maturityIdentity(obligation: AgendaObligation | undefined, metadata: Metadata, party: string | null | undefined, maturity: string, fallback: string) {
  const operation = text(metadata.operation_number) ?? text(obligation?.metadata_json.operation_number);
  const bank = party ?? obligation?.party_id;
  if (operation && bank) return `maturity:${bank}:${operation}:${maturity}`;
  const obligationId = obligation?.id ?? text(metadata.obligation_id);
  return obligationId ? `obligation:${obligationId}:${maturity}` : `${fallback}:${maturity}`;
}
function currentObligation(obligation: AgendaObligation, date: string) {
  if (obligation.status !== "active") return false;
  const current = text(obligation.metadata_json.current_due_date);
  if (Object.hasOwn(obligation.metadata_json, "current_due_date") && !validDay(current)) return false;
  if (current && current !== date) return false;
  return !["once", "ad_hoc"].includes(obligation.frequency) || obligation.next_due_date === date;
}
function pretty(day: string) { return day.split("-").reverse().join("/"); }

// Explicit D-2 tasks already contain the reminder date. Preserve it and collapse the
// task/occurrence pair into one logical maturity, including the renewal date in its key.
export function planAgendaPush(input: { day: string; tasks: AgendaTask[]; obligations: AgendaObligation[]; occurrences: AgendaOccurrence[] }): PushEvent[] {
  if (!validDay(input.day)) throw new Error("Invalid agenda day");
  const obligations = new Map(input.obligations.map((row) => [row.id, row]));
  const events = new Map<string, PushEvent>(); const handled = new Set<string>(); const suppressed = new Set<string>();
  const maturityDay = addDays(input.day, 2);
  const closedLinkedTasks = new Set<string>();
  for (const occurrence of input.occurrences) {
    const obligation = obligations.get(occurrence.obligation_id);
    if (!obligation || occurrence.due_date !== maturityDay || occurrence.status === "pending") continue;
    suppressed.add(eventKey(maturityIdentity(obligation, obligation.metadata_json ?? {}, obligation.party_id, occurrence.due_date, `obligation:${obligation.id}`)));
    if (occurrence.task_id) closedLinkedTasks.add(occurrence.task_id);
  }
  const explicitTaskIds = new Set(input.tasks.filter((task) => task.due_date === input.day).map((task) => task.id));
  for (const task of input.tasks) {
    if (task.due_date !== input.day || !validDay(task.due_date)) continue;
    const metadata = task.metadata_json ?? {};
    const isReminder = metadata.task_purpose === "two_day_maturity_reminder";
    const obligationId = text(metadata.obligation_id);
    const obligation = obligationId ? obligations.get(obligationId) : undefined;
    const maturity = text(metadata.maturity_date);
    if (isReminder && (maturity !== maturityDay || (metadata.reminder_date && metadata.reminder_date !== task.due_date))) continue;
    const identity = isReminder ? maturityIdentity(obligation, metadata, task.party_id, maturity!, `task:${task.id}`) : `task:${task.id}:${task.due_date}`;
    const key = eventKey(identity); handled.add(key);
    if (!activeTask(task.status) || closedLinkedTasks.has(task.id) || (obligationId && (!obligation || !currentObligation(obligation, maturity ?? task.due_date)))) { suppressed.add(key); continue; }
    events.set(key, { key, sourceType: "task", sourceId: task.id, sourceDueDate: task.due_date,
      title: "Convertilabs · Agenda", body: isReminder ? `${task.title.slice(0, 160)} · Vence ${pretty(maturity!)}.` : `${task.title.slice(0, 160)} · Para hoy.` });
  }
  for (const occurrence of input.occurrences) {
    const obligation = obligations.get(occurrence.obligation_id);
    if (!obligation || !currentObligation(obligation, occurrence.due_date) || occurrence.status !== "pending"
      || occurrence.due_date !== maturityDay || (occurrence.task_id && explicitTaskIds.has(occurrence.task_id))) continue;
    const key = eventKey(maturityIdentity(obligation, obligation.metadata_json ?? {}, obligation.party_id, occurrence.due_date, `obligation:${obligation.id}`));
    if (handled.has(key) || events.has(key)) continue;
    events.set(key, { key, sourceType: "obligation", sourceId: occurrence.id, sourceDueDate: occurrence.due_date,
      title: "Convertilabs · Agenda", body: `${obligation.title.slice(0, 160)} · Vence ${pretty(occurrence.due_date)} (en 2 días).` });
  }
  return [...events.values()].filter((event) => !suppressed.has(event.key));
}
