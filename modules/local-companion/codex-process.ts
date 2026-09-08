import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import path from "node:path";

export class CodexProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "CodexProviderError";
  }
}

export type SpawnProcess = (
  executable: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

export type ProcessRequest = {
  executable: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
};

export type ProcessResult = { stdout: string; stderr: string; exitCode: number };
export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

/** An allowlist is intentional: the parent may hold ERP, Supabase, API or MCP secrets. */
export function buildCodexEnvironment(
  source: NodeJS.ProcessEnv,
  temporaryDirectory?: string,
): NodeJS.ProcessEnv {
  const allowed = new Set([
    "systemroot", "windir", "systemdrive", "comspec", "path", "pathext",
    "userprofile", "homedrive", "homepath", "home", "localappdata", "appdata",
    "temp", "tmp", "tmpdir", "lang", "lc_all", "tz", "codex_home",
  ]);
  const result: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key.toLowerCase()) && value !== undefined) result[key] = value;
  }
  // API keys, access-token env auth, custom endpoints, NODE_OPTIONS, proxies,
  // npm hooks and desktop host channels are deliberately not inherited.
  if (temporaryDirectory) {
    for (const key of Object.keys(result)) {
      if (["temp", "tmp", "tmpdir"].includes(key.toLowerCase())) delete result[key];
    }
    result.TEMP = temporaryDirectory;
    result.TMP = temporaryDirectory;
    result.TMPDIR = temporaryDirectory;
  }
  return result;
}

function terminateProcessTree(child: ChildProcess, env: NodeJS.ProcessEnv) {
  if (process.platform === "win32" && child.pid) {
    const systemRoot = env.SystemRoot ?? env.SYSTEMROOT ?? "C:\\Windows";
    const killer = spawn(path.join(systemRoot, "System32", "taskkill.exe"),
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true, shell: false, stdio: "ignore", env });
    killer.once("error", () => child.kill("SIGKILL"));
    killer.unref();
  } else {
    child.kill("SIGKILL");
  }
}

/** Never invokes a shell. A caller-supplied spawn allows deterministic failure tests. */
export function createProcessRunner(spawnProcess: SpawnProcess = spawn): ProcessRunner {
  return (request) => new Promise((resolve, reject) => {
    if (request.signal?.aborted) {
      reject(new CodexProviderError("cancelled", "La lectura local fue cancelada."));
      return;
    }
    let child: ChildProcess;
    try {
      child = spawnProcess(request.executable, request.args, {
        cwd: request.cwd, env: request.env, shell: false, windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      reject(new CodexProviderError("process_unavailable", "No se pudo iniciar la herramienta local."));
      return;
    }
    let totalBytes = 0;
    let stdout = "";
    let stderr = "";
    let failure: CodexProviderError | undefined;
    let settled = false;
    let forcedFinish: ReturnType<typeof setTimeout> | undefined;
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forcedFinish) clearTimeout(forcedFinish);
      request.signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else resolve({ stdout, stderr, exitCode });
    };
    const stop = (error: CodexProviderError) => {
      if (settled || failure) return;
      failure = error;
      terminateProcessTree(child, request.env);
      // Wait for close before cleanup; bound pathological handles on Windows.
      forcedFinish = setTimeout(() => finish(-1), 5_000);
    };
    const abort = () => stop(new CodexProviderError("cancelled", "La lectura local fue cancelada."));
    const timer = setTimeout(() => stop(new CodexProviderError(
      "timeout", "La lectura local superó el tiempo permitido. Podés volver a intentarlo.", true,
    )), request.timeoutMs);
    request.signal?.addEventListener("abort", abort, { once: true });
    if (request.signal?.aborted) abort();
    const collect = (target: "stdout" | "stderr", chunk: string | Buffer) => {
      if (failure || settled) return;
      totalBytes += Buffer.byteLength(chunk);
      if (totalBytes > request.maxOutputBytes) {
        stop(new CodexProviderError("output_limit", "La respuesta local superó el tamaño permitido."));
        return;
      }
      const content = chunk.toString();
      if (target === "stdout") stdout += content;
      else stderr += content;
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => collect("stdout", chunk));
    child.stderr?.on("data", (chunk) => collect("stderr", chunk));
    child.once("error", () => {
      failure = new CodexProviderError("process_unavailable", "No se pudo iniciar la herramienta local.");
      finish(-1);
    });
    child.once("close", (code) => finish(code ?? -1));
    // EPIPE is normal if the CLI rejects options before consuming the prompt.
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(request.input ?? "", "utf8");
  });
}

export const runBoundedProcess = createProcessRunner();
