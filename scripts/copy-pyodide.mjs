// Copies the Pyodide runtime into public/pyodide so the site serves Python itself:
// no third-party CDN, and the service worker can keep it for offline use.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = dirname(require.resolve("pyodide/package.json"));
const dest = new URL("../public/pyodide/", import.meta.url).pathname;
mkdirSync(dest, { recursive: true });
for (const f of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  cpSync(join(src, f), join(dest, f));
}
console.log("pyodide copied to public/pyodide");
