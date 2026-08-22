/**
 * Build the client bundle for dsh-balance-monitor.
 *
 * Output: lib/client.js — a classic-script bundle in the DSH client-module
 * format:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ...cjs... } })
 *
 * External modules (react, react/jsx-runtime, react-dom/client,
 * @deepseek-ai/*) are resolved by the client module table at runtime; their
 * `require` calls stay verbatim.
 *
 * Usage: node build.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, "src", "client", "index.tsx");
const outRaw = join(root, "lib", ".client.raw.js");
const outFinal = join(root, "lib", "client.js");
const NAME = "dsh-balance-monitor";

mkdirSync(join(root, "lib"), { recursive: true });

const cli = join(root, "node_modules", "esbuild", "bin", "esbuild");
const result = spawnSync(
  process.execPath,
  [
    cli,
    entry,
    "--bundle",
    "--format=cjs",
    "--platform=browser",
    "--target=es2020,chrome100",
    "--jsx=automatic",
    "--charset=utf8",
    "--legal-comments=none",
    "--external:react",
    "--external:react/*",
    "--external:react-dom",
    "--external:react-dom/*",
    "--external:@deepseek-ai/*",
    `--outfile=${outRaw}`,
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  console.error(`esbuild failed with exit code ${result.status}`);
  process.exit(result.status ?? 1);
}

const body = readFileSync(outRaw, "utf8");
const wrapped = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(NAME)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
		return module.exports;
	}
});
`;
writeFileSync(outFinal, wrapped);
const bytes = Buffer.byteLength(wrapped);
console.log(`built lib/client.js (${bytes} bytes)`);
