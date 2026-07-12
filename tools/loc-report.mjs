import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const codeExtensions = new Set([".css", ".mjs", ".ts", ".tsx"]);
const categories = [
  ["Application", ["src/app"]],
  ["Components", ["src/components"]],
  ["Game data", ["src/data"]],
  ["Rules engine", ["src/engine"]],
  ["Styles", ["src/styles"]],
  ["Tests", ["src/tests"]],
  ["Research tools", ["tools"], new Set(["tools/loc-report.mjs"])],
];

async function codeFiles(root, excluded = new Set()) {
  const files = [];

  async function visit(relativeDirectory) {
    for (const entry of await readdir(relativeDirectory, { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(relativePath);
      } else if (codeExtensions.has(path.extname(entry.name)) && !excluded.has(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  await visit(root);
  return files;
}

async function measure(roots, excluded) {
  const files = (await Promise.all(roots.map((root) => codeFiles(root, excluded)))).flat();
  let physical = 0;
  let nonblank = 0;

  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split("\n");
    physical += lines.length - 1;
    nonblank += lines.filter((line) => line.trim()).length;
  }

  return { files: files.length, physical, nonblank };
}

const results = [];
for (const [label, roots, excluded = new Set()] of categories) {
  results.push([label, await measure(roots, excluded)]);
}

const productionLabels = new Set(["Application", "Components", "Game data", "Rules engine", "Styles"]);
const production = results
  .filter(([label]) => productionLabels.has(label))
  .reduce(
    (total, [, value]) => ({
      files: total.files + value.files,
      physical: total.physical + value.physical,
      nonblank: total.nonblank + value.nonblank,
    }),
    { files: 0, physical: 0, nonblank: 0 },
  );

console.table(
  Object.fromEntries([
    ...results.map(([label, value]) => [label, value]),
    ["Production total", production],
  ]),
);
