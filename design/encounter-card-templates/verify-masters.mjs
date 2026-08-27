import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const templateRoot = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(templateRoot, "manifest.json"), "utf8")
);

const errors = [];

for (const master of manifest.masters) {
  const filePath = path.join(templateRoot, master.path);
  const file = await readFile(filePath);
  const hash = createHash("sha256").update(file).digest("hex");

  if (file.length !== master.byteSize) {
    errors.push(`${master.path}: expected ${master.byteSize} bytes, found ${file.length}`);
  }
  if (hash !== master.sha256) {
    errors.push(`${master.path}: SHA-256 checksum changed`);
  }
  if (file.subarray(0, 4).toString("ascii") !== "8BPS") {
    errors.push(`${master.path}: missing PSD signature`);
    continue;
  }

  const header = {
    version: file.readUInt16BE(4),
    channels: file.readUInt16BE(12),
    height: file.readUInt32BE(14),
    width: file.readUInt32BE(18),
    bitDepth: file.readUInt16BE(22),
    colourMode: file.readUInt16BE(24)
  };

  if (header.version !== 1) errors.push(`${master.path}: expected PSD version 1`);
  if (header.channels !== manifest.canvas.channels) {
    errors.push(`${master.path}: expected ${manifest.canvas.channels} channels, found ${header.channels}`);
  }
  if (header.width !== manifest.canvas.pixelWidth || header.height !== manifest.canvas.pixelHeight) {
    errors.push(`${master.path}: expected ${manifest.canvas.pixelWidth}x${manifest.canvas.pixelHeight}, found ${header.width}x${header.height}`);
  }
  if (header.bitDepth !== manifest.canvas.bitDepth) {
    errors.push(`${master.path}: expected ${manifest.canvas.bitDepth}-bit data, found ${header.bitDepth}-bit`);
  }
  if (header.colourMode !== 4) {
    errors.push(`${master.path}: expected CMYK colour mode (4), found ${header.colourMode}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Verified ${manifest.masters.length} locked encounter-card PSD masters.`);
}
