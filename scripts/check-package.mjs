import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { build } from "esbuild";
import * as sdk from "@getpaseo/plugin";

const root = process.cwd();
const manifest = JSON.parse(readFileSync("paseo-plugin.json", "utf8"));
const npmCli = process.env.npm_execpath;
assert(npmCli, "Run this check with npm run check:package");
const output = execFileSync(
  process.execPath,
  [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"],
  { encoding: "utf8" },
);
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
for (const required of [
  "paseo-plugin.json",
  "OVERVIEW.md",
  "index.client.tsx",
  "index.server.ts",
  ...manifest.media,
]) {
  assert(files.has(required), `Missing published file: ${required}`);
}
assert(
  ![...files].some((file) => /^(preview|tests|node_modules)\//.test(file)),
  "Development files leaked into package",
);
assert(
  !/paseo plugin add|npm install|npm i\s/.test(readFileSync("OVERVIEW.md", "utf8")),
  "Listing overview must not include installation commands",
);

const registrations = [];
const context = new Proxy(
  {},
  {
    get: (_target, method) => (entry) => {
      registrations.push([method, entry]);
      return () => {};
    },
  },
);
const require = createRequire(import.meta.url);
for (const target of ["client", "server"]) {
  const result = await build({
    entryPoints: [path.join(root, target === "client" ? "index.client.tsx" : "index.server.ts")],
    bundle: true,
    format: "cjs",
    jsx: "automatic",
    platform: target === "client" ? "neutral" : "node",
    target: "es2020",
    mainFields: ["module", "main"],
    supported: { "async-await": false },
    external: [
      "@getpaseo/plugin",
      "@getpaseo/plugin/*",
      "react",
      "react/jsx-runtime",
      "react-native",
      "zod",
    ],
    write: false,
    metafile: true,
  });
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === "@getpaseo/plugin") return sdk;
      if (specifier.startsWith("@getpaseo/plugin/")) return {};
      if (specifier === "react-native") return {};
      assert(
        ["react", "react/jsx-runtime", "zod"].includes(specifier),
        `Unexpected runtime dependency: ${specifier}`,
      );
      return require(specifier);
    },
  };
  vm.runInNewContext(result.outputFiles[0].text, sandbox, { timeout: 5_000 });
  assert.equal(typeof module.exports.default, "function");
  assert.equal(typeof module.exports.default(context), "function");
  assert(
    !Object.keys(result.metafile.inputs).some((file) => /[/\\](preview|tests)[/\\]/.test(file)),
    "Demo code leaked into runtime",
  );
  console.log(
    `${target}: compiled and contribution entry executed (${result.outputFiles[0].contents.length} bytes)`,
  );
}
assert(registrations.some(([method, entry]) => method === "addScreen" && entry.id === "main"));
assert(registrations.some(([method]) => method === "addSidebarHeaderItem"));
assert(registrations.some(([method]) => method === "registerSettings"));
console.log(
  `Package OK: ${pack.files.length} files; host-only runtime modules; manifest assets present.`,
);
