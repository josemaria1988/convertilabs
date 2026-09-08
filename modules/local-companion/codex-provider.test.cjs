/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
require("../../tests/register-ts.cjs");
const { createCodexProvider, buildCodexEnvironment } = require("./codex-provider.ts");
const { createProcessRunner } = require("./codex-process.ts");

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE9sAAAAASUVORK5CYII=", "base64");
const schema = { type: "object", additionalProperties: false, required: ["total"], properties: { total: { type: ["number", "null"], minimum: 0 } } };
const input = { bytes: png, mimeType: "image/png", originalFilename: '../../factura $(echo robado).png', systemPrompt: "Extraer factura.", userPrompt: "Datos comerciales.", jsonSchema: schema };
const help = "--ignore-user-config --ignore-rules --strict-config --image --output-schema";
const completed = JSON.stringify({ type: "turn.completed", usage: { input_tokens: 100, output_tokens: 25 } });

async function fixture(runExtraction, options = {}) {
  const base = path.resolve(".local-companion", "provider-tests");
  await fs.mkdir(base, { recursive: true });
  const directory = await fs.mkdtemp(path.join(base, "test-"));
  const requests = [];
  const provider = createCodexProvider({
    sourceEnv: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, USERPROFILE: process.env.USERPROFILE,
      OPENAI_API_KEY: "secret-api", CODEX_API_KEY: "secret-other-api", CODEX_ACCESS_TOKEN: "secret-token",
      SUPABASE_SERVICE_ROLE_KEY: "secret-database", ZETA_PASSWORD: "secret-erp", NODE_OPTIONS: "malicious-preload" },
    config: { runtimeRoot: directory }, resolveExecutable: async () => "codex-test.exe",
    resolvePdf: async (name) => `${name}.exe`,
    runProcess: async (request) => {
      requests.push(request);
      if (request.args[0] === "--version") return { stdout: options.version || "codex-cli 0.153.4", stderr: "", exitCode: 0 };
      if (request.args[0] === "exec" && request.args[1] === "--help") return { stdout: help, stderr: "", exitCode: 0 };
      return runExtraction(request);
    },
  });
  return { provider, requests, directory, async cleanup() {
    assert.equal(path.dirname(directory), base);
    await fs.rm(directory, { recursive: true, force: true });
  } };
}

