import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Run the real upstream boundary/type-import checks, not just plain esbuild.
// Pin the compiler revision so upstream changes cannot silently alter this test.
const revision = "e08389065c65630993e80c27f4c249a0b0423eb7";
const compilerFiles = ["compiler", "compiler-imports", "plugin-sdk-specifiers"];
const temporary = await mkdtemp(path.join(tmpdir(), "navigator-install-"));
try {
  const compilerDirectory = path.join(temporary, "compiler");
  const checkout = path.join(temporary, "checkout");
  await mkdir(compilerDirectory);
  await mkdir(checkout);
  await Promise.all(
    compilerFiles.map(async (name) => {
      const url = `https://raw.githubusercontent.com/getpaseo/paseo/${revision}/packages/server/src/server/plugins/${name}.ts`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok)
        throw new Error(`Compiler fixture download failed: ${response.status} ${url}`);
      const source = await response.text();
      let javascript = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText;
      for (const dependency of compilerFiles)
        javascript = javascript.replaceAll(`./${dependency}.js`, `./${dependency}.mjs`);
      // Resolve the compiler's own tooling from this test runner. The checkout
      // remains isolated with no node_modules or package preparation commands.
      javascript = javascript.replaceAll(
        "createRequire(import.meta.url)",
        `createRequire(${JSON.stringify(import.meta.url)})`,
      );
      await writeFile(path.join(compilerDirectory, `${name}.mjs`), javascript);
    }),
  );
  for (const entry of [
    "index.client.tsx",
    "index.server.ts",
    "client",
    "shared",
    "paseo-plugin.json",
    "package.json",
    "tsconfig.json",
  ]) {
    await cp(path.resolve(entry), path.join(checkout, entry), { recursive: true });
  }
  const { compilePlugin } = await import(
    pathToFileURL(path.join(compilerDirectory, "compiler.mjs")).href
  );
  const entries = {
    client: path.join(checkout, "index.client.tsx"),
    server: path.join(checkout, "index.server.ts"),
  };
  const modelPath = path.join(checkout, "client", "tree-model.ts");
  const fixed = await readFile(modelPath, "utf8");
  await writeFile(modelPath, fixed.replace('from "./paseo-types"', 'from "@getpaseo/client"'));
  await assert.rejects(
    () => compilePlugin(entries),
    /Could not resolve type dependency "@getpaseo\/client"/,
  );
  console.log("Regression reproduced: direct type import fails in a dependency-free Git checkout.");
  await writeFile(modelPath, fixed);
  const result = await compilePlugin(entries);
  assert(result.clientBundle?.length > 0);
  assert(result.serverBundle?.length > 0);
  console.log(
    `Official compiler ${revision.slice(0, 7)}: client and server compile without node_modules.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
