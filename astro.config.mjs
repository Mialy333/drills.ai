// @ts-check
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

// Keep the old URL so already-installed workers can update and retire themselves.
// The candidate workflow uses live requests; caching dev modules mixed releases.
function retireOfflineWorker() {
  return {
    name: "retire-offline-worker",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        await writeFile(join(fileURLToPath(dir), "sw.js"), `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith("drills-")).map(key => caches.delete(key)));
    await self.registration.unregister();
  })());
});
// No fetch handler: all requests go to the network.
`);
      },
    },
  };
}
export default defineConfig({
  site: "https://mialy333.github.io",
  base: "/drills.ai/",
  trailingSlash: "always",
  integrations: [retireOfflineWorker()],
});
