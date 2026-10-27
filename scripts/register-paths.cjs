// ts-node does not apply tsconfig "paths" unless a resolver is registered.
// NGX scripts import lib modules that use the "@/" alias. This hook rewrites
// those requires to the repo root before Node (and ts-node) resolve the file.
// Idempotent: safe if tsconfig "ts-node.require" and `-r` both load it.

const path = require("path");
const Module = require("module");

if (!global.__ouestboursePathHook) {
  global.__ouestboursePathHook = true;
  const root = path.resolve(__dirname, "..");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (typeof request === "string" && request.startsWith("@/")) {
      const rewritten = path.join(root, request.slice(2));
      return original.call(this, rewritten, parent, isMain, options);
    }
    return original.call(this, request, parent, isMain, options);
  };
}
