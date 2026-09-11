import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ImapFlow, type ImapFlowOptions, type MessageStructureObject } from "imapflow";
import { sanitizeDocumentFilenameBase } from "@/modules/documents/upload";
import { type LocalCompanionIdentity, resolveLocalCompanionContext } from "./context";

export const emailInboxPollIntervalMs = 4 * 60 * 60 * 1000;
const maxAttachmentBytes = 20 * 1024 * 1024;
const maxMessageBytes = 50 * 1024 * 1024;
const maxMessagesPerPoll = 20;
// Search is performed by Gmail; only matching MIME structures and attachment parts are fetched.
export const emailInvoiceQuery = "has:attachment {subject:factura subject:facturas subject:facturación subject:CFE subject:e-factura subject:e-ticket subject:comprobante filename:xml}";

export type EmailInboxConfig = { enabled: true; address: string; password: string; mailbox: string; since: string };
type ConfigResult = { status: "ready"; config: EmailInboxConfig } | { status: "disabled" | "pending_configuration"; message: string };
export function resolveEmailInboxConfig(source: Record<string, unknown>): ConfigResult {
  if (source.invalid) return { status: "pending_configuration", message: "Revisá el archivo privado .env.email.local; no se pudo leer su configuración." };
  if (source.CONVERTILABS_EMAIL_ENABLED !== "true") return { status: "disabled", message: "Recepción de correo deshabilitada en esta PC." };
  const address = String(source.CONVERTILABS_EMAIL_ADDRESS ?? "").trim().toLowerCase();
  const password = String(source.CONVERTILABS_EMAIL_APP_PASSWORD ?? "").replace(/ /g, "");
  const mailbox = String(source.CONVERTILABS_EMAIL_MAILBOX ?? "INBOX");
  const since = String(source.CONVERTILABS_EMAIL_SINCE ?? "");
  if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(address) || !/^[a-zA-Z0-9]{16}$/.test(password)
    || mailbox !== "INBOX" || !/^\d{4}-\d{2}-\d{2}$/.test(since)
    || !Number.isFinite(Date.parse(`${since}T00:00:00Z`)) || new Date(`${since}T00:00:00Z`).toISOString().slice(0, 10) !== since) {
    return { status: "pending_configuration", message: "Completá dirección Gmail, contraseña de aplicación de 16 caracteres, INBOX y fecha inicial YYYY-MM-DD en .env.email.local." };
  }
  return { status: "ready", config: { enabled: true, address, password, mailbox, since } };
}

export type EmailDownloadedAttachment = { filePath: string; originalFilename: string; mimeType: string; fileHash: string };
export type EmailMessageSource = { mailboxAddress: string; mailbox: string; uidValidity: string; uid: number; messageId: string | null; receivedAt: string | null };
export type EmailIngestInput = LocalCompanionIdentity & { appUrl?: string; message: EmailMessageSource; attachments: EmailDownloadedAttachment[] };
export type EmailIngestResult = { documents: Array<{ documentId: string; status: string; duplicate: boolean; reviewUrl?: string; localAction?: string | null }>; pending?: Array<{ filename: string; reason: string }> };
type PendingMessage = { uid: number; uidValidity: string; reason: string; filenames: string[];
  retryable: boolean; recordedAt: string; attachments: EmailDownloadedAttachment[];
  details?: Array<{ filename: string; reason: string }> };
type EmailState = { version: 1; uidValidity: string; lastUid: number; since: string; checkedAt: string;
  pending: PendingMessage[]; lastResult?: Record<string, unknown> };
type InboxClient = Pick<ImapFlow, "connect" | "getMailboxLock" | "search" | "fetchOne" | "download" | "logout" | "close" | "mailbox" | "on">;
type Dependencies = { createClient?: (options: ImapFlowOptions) => InboxClient;
  context?: typeof resolveLocalCompanionContext; ingest: (input: EmailIngestInput) => Promise<EmailIngestResult>;
  observe?: (input: LocalCompanionIdentity & { mailboxEmail: string; observedAt: string; lastInboundEmailAt?: string }) => Promise<{ recorded: boolean; code?: string }> };

function attachmentFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return sanitizeDocumentFilenameBase(filename.slice(0, -extension.length)).slice(0, 120 - extension.length) + extension;
}

export function selectInvoiceAttachments(structure: MessageStructureObject): Array<{ part: string; filename: string; type: string; size: number }> {
  const result: Array<{ part: string; filename: string; type: string; size: number }> = [];
  const visit = (node: MessageStructureObject, depth: number) => {
    if (depth > 20 || result.length > 30) throw new Error("attachment_structure_limit");
    const filename = node.dispositionParameters?.filename ?? node.parameters?.name;
    const type = node.type?.toLowerCase();
    if (filename && node.part && type && !node.childNodes?.length) {
      const supported = /\.(pdf|xml|jpe?g|png|zip)$/i.test(filename);
      // Some mail clients label invoice photos inline; retain substantial named images for review.
      if (supported && (node.disposition?.toLowerCase() === "attachment" || /\.(pdf|xml|zip)$/i.test(filename)
        || (/\.(jpe?g|png)$/i.test(filename) && (node.size ?? 0) >= 20_000))) {
        result.push({ part: node.part, filename: attachmentFilename(filename), type, size: node.size ?? 0 });
      }
    }
    for (const child of node.childNodes ?? []) visit(child, depth + 1);
  };
  visit(structure, 0);
  if (result.length > 20) throw new Error("attachment_count_limit");
  // Exclude obvious decoration; substantial photos are retained even alongside XML/PDF.
  return result.filter((item) => !/\.(jpe?g|png)$/i.test(item.filename)
    || (item.size >= 20_000 && !/(^|[._\s-])(logo|icon|warning|firma|signature|banner)([._\s-]|$)/i.test(item.filename)));
}

function safeFailure(error: unknown) {
  const failure = error as { authenticationFailed?: boolean; code?: string };
  return failure?.authenticationFailed || ["AUTHENTICATIONFAILED", "EAUTH"].includes(String(failure?.code))
    ? { code: "email_authentication", message: "Gmail rechazó la conexión. Revisá la contraseña de aplicación y la verificación en dos pasos." }
    : { code: "email_poll_failed", message: "No se completó la recepción de facturas. Se conserva el punto de lectura y se reintentará en el próximo ciclo." };
}

function quarantineFailure(error: unknown) {
  const reason = error instanceof Error ? error.message : "";
  if (["attachment_size_limit", "attachment_count_limit", "attachment_structure_limit", "attachment_empty"].includes(reason)) {
    return { reason, retryable: false };
  }
  return { reason: safeFailure(error).code, retryable: true };
}

function candidatesForPoll(fresh: number[], retries: PendingMessage[]) {
  const newUids = [...new Set(fresh)].sort((a, b) => a - b);
  // Rotate failed retries by their latest attempt; reserve half the batch for new mail.
  const retryUids = [...new Set([...retries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.uid - b.uid).map((item) => item.uid))];
  const reserved = newUids.length && retryUids.length ? maxMessagesPerPoll / 2 : maxMessagesPerPoll;
  const selected = [...retryUids.splice(0, reserved), ...newUids.splice(0, reserved)];
  selected.push(...newUids.splice(0, maxMessagesPerPoll - selected.length));
  selected.push(...retryUids.splice(0, maxMessagesPerPoll - selected.length));
  return selected;
}

async function saveState(filename: string, state: EmailState) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2), { flag: "wx", mode: 0o600 });
  try { await rename(temporary, filename); }
  finally { await unlink(temporary).catch(() => {}); }
}

async function loadState(filename: string, since: string): Promise<EmailState> {
  try {
    const data = JSON.parse(await readFile(filename, "utf8"));
    if (data.version !== 1 || !/^\d+$/.test(data.uidValidity) || !Number.isSafeInteger(data.lastUid)
      || data.lastUid < 0 || !Array.isArray(data.pending) || data.since !== since) throw new Error("email_state_invalid");
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { version: 1, uidValidity: "0", lastUid: 0, since, checkedAt: "", pending: [] };
  }
}

