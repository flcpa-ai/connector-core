/**
 * Package guard. Run in CI as `npm run check:package`.
 *
 * This package is only useful if all three connectors can install it without
 * an argument about versions, and if `node --experimental-strip-types` can load
 * one module at a time. Both properties are easy to break by accident with a
 * single convenient import, so they are checked rather than trusted:
 *
 *   1. src/ imports nothing but `node:` built-ins and relative modules. No web
 *      framework, no ORM, no cloud SDK.
 *   2. Only index.ts has relative imports, so every other module stays
 *      self-contained and directly loadable.
 *   3. Relative imports use .js extensions, which is what the emitted ESM
 *      build needs.
 *   4. package.json declares no runtime dependencies.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const BARREL = "src/index.ts";

const IMPORT = /^\s*(?:import|export)\b[^;]*?\bfrom\s+["']([^"']+)["']/gm;
const BARE_IMPORT = /^\s*import\s+["']([^"']+)["']/gm;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

const problems: string[] = [];
const files = walk(SRC).map((f) => relative(ROOT, f).split(sep).join("/"));

for (const file of files) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const specifiers = [
    ...[...text.matchAll(IMPORT)].map((m) => m[1]),
    ...[...text.matchAll(BARE_IMPORT)].map((m) => m[1]),
  ];

  for (const specifier of specifiers) {
    const isRelative = specifier.startsWith(".");

    if (!isRelative && !specifier.startsWith("node:")) {
      problems.push(
        `${file}: imports "${specifier}". src/ may import only node: built-ins and relative modules ` +
          `(CLAUDE.md: no framework, no ORM, no cloud SDK).`,
      );
      continue;
    }

    if (isRelative) {
      if (file !== BARREL) {
        problems.push(
          `${file}: imports "${specifier}". Only ${BARREL} may have relative imports, so every ` +
            `module stays self-contained and loadable on its own.`,
        );
      }
      if (!specifier.endsWith(".js")) {
        problems.push(
          `${file}: imports "${specifier}". Relative imports need a .js extension for the emitted ESM build.`,
        );
      }
    }
  }
}

const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};
const runtimeDeps = Object.keys(manifest.dependencies ?? {});
if (runtimeDeps.length > 0) {
  problems.push(
    `package.json: declares runtime dependencies [${runtimeDeps.join(", ")}]. This package has none ` +
      `on purpose, so three apps can install it without a version negotiation.`,
  );
}

if (problems.length > 0) {
  console.error("Package check FAILED:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Package check passed (${files.length} modules scanned, 0 runtime dependencies).`);
