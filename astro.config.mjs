// @ts-check
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

const BASE = "/python-drills/";

/** Writes dist/sw.js with every built file precached, so the installed app works offline. */
function offline() {
  return {
    name: "offline-service-worker",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir);
        const files = [];
        const walk = async (folder) => {
          for (const entry of await readdir(folder, { withFileTypes: true })) {
            const full = join(folder, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (entry.name !== "sw.js" && !entry.name.endsWith(".map") && !full.includes("/pyodide/")) files.push(full);
          }
        };
        await walk(root);
        const hash = createHash("sha256");
        for (const file of files.sort()) hash.update(await readFile(file));
        const urls = files.map((f) => BASE + relative(root, f).split("\\").join("/").replace(/index\.html$/, ""));
        const sw = `// Generated at build time.
const CACHE = "drills-${hash.digest("hex").slice(0, 12)}";
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  if (request.mode === "navigate") {
    // Pages: fresh when online, cached when not.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("${BASE}"))),
    );
    return;
  }
  // Assets are fingerprinted or rarely change: cache first, and keep what was
  // fetched (the 13 MB Python runtime is cached on first use, not at install).
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
`;
        await writeFile(join(root, "sw.js"), sw);
      },
    },
  };
}

export default defineConfig({
  site: "https://mialy333.github.io",
  base: BASE,
  trailingSlash: "always",
  integrations: [offline()],
});