/** Local mutex only; document identities/hashes in Supabase arbitrate copies across PCs. */
async function claimPoll(lockPath: string) {
  try {
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    await handle.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // Never steal a lock: checking a dead PID then unlinking has a takeover race.
    // A crash leaves a visible reservation for an operator to inspect/recover.
    return false;
  }
}

export async function pollEmailInbox(input: LocalCompanionIdentity & { config: EmailInboxConfig; stateDirectory: string; appUrl?: string; signal?: AbortSignal; manual?: boolean }, deps: Dependencies) {
  const context = await (deps.context ?? resolveLocalCompanionContext)({ slug: input.slug, actorProfileId: input.actorProfileId, requireWrite: true });
  const accountKey = createHash("sha256").update(JSON.stringify([context.organization.id, input.config.address, input.config.mailbox])).digest("hex");
  const directory = path.resolve(input.stateDirectory, "email", accountKey);
  await mkdir(directory, { recursive: true });
  const lockPath = path.join(directory, "poll.lock");
  if (!await claimPoll(lockPath)) return { status: "already_running", message: "Existe una reserva de recepción en esta PC. Si no hay un proceso activo, revisá la reserva local antes de recuperarla." };
  const statePath = path.join(directory, "state.json");
  let client: InboxClient | undefined;
  let lock: { release(): void } | undefined;
  let state: EmailState | undefined;
  const documents: EmailIngestResult["documents"] = [];
  let readMessages = 0;
  let inspectedMessages = 0;
  let activeUid: number | null = null;
  let observedAt: string | undefined;
  let lastInboundEmailAt: string | undefined;
  const cloudObservation = { connectionRecorded: false, inboundRecorded: false };
  const observe = async (inbound = false) => {
    if (!deps.observe || !observedAt || (inbound && !lastInboundEmailAt)) return;
    try {
      const result = await deps.observe({ slug: input.slug, actorProfileId: input.actorProfileId, mailboxEmail: input.config.address,
        observedAt: inbound ? new Date().toISOString() : observedAt, ...(inbound ? { lastInboundEmailAt } : {}) });
      if (inbound) cloudObservation.inboundRecorded = result.recorded === true;
      else cloudObservation.connectionRecorded = result.recorded === true;
    } catch { /* Observation is optional; it must not interrupt the durable document pipeline. */ }
  };
  const abort = () => client?.close();
  try {
    state = await loadState(statePath, input.config.since);
    if (input.signal?.aborted) return { status: "cancelled", documents };
    const checkedAt = Date.parse(state.checkedAt);
    if (input.manual !== true && Number.isFinite(checkedAt) && Date.now() < checkedAt + emailInboxPollIntervalMs) {
      return { status: "skipped_recently_checked", checkedAt: state.checkedAt,
        nextCheckAt: new Date(checkedAt + emailInboxPollIntervalMs).toISOString(),
        message: "El correo ya fue consultado. La revisión automática respeta al menos cuatro horas entre conexiones." };
    }
    client = (deps.createClient ?? ((options) => new ImapFlow(options)))({
      host: "imap.gmail.com", port: 993, secure: true, tls: { rejectUnauthorized: true },
      auth: { user: input.config.address, pass: input.config.password },
      logger: false, logRaw: false, emitLogs: false, disableAutoIdle: true,
      connectionTimeout: 30_000, greetingTimeout: 15_000, socketTimeout: 60_000,
    });
    client.on("error", () => {}); // Error events must never expose a protocol/auth payload in logs.
    input.signal?.addEventListener("abort", abort, { once: true });
    await client.connect();
    lock = await client.getMailboxLock(input.config.mailbox, { readOnly: true });
    if (!client.mailbox || !client.mailbox.uidValidity) throw new Error("email_mailbox_identity_missing");
    observedAt = new Date().toISOString();
    await observe();
    const uidValidity = String(client.mailbox.uidValidity);
    if (state.uidValidity !== uidValidity) state = { ...state, uidValidity, lastUid: 0 };
    const matches = await client.search({ since: input.config.since, uid: `${state.lastUid + 1}:*`, gmraw: emailInvoiceQuery }, { uid: true });
    if (!Array.isArray(matches)) throw new Error("email_search_incomplete");
    const fresh = matches.filter((uid) => Number.isSafeInteger(uid) && uid > state!.lastUid);
    const retries = state.pending.filter((item) => item.uidValidity === uidValidity && item.retryable);
    const candidates = candidatesForPoll(fresh, retries);
    for (const uid of candidates) {
      if (input.signal?.aborted) break;
      inspectedMessages++;
      activeUid = uid;
      let downloaded: EmailDownloadedAttachment[] = [];
      const recordPending = async (reason: string, retryable: boolean, filenames: string[], details?: Array<{ filename: string; reason: string }>) => {
        state!.pending = state!.pending.filter((item) => !(item.uid === uid && item.uidValidity === uidValidity));
        state!.pending.push({ uid, uidValidity, reason, retryable, filenames, attachments: downloaded, recordedAt: new Date().toISOString(),
          ...(details?.length ? { details: details.map((item) => ({ filename: sanitizeDocumentFilenameBase(item.filename),
            reason: item.reason.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 500) || "requires_review" })) } : {}) });
        state!.lastUid = Math.max(state!.lastUid, uid);
        state!.checkedAt = new Date().toISOString();
        // The independent pending record must be durable before progressing to later UIDs.
        await saveState(statePath, state!);
      };
      try {
      const message = await client.fetchOne(String(uid), { uid: true, envelope: true, bodyStructure: true, internalDate: true, size: true }, { uid: true });
      if (!message || message.uid !== uid || !message.bodyStructure) throw new Error("email_message_incomplete");
      // DSNs can quote an invoice subject and include named warning icons. They are not invoices.
      const sender = message.envelope?.from?.map((item) => item.address ?? "").join(" ") ?? "";
      if (message.bodyStructure.type.toLowerCase() === "multipart/report"
        || /delivery status notification|delivery failure|undelivered mail|mail delivery (failed|subsystem)/i.test(message.envelope?.subject ?? "")
        || /(^|\s)(mailer-daemon|postmaster)@/i.test(sender)) {
        state.lastUid = Math.max(state.lastUid, uid);
        state.pending = state.pending.filter((item) => !(item.uid === uid && item.uidValidity === uidValidity));
        state.checkedAt = new Date().toISOString(); readMessages++;
        await saveState(statePath, state); activeUid = null; continue;
      }
      const parts = selectInvoiceAttachments(message.bodyStructure);
      const unsupported = parts.filter((part) => /\.zip$/i.test(part.filename));
      if (!parts.length) {
        await recordPending("no_supported_invoice_attachment", false, []);
        activeUid = null; continue;
      }
      const attachments: EmailDownloadedAttachment[] = [];
      downloaded = attachments;
      let totalBytes = 0;
      for (const part of parts) {
        if (part.size > maxAttachmentBytes) throw new Error("attachment_size_limit");
        const download = await client.download(String(uid), part.part, { uid: true, maxBytes: maxAttachmentBytes + 1 });
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of download.content) {
          const buffer = Buffer.from(chunk); size += buffer.length; totalBytes += buffer.length;
          if (size > maxAttachmentBytes || totalBytes > maxMessageBytes) { download.content.destroy(); throw new Error("attachment_size_limit"); }
          chunks.push(buffer);
        }
        if (size === 0) throw new Error("attachment_empty");
        const bytes = Buffer.concat(chunks);
        const fileHash = createHash("sha256").update(bytes).digest("hex");
        const fileDirectory = path.join(directory, "attachments", fileHash);
        await mkdir(fileDirectory, { recursive: true });
        const filePath = path.join(fileDirectory, part.filename);
        try { await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST" || createHash("sha256").update(await readFile(filePath)).digest("hex") !== fileHash) throw new Error("attachment_backup_failed");
        }
        attachments.push({ filePath, originalFilename: part.filename, mimeType: part.type, fileHash });
      }
      if (unsupported.length) {
        await recordPending("zip_requires_review", false, unsupported.map((part) => part.filename));
        activeUid = null; continue;
      }
      const mixedImages = attachments.some((item) => /\.(pdf|xml)$/i.test(item.originalFilename))
        ? attachments.filter((item) => /\.(jpe?g|png)$/i.test(item.originalFilename)) : [];
      const result = await deps.ingest({ slug: input.slug, actorProfileId: input.actorProfileId, appUrl: input.appUrl,
        message: { mailboxAddress: input.config.address, mailbox: input.config.mailbox, uidValidity, uid,
          messageId: message.envelope?.messageId ?? null,
          receivedAt: message.internalDate instanceof Date ? message.internalDate.toISOString() : null },
        attachments: attachments.filter((item) => !mixedImages.includes(item)) });
      documents.push(...result.documents);
      if (result.documents.length) lastInboundEmailAt = new Date().toISOString();
      if (result.pending?.length || result.documents.length === 0) {
        await recordPending("attachment_requires_review", false, [...(result.pending ?? []).map((item) => item.filename), ...mixedImages.map((item) => item.originalFilename)],
          [...(result.pending ?? []), ...mixedImages.map((item) => ({ filename: item.originalFilename, reason: "image_requires_identity_review" }))]);
        activeUid = null; continue;
      }
      if (mixedImages.length) {
        await recordPending("image_requires_identity_review", false, mixedImages.map((item) => item.originalFilename));
        activeUid = null; continue;
      }
      // Persist after every complete message; a crash during the next one reuses shared identities.
      state.lastUid = Math.max(state.lastUid, uid);
      state.pending = state.pending.filter((item) => !(item.uid === uid && item.uidValidity === uidValidity));
      state.checkedAt = new Date().toISOString(); readMessages++;
      await saveState(statePath, state);
      activeUid = null;
      } catch (error) {
        if (input.signal?.aborted) throw error;
        const failure = quarantineFailure(error);
        await recordPending(failure.reason, failure.retryable, downloaded.map((part) => part.originalFilename));
        activeUid = null;
      }
    }
    state.checkedAt = new Date().toISOString();
    await observe(true);
    const result = { status: state.pending.length ? "pending_review" : "received", readMessages, documents,
      cloudObservation,
      pending: state.pending, remainingMessages: Math.max(0, fresh.length + retries.length - inspectedMessages),
      checkedAt: state.checkedAt, nextCheckAfter: new Date(Date.now() + emailInboxPollIntervalMs).toISOString(),
      message: "Sólo se recibieron adjuntos de facturas. Los documentos requieren revisión antes de enviar a Zeta." };
    state.lastResult = result;
    await saveState(statePath, state);
    return result;
  } catch (error) {
    const failure = safeFailure(error);
    await observe(true);
    const result = { status: input.signal?.aborted ? "cancelled" : "error", ...failure, readMessages, documents, cloudObservation };
    if (state) {
      if (activeUid !== null && !state.pending.some((item) => item.uid === activeUid && item.uidValidity === state!.uidValidity)) {
        state.pending.push({ uid: activeUid, uidValidity: state.uidValidity, reason: failure.code, filenames: [], retryable: true,
          recordedAt: new Date().toISOString(), attachments: [] });
      }
      state.checkedAt = new Date().toISOString(); state.lastResult = result;
      await saveState(statePath, state).catch(() => {});
    }
    return result;
  } finally {
    input.signal?.removeEventListener("abort", abort);
    lock?.release();
    await client?.logout().catch(() => { client?.close(); });
    await unlink(lockPath).catch(() => {});
  }
}
