import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const forbiddenContent = [
  "my-building-library",
  "my-gecko-buyer",
  "grounded-research-agent",
  "novamart-multi-agent-support",
  "Black Monday 1987",
  "Ratsimbazafy", "Candriam", "B-Wiize", "SafeHaven", "Northern Trust",
  "Sources utilisées pour les brouillons", "Sources used for the drafts",
  "practice-technical-panel", "practice-pitch-panel",
];
const publicFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else publicFiles.push(path);
  }
}

await walk(root);

const unexpectedRoutes = publicFiles.filter((path) =>
  /[/\\](?:en|fr)[/\\](?:python|drills|learn)[/\\].*index\.html$/.test(path),
);
if (unexpectedRoutes.length) {
  throw new Error(`Archived exercise routes remain public: ${unexpectedRoutes.map(path => relative(root, path)).join(", ")}`);
}

for (const path of publicFiles) {
  if (!path.endsWith(".html") && !path.endsWith(".js") && !path.endsWith(".json")) continue;
  const content = await readFile(path, "utf8");
  const marker = forbiddenContent.find((value) => content.includes(value));
  if (marker) {
    throw new Error(`Public build contains archived creator content (${marker}) in ${path}`);
  }
}

console.log(`Public build verified: ${publicFiles.length} files; no archived drills or creator project references.`);
