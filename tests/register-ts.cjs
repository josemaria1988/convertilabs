/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const serverOnlyStub = path.join(__dirname, "stubs", "server-only.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithCandidates(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.cjs`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.cjs"),
    path.join(basePath, "index.mjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return basePath;
}

function resolveProjectRequest(request, parent) {
  if (request === "server-only") {
    return serverOnlyStub;
  }

  if (request.startsWith("@/")) {
    return resolveWithCandidates(path.join(projectRoot, request.slice(2)));
  }

  if (request.startsWith(".") || path.isAbsolute(request)) {
    const basePath = request.startsWith(".")
      ? path.resolve(parent ? path.dirname(parent.filename) : projectRoot, request)
      : request;

    return resolveWithCandidates(basePath);
  }

  return request;
}

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  return originalResolveFilename.call(
    this,
    resolveProjectRequest(request, parent),
    parent,
    isMain,
    options,
  );
};

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(outputText, filename);
}

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;