test("extraction uses a clean environment, fixed document names and validates the returned invoice", async () => {
  const f = await fixture(async (request) => {
    assert.equal(request.env.OPENAI_API_KEY, undefined);
    assert.equal(request.env.CODEX_API_KEY, undefined);
    assert.equal(request.env.CODEX_ACCESS_TOKEN, undefined);
    assert.equal(request.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
    assert.equal(request.env.ZETA_PASSWORD, undefined);
    assert.equal(request.env.NODE_OPTIONS, undefined);
    assert.equal(request.args.includes(input.originalFilename), false);
    assert.equal(request.args.includes("--ignore-user-config"), true);
    assert.equal(request.args.includes('forced_login_method="chatgpt"'), true);
    assert.equal(request.args.includes('approval_policy="never"'), true);
    assert.equal(request.args.includes('shell_environment_policy.inherit="none"'), true);
    assert.equal(request.args.includes("shell_tool"), true);
    assert.equal(request.args.includes("--dangerously-bypass-approvals-and-sandbox"), false);
    assert.equal(await fs.readFile(path.join(request.cwd, ".convertilabs-job"), "utf8"), "");
    assert.deepEqual(await fs.readFile(path.join(request.cwd, "document.png")), png);
    await fs.writeFile(path.join(request.cwd, "result.json"), JSON.stringify({ total: 122 }));
    return { stdout: completed, stderr: "", exitCode: 0 };
  });
  try {
    const output = await f.provider.extract(input);
    assert.deepEqual(output.output, { total: 122 });
    assert.deepEqual(output.usage, { inputTokens: 100, outputTokens: 25, totalTokens: 125 });
    assert.equal(output.diagnostics.apiKeyUsed, false);
    assert.deepEqual(await fs.readdir(f.directory), []);
  } finally { await f.cleanup(); }
});

test("malformed or contract-invalid JSON never becomes a successful extraction", async () => {
  for (const content of ['```json\n{"total":122}\n```', '{"total":"122"}', '{"total":122,"injected":"send"}']) {
    const f = await fixture(async (request) => {
      await fs.writeFile(path.join(request.cwd, "result.json"), content);
      return { stdout: completed, stderr: "", exitCode: 0 };
    });
    try {
      await assert.rejects(() => f.provider.extract(input), { code: "invalid_output", retryable: true });
      assert.deepEqual(await fs.readdir(f.directory), []);
    } finally { await f.cleanup(); }
  }
});

test("quota and auth failures expose a safe message and prohibit automatic retries", async () => {
  for (const [code, stderr] of [["quota", "429 rate limit reached; secret-api"], ["authentication", "401 unauthorized; secret-api"]]) {
    const f = await fixture(async () => ({ stdout: "", stderr, exitCode: 1 }));
    try {
      await assert.rejects(() => f.provider.extract(input), (error) => error.code === code && error.retryable === false && !error.message.includes("secret-api"));
      assert.deepEqual(await fs.readdir(f.directory), []);
    } finally { await f.cleanup(); }
  }
});

test("CLI option incompatibility is rejected before any model request", async () => {
  const f = await fixture(async () => { assert.fail("must not request extraction"); }, { version: "codex-cli 0.111.0" });
  try {
    await assert.rejects(() => f.provider.extract(input), { code: "codex_outdated" });
    assert.equal(f.requests.length, 1);
  } finally { await f.cleanup(); }
});

test("a PDF over the page limit is rejected before rendering or model usage", async () => {
  const f = await fixture(async (request) => {
    assert.equal(request.executable, "pdfinfo.exe");
    return { stdout: "Pages:          13\n", stderr: "", exitCode: 0 };
  });
  try {
    await assert.rejects(() => f.provider.extract({ ...input, bytes: Buffer.from("%PDF-1.7\n"), mimeType: "application/pdf" }), { code: "pdf_page_limit" });
    assert.equal(f.requests.length, 3);
    assert.deepEqual(await fs.readdir(f.directory), []);
  } finally { await f.cleanup(); }
});

test("missing PDF pages fail the whole document instead of creating a partial invoice", async () => {
  const f = await fixture(async (request) => {
    if (request.executable === "pdfinfo.exe") return { stdout: "Pages: 2\n", stderr: "", exitCode: 0 };
    assert.equal(request.executable, "pdftoppm.exe");
    if (request.args[1] === "1") await fs.writeFile(`${request.args.at(-1)}.png`, png);
    return { stdout: "", stderr: "", exitCode: 0 };
  });
  try {
    await assert.rejects(() => f.provider.extract({ ...input, bytes: Buffer.from("%PDF-1.7\n"), mimeType: "application/pdf" }), { code: "pdf_render_failed" });
    assert.deepEqual(await fs.readdir(f.directory), []);
  } finally { await f.cleanup(); }
});

test("multi-page PDFs attach every rendered page in document order", async () => {
  const f = await fixture(async (request) => {
    if (request.executable === "pdfinfo.exe") return { stdout: "Pages: 2\n", stderr: "", exitCode: 0 };
    if (request.executable === "pdftoppm.exe") {
      await fs.writeFile(`${request.args.at(-1)}.png`, png);
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    const images = request.args.flatMap((arg, index) => arg === "--image" ? [path.basename(request.args[index + 1])] : []);
    assert.deepEqual(images, ["page-001.png", "page-002.png"]);
    assert.match(request.input, /Attached pages in document order: 2/);
    await fs.writeFile(path.join(request.cwd, "result.json"), '{"total":122}');
    return { stdout: completed, stderr: "", exitCode: 0 };
  });
  try {
    const result = await f.provider.extract({ ...input, bytes: Buffer.from("%PDF-1.7\n"), mimeType: "application/pdf" });
    assert.equal(result.diagnostics.pages, 2);
  } finally { await f.cleanup(); }
});

test("a tool attempt or a missing completed event rejects an otherwise valid invoice", async () => {
  for (const [events, code] of [[JSON.stringify({ type: "item.started", item: { type: "mcp_tool_call" } }) + "\n" + completed, "unexpected_tool_use"], [JSON.stringify({ type: "thread.started" }), "incomplete_output"]]) {
    const f = await fixture(async (request) => {
      await fs.writeFile(path.join(request.cwd, "result.json"), '{"total":122}');
      return { stdout: events, stderr: "", exitCode: 0 };
    });
    try { await assert.rejects(() => f.provider.extract(input), { code }); }
    finally { await f.cleanup(); }
  }
});

test("malformed event streams and tool types introduced later fail closed", async () => {
  for (const [events, code] of [["null\n", "invalid_output"], [JSON.stringify({ type: "item.started", item: { type: "future_external_tool" } }) + "\n" + completed, "unexpected_tool_use"]]) {
    const f = await fixture(async (request) => {
      await fs.writeFile(path.join(request.cwd, "result.json"), '{"total":122}');
      return { stdout: events, stderr: "", exitCode: 0 };
    });
    try { await assert.rejects(() => f.provider.extract(input), { code }); }
    finally { await f.cleanup(); }
  }
});

test("MIME spoofing and pre-cancelled tasks never start the CLI", async () => {
  const f = await fixture(async () => assert.fail("must not start"));
  try {
    await assert.rejects(() => f.provider.extract({ ...input, bytes: Buffer.from("<script>bad</script>") }), { code: "unsupported_document" });
    const controller = new AbortController(); controller.abort();
    await assert.rejects(() => f.provider.extract({ ...input, signal: controller.signal }), { code: "cancelled" });
    assert.equal(f.requests.length, 0);
  } finally { await f.cleanup(); }
});

test("environment isolation is case insensitive and excludes inherited executable hooks", () => {
  const clean = buildCodexEnvironment({ Path: "C:\\safe", SystemRoot: "C:\\Windows", CoDeX_HoMe: "C:\\user\\.codex", OpenAI_API_Key: "leak", npm_config_userconfig: "leak", PYTHONPATH: "leak", CODEX_APP_SERVER_URL: "leak", HTTP_PROXY: "leak" }, "C:\\job");
  assert.deepEqual(clean, { NODE_ENV: "production", Path: "C:\\safe", SystemRoot: "C:\\Windows", CoDeX_HoMe: "C:\\user\\.codex", TEMP: "C:\\job", TMP: "C:\\job", TMPDIR: "C:\\job" });
});

function fakeSpawn(onCreate) {
  return (_executable, _args, options) => {
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    const child = new EventEmitter();
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { queueMicrotask(() => child.emit("close", -1)); return true; };
    queueMicrotask(() => onCreate(child));
    return child;
  };
}
const processRequest = { executable: "fake.exe", args: [], cwd: process.cwd(), env: {}, timeoutMs: 1000, maxOutputBytes: 1000 };

test("bounded runner terminates on timeout and cancellation without waiting indefinitely", async () => {
  const runner = createProcessRunner(fakeSpawn(() => undefined));
  await assert.rejects(() => runner({ ...processRequest, timeoutMs: 10 }), { code: "timeout", retryable: true });
  const controller = new AbortController();
  const pending = runner({ ...processRequest, signal: controller.signal });
  controller.abort();
  await assert.rejects(() => pending, { code: "cancelled" });
});

test("bounded runner caps combined stdout and stderr before retaining huge data", async () => {
  const runner = createProcessRunner(fakeSpawn((child) => { child.stdout.write("a".repeat(600)); child.stderr.write("b".repeat(600)); }));
  await assert.rejects(() => runner(processRequest), { code: "output_limit" });
});

test("bounded runner handles missing executables without leaking OS error detail", async () => {
  const runner = createProcessRunner(fakeSpawn((child) => child.emit("error", new Error("ENOENT secret-path"))));
  await assert.rejects(() => runner(processRequest), (error) => error.code === "process_unavailable" && !error.message.includes("secret-path"));
});
