import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const tileSourcePath = path.join(repositoryRoot, "src/data/tiles.ts");
const outputRoot = path.join(repositoryRoot, "design/tile-set");
const galleryArgument = process.argv.find((argument) => argument.startsWith("--gallery="));
const galleryPath = galleryArgument ? galleryArgument.slice("--gallery=".length) : null;
const travelPreviewArgument = process.argv.find((argument) => argument.startsWith("--travel-preview="));
const travelPreviewPath = travelPreviewArgument
  ? travelPreviewArgument.slice("--travel-preview=".length)
  : null;
const resourcePreviewArgument = process.argv.find((argument) => argument.startsWith("--resource-preview="));
const resourcePreviewPath = resourcePreviewArgument
  ? resourcePreviewArgument.slice("--resource-preview=".length)
  : null;
const templateVersion = "1.13";

// Alegreya's lining figures share a common cap-height, but each numeral string
// has slightly different visible bounds. These measured values normalize the
// rendered outline to a 194-unit height and centre that outline on the hex.
const specialBackOpticalTuning = Object.freeze({
  1: Object.freeze({ x: 502, y: 419.525, fontSize: 320 }),
  2: Object.freeze({ x: 499.5, y: 419.525, fontSize: 320 }),
  3: Object.freeze({ x: 502.5, y: 419.525, fontSize: 320 }),
  4: Object.freeze({ x: 505, y: 420.525, fontSize: 320 }),
  5: Object.freeze({ x: 503.312, y: 425.454, fontSize: 302.829 }),
  6: Object.freeze({ x: 499.5, y: 419.525, fontSize: 320 }),
  7: Object.freeze({ x: 494.948, y: 418.374, fontSize: 323.333 }),
  8: Object.freeze({ x: 500, y: 419.525, fontSize: 320 }),
  9: Object.freeze({ x: 501, y: 420.525, fontSize: 320 }),
  10: Object.freeze({ x: 494, y: 419.525, fontSize: 320 }),
  11: Object.freeze({ x: 502, y: 419.525, fontSize: 320 }),
  12: Object.freeze({ x: 493.5, y: 419.525, fontSize: 320 }),
  13: Object.freeze({ x: 501.5, y: 419.525, fontSize: 320 }),
  14: Object.freeze({ x: 496.021, y: 420.092, fontSize: 318.359 }),
  15: Object.freeze({ x: 500.473, y: 425.454, fontSize: 302.829 }),
  16: Object.freeze({ x: 496.5, y: 419.525, fontSize: 320 }),
  17: Object.freeze({ x: 493, y: 419.525, fontSize: 320 }),
  18: Object.freeze({ x: 498, y: 419.525, fontSize: 320 }),
  19: Object.freeze({ x: 497.513, y: 420.092, fontSize: 318.359 }),
  20: Object.freeze({ x: 500, y: 419.525, fontSize: 320 }),
  21: Object.freeze({ x: 508, y: 419.525, fontSize: 320 }),
  22: Object.freeze({ x: 499.5, y: 419.525, fontSize: 320 }),
  23: Object.freeze({ x: 507.5, y: 419.525, fontSize: 320 }),
  24: Object.freeze({ x: 501.99, y: 420.092, fontSize: 318.359 }),
  25: Object.freeze({ x: 506.151, y: 425.454, fontSize: 302.829 }),
  26: Object.freeze({ x: 502.5, y: 419.525, fontSize: 320 })
});

const resourceOrder = ["wood", "stone", "metal", "food", "herbs", "goods"];
const resourcePresentation = Object.freeze({
  wood: {
    label: "WOOD",
    iconId: "icon-resource-wood",
    glyph: "log",
    colour: "#5b7c4c"
  },
  stone: {
    label: "STONE",
    iconId: "icon-resource-stone",
    glyph: "faceted-stone",
    colour: "#7e878e"
  },
  metal: {
    label: "METAL",
    iconId: "icon-resource-metal",
    glyph: "ingot",
    colour: "#658597"
  },
  food: {
    label: "FOOD",
    iconId: "icon-resource-food",
    glyph: "wheat",
    colour: "#978d34"
  },
  herbs: {
    label: "HERBS",
    iconId: "icon-resource-herbs",
    glyph: "leaf-sprig",
    colour: "#7b5b89"
  },
  goods: {
    label: "GOODS",
    iconId: "icon-resource-goods",
    glyph: "crate",
    colour: "#95563e"
  }
});

const placementIconSymbols = {
  "any-land": `<symbol id="icon-placement-any-land" viewBox="0 0 100 100">
      <path d="M50 10 84 30v40L50 90 16 70V30Z"/>
    </symbol>`,
  "terrain-grasslands": `<symbol id="icon-placement-terrain-grasslands" viewBox="0 0 100 100">
      <path d="M14 80h72M34 76c0-21-5-35-14-45M50 76V19M66 76c0-18 6-32 17-43"/>
    </symbol>`,
  "terrain-water": `<symbol id="icon-placement-terrain-water" viewBox="0 0 100 100">
      <path d="M12 32c12-12 24-12 36 0s24 12 40 0M12 52c12-12 24-12 36 0s24 12 40 0M12 72c12-12 24-12 36 0s24 12 40 0"/>
    </symbol>`,
  "terrain-woodland": `<symbol id="icon-placement-terrain-woodland" viewBox="0 0 100 100">
      <path d="m50 12-24 34h14L22 69h20v18h16V69h20L60 46h14Z"/>
    </symbol>`,
  "terrain-mountains": `<symbol id="icon-placement-terrain-mountains" viewBox="0 0 100 100">
      <path d="m11 80 30-58 16 31 10-19 22 46Z"/>
    </symbol>`,
  "terrain-heaths": `<symbol id="icon-placement-terrain-heaths" viewBox="0 0 100 100">
      <path d="M14 80h72M30 76V38M50 76V26M70 76V45"/>
      <circle cx="30" cy="32" r="5"/><circle cx="50" cy="20" r="5"/><circle cx="70" cy="39" r="5"/>
    </symbol>`,
  "terrain-arable": `<symbol id="icon-placement-terrain-arable" viewBox="0 0 100 100">
      <path d="M50 86V14M50 32c-13 0-21-6-23-17 13-1 21 5 23 17ZM50 47c13 0 21-6 23-17-13-1-21 5-23 17ZM50 61c-13 0-21-6-23-17 13-1 21 5 23 17ZM50 76c13 0 21-6 23-17-13-1-21 5-23 17Z"/>
    </symbol>`,
  "terrain-ruins": `<symbol id="icon-placement-terrain-ruins" viewBox="0 0 100 100">
      <path d="M14 82h72M26 76V32h18v44M58 76V44h18v32M22 32h26M54 44h26"/>
    </symbol>`,
  "standard-land": `<symbol id="icon-placement-standard-land" viewBox="0 0 100 100"></symbol>`,
  "adjacent-water": `<symbol id="icon-placement-adjacent-water" viewBox="0 0 100 100">
      <path d="M18 17h24l12 21h24l12 21-12 21H54L42 59H18L6 38ZM54 38 42 59"/>
      <path d="M51 54c5-5 10-5 15 0s10 5 16 0M51 65c5-5 10-5 15 0s10 5 16 0"/>
    </symbol>`,
  "adjacent-ruins": `<symbol id="icon-placement-adjacent-ruins" viewBox="0 0 100 100">
      <path d="M18 17h24l12 21h24l12 21-12 21H54L42 59H18L6 38ZM54 38 42 59"/>
      <path d="M53 70h27M58 67V52h7v15M70 67V57h7v10"/>
    </symbol>`,
  "category-resource": `<symbol id="icon-placement-category-resource" viewBox="-64 -64 128 128">
      <path d="M-40-22h80l-9 38h-62Z"/>
      <circle cx="-22" cy="34" r="8"/><circle cx="22" cy="34" r="8"/>
    </symbol>`,
  "category-housing": `<symbol id="icon-placement-category-housing" viewBox="-64 -64 128 128">
      <path d="M-46-6 0-44 46-6M-34-15V40H34V-15"/>
    </symbol>`,
  "category-crafting": `<symbol id="icon-placement-category-crafting" viewBox="-64 -64 128 128">
      <g transform="rotate(-38)"><rect x="-38" y="-34" width="76" height="28" rx="5"/><path d="M0-6V48"/></g>
    </symbol>`,
  "category-merchant": `<symbol id="icon-placement-category-merchant" viewBox="-64 -64 128 128">
      <path d="M0-44V42M-38-27H38M-20 44H20"/>
      <path d="M-30-27-44 8M-30-27-16 8M30-27 16 8M30-27 44 8"/>
      <path d="M-48 8h36l-5 10h-26ZM12 8h36l-5 10H17Z"/>
    </symbol>`,
  "category-social": `<symbol id="icon-placement-category-social" viewBox="-64 -64 128 128">
      <path d="M0 28C-23 14-18-7-4-38c3 18 14 19 18 2 19 22 18 48-14 64Z"/>
      <path d="M-34 43 30 25M30 43-34 25"/>
    </symbol>`,
  "category-wellbeing": `<symbol id="icon-placement-category-wellbeing" viewBox="-64 -64 128 128">
      <circle cx="0" cy="0" r="27"/>
      <path d="M38 0h16M26.87 26.87l11.31 11.31M0 38v16M-26.87 26.87l-11.31 11.31M-38 0h-16M-26.87-26.87l-11.31-11.31M0-38v-16M26.87-26.87l11.31-11.31"/>
    </symbol>`,
  "category-travel": `<symbol id="icon-placement-category-travel" viewBox="-64 -64 128 128">
      <circle cx="0" cy="0" r="45"/><circle cx="0" cy="0" r="8"/>
      <path d="M0 0h37M0 0l26.16 26.16M0 0v37M0 0l-26.16 26.16M0 0h-37M0 0l-26.16-26.16M0 0v-37M0 0l26.16-26.16"/>
    </symbol>`,
  "category-housing-wellbeing": `<symbol id="icon-placement-category-housing-wellbeing" viewBox="0 0 100 100">
      <path d="m8 58 24-20 24 20M14 53v29h36V53"/>
      <circle cx="75" cy="30" r="11"/>
      <path d="M75 12v6M75 42v6M57 30h6M87 30h6"/>
    </symbol>`,
  "named-lumber": `<symbol id="icon-placement-named-lumber" viewBox="0 0 100 100">
      <circle cx="50" cy="51" r="31"/><circle cx="50" cy="51" r="18"/><path d="m50 33-7 9 8 8-6 10 7 9-2 13"/>
    </symbol>`,
  "named-mine": `<symbol id="icon-placement-named-mine" viewBox="0 0 100 100">
      <path d="m12 82 38-64 38 64Z"/>
      <path d="M34 82V59Q50 43 66 59V82"/>
    </symbol>`,
  "named-gathering": `<symbol id="icon-placement-named-gathering" viewBox="-64 -64 128 128">
      <path d="M-40-22h80l-9 38h-62Z"/>
      <circle cx="-22" cy="34" r="8"/><circle cx="22" cy="34" r="8"/>
    </symbol>`,
  "named-farm": `<symbol id="icon-placement-named-farm" viewBox="0 0 100 100">
      <path d="M50 87V14M50 34c-14 0-22-7-24-18 14-1 22 5 24 18ZM50 50c14 0 22-7 24-18-14-1-22 5-24 18ZM50 65c-14 0-22-7-24-18 14-1 22 5 24 18ZM50 80c14 0 22-7 24-18-14-1-22 5-24 18Z"/>
    </symbol>`,
  "named-dig-site": `<symbol id="icon-placement-named-dig-site" viewBox="0 0 100 100">
      <path d="M40 17h20M50 17v43"/>
      <path d="M36 60h28L58 84H42Z"/>
    </symbol>`,
  "rule": `<symbol id="icon-placement-rule" viewBox="0 0 100 100">
      <path d="M50 89S20 62 20 39a30 30 0 0 1 60 0c0 23-30 50-30 50Z"/><circle cx="50" cy="39" r="10"/>
    </symbol>`
};

const placementIconIds = new Set(
  Object.keys(placementIconSymbols).map((key) => `icon-placement-${key}`)
);
const blankPlacementIconKeys = new Set(["any-land", "standard-land"]);
const tileTypeCategories = new Set([
  "resource",
  "housing",
  "crafting",
  "merchant",
  "social",
  "wellbeing",
  "travel"
]);
const tileTypeGlyphs = Object.freeze({
  resource: "gathering-cart",
  housing: "cottage",
  crafting: "mallet",
  merchant: "scales",
  social: "bonfire",
  wellbeing: "sunburst",
  travel: "wagon-wheel"
});

function placementIconDefinitions() {
  return `\n    ${Object.values(placementIconSymbols).join("\n    ")}`;
}

function loadTileData() {
  const source = fs.readFileSync(tileSourcePath, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const moduleRecord = { exports: {} };
  const sourceRequire = createRequire(tileSourcePath);
  const evaluate = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    javascript
  );
  evaluate(
    moduleRecord.exports,
    sourceRequire,
    moduleRecord,
    tileSourcePath,
    path.dirname(tileSourcePath)
  );
  return moduleRecord.exports;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("’", "&#x2019;")
    .replaceAll("—", "&#x2014;")
    .replaceAll("•", "&#x2022;");
}

function displayTypography(value) {
  return String(value)
    .replace(/([A-Za-z])'([A-Za-z])/g, "$1’$2")
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value) {
  const text = displayTypography(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function estimateTextWidth(text, fontSize, family = "body") {
  let units = 0;
  for (const character of String(text)) {
    if (character === " ") units += 0.27;
    else if ("MW@%&".includes(character)) units += 0.82;
    else if (/[A-Z0-9]/.test(character)) units += 0.61;
    else if (/[ilI1'’.,:;!|]/.test(character)) units += 0.25;
    else if (/[mw]/.test(character)) units += 0.72;
    else if (/[()\-+/]/.test(character)) units += 0.37;
    else units += 0.5;
  }
  const familyFactor = family === "title" ? 1.03 : family === "sans" ? 1.04 : 1;
  return units * fontSize * familyFactor;
}

function wrapAtSize(text, fontSize, widths, family = "body") {
  const words = displayTypography(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = "";
  let lineIndex = 0;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize, family) <= widths[lineIndex]) {
      current = candidate;
      continue;
    }
    if (!current || lineIndex + 1 >= widths.length) return null;
    lines.push(current);
    current = word;
    lineIndex += 1;
    if (estimateTextWidth(current, fontSize, family) > widths[lineIndex]) return null;
  }
  lines.push(current);
  return lines;
}

function blockBaselines(lineCount, fontSize, top, bottom) {
  const lineHeight = fontSize * 1.2;
  const blockHeight = fontSize + Math.max(0, lineCount - 1) * lineHeight;
  const firstBaseline = top + (bottom - top - blockHeight) / 2 + fontSize * 0.79;
  return Array.from({ length: lineCount }, (_, index) => firstBaseline + index * lineHeight);
}

function fitTextBlock(text, options) {
  const {
    maxFontSize,
    minFontSize,
    maxLines,
    top,
    bottom,
    widthAtY,
    family = "body",
    enforceVerticalFit = false
  } = options;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    for (let requestedLines = 1; requestedLines <= maxLines; requestedLines += 1) {
      const requestedBlockHeight = fontSize + Math.max(0, requestedLines - 1) * fontSize * 1.2;
      if (enforceVerticalFit && requestedBlockHeight > bottom - top) continue;
      const requestedBaselines = blockBaselines(requestedLines, fontSize, top, bottom);
      const requestedWidths = requestedBaselines.map(widthAtY);
      const initialLines = wrapAtSize(text, fontSize, requestedWidths, family);
      if (!initialLines || initialLines.length > requestedLines) continue;

      const baselines = blockBaselines(initialLines.length, fontSize, top, bottom);
      const widths = baselines.map(widthAtY);
      const lines = wrapAtSize(text, fontSize, widths, family);
      if (lines && lines.length === initialLines.length) {
        return { fontSize, lines, baselines, widths };
      }
    }
  }

  throw new Error(`Text cannot fit the locked field: ${text}`);
}

function splitTitle(name, maxFontSize) {
  const text = displayTypography(name);
  const maximumWidth = 350;
  if (estimateTextWidth(text, maxFontSize, "title") <= maximumWidth) {
    return {
      fontSize: maxFontSize,
      lines: [text],
      baselines: [75]
    };
  }

  const words = text.split(" ");
  if (words.length === 1) {
    const fontSize = Math.max(
      30,
      Math.min(maxFontSize, Math.floor(maxFontSize * maximumWidth / estimateTextWidth(text, maxFontSize, "title")))
    );
    return { fontSize, lines: [text], baselines: [75] };
  }

  let best = null;
  for (let index = 1; index < words.length; index += 1) {
    const lines = [words.slice(0, index).join(" "), words.slice(index).join(" ")];
    const widest = Math.max(...lines.map((line) => estimateTextWidth(line, maxFontSize, "title")));
    const imbalance = Math.abs(
      estimateTextWidth(lines[0], maxFontSize, "title") -
      estimateTextWidth(lines[1], maxFontSize, "title")
    );
    const score = widest + imbalance * 0.18;
    if (!best || score < best.score) best = { lines, widest, score };
  }

  const fontSize = Math.max(
    30,
    Math.min(maxFontSize, Math.floor(maxFontSize * maximumWidth / best.widest))
  );
  return { fontSize, lines: best.lines, baselines: [55, 98] };
}

function renderTitle(name, maxFontSize = 48) {
  const layout = splitTitle(name, maxFontSize);
  return layout.lines.map((line, index) =>
    `    <text class="title" data-field="tile-name-line-${index + 1}" x="500" y="${layout.baselines[index]}" text-anchor="middle" style="font-size:${layout.fontSize}px" data-safe-x1="320" data-safe-x2="680">${escapeXml(line)}</text>`
  ).join("\n");
}

function placementSummary(tile) {
  const placement = tile.placement;
  if (!placement) return ["ANY LAND"];
  const text = placement.text ?? "";

  if (/Grasslands, Woodland, or Arable Land/i.test(text) && /Not adjacent/i.test(text)) {
    return ["GRASS • WOOD • ARABLE", "NOT ADJ. RIVER"];
  }
  if (/non-River hex adjacent to River/i.test(text)) return ["ADJ. RIVER"];
  if (/Mountains, Heaths, Woodland, Arable Land, or Ruins/i.test(text)) {
    return ["NON-GRASS", "NON-RIVER"];
  }
  if (/Grasslands, Woodland, or Ruins/i.test(text)) return ["GRASS • WOOD • RUINS"];
  if (/any non-River hex/i.test(text)) return ["NON-RIVER"];

  if (placement.terrain?.length === 1) {
    const terrain = placement.terrain[0];
    return [{
      grasslands: "GRASSLANDS",
      water: "WATER / RIVER",
      woodland: "WOODLAND",
      mountains: "MOUNTAINS",
      heaths: "HEATHS",
      arable: "ARABLE LAND",
      ruins: "RUINS"
    }[terrain] ?? terrain.toUpperCase()];
  }

  if (placement.adjacentToCategory?.length) {
    return [`ADJ. ${placement.adjacentToCategory.map((category) => category.toUpperCase()).join(" / ")}`];
  }
  if (placement.adjacentToTerrain?.length) {
    const terrains = placement.adjacentToTerrain.map((terrain) => terrain === "water" ? "RIVER" : terrain.toUpperCase());
    return [`ADJ. ${terrains.join(" / ")}`];
  }
  if (placement.adjacentToTileIds?.length) {
    const lineageNames = {
      c01_lumber_yard: "LUMBER",
      c02_mine_tunnel: "MINE",
      c03_gathering_outpost: "GATHERING",
      c04_farmstead: "FARM",
      c20_dig_site: "SALVAGE CAMP"
    };
    return [`ADJ. ${placement.adjacentToTileIds.map((id) => lineageNames[id] ?? "NAMED TILE").join(" / ")}`];
  }
  return ["PLACEMENT RULE"];
}

function placementDescriptor(tile) {
  const placement = tile.placement;
  const lines = placementSummary(tile);
  const text = placement?.text ?? "Place on any land.";
  let iconKey = "rule";
  let kind = "rule";

  if (!placement) {
    iconKey = "any-land";
    kind = "any-land";
  } else if (/non-River hex adjacent to River/i.test(text)) {
    iconKey = "adjacent-water";
    kind = "adjacent-terrain";
  } else if (/Grasslands, Woodland, or Arable Land/i.test(text) && /Not adjacent/i.test(text)) {
    iconKey = "standard-land";
    kind = "standard-land";
  } else if (/any non-River hex/i.test(text)) {
    iconKey = "standard-land";
    kind = "standard-land";
  } else if (/Mountains, Heaths, Woodland, Arable Land, or Ruins/i.test(text)) {
    iconKey = "standard-land";
    kind = "standard-land";
  } else if (/Grasslands, Woodland, or Ruins/i.test(text)) {
    iconKey = "standard-land";
    kind = "standard-land";
  } else if (placement.adjacentToCategory?.length) {
    const categories = placement.adjacentToCategory;
    iconKey = categories.length === 1
      ? `category-${categories[0]}`
      : categories.includes("housing") && categories.includes("wellbeing")
        ? "category-housing-wellbeing"
        : "rule";
    kind = "adjacent-category";
  } else if (placement.adjacentToTerrain?.length) {
    const terrains = placement.adjacentToTerrain;
    iconKey = terrains.length === 1 && terrains[0] === "water"
      ? "adjacent-water"
      : terrains.length === 1 && terrains[0] === "ruins"
        ? "adjacent-ruins"
        : "rule";
    kind = "adjacent-terrain";
  } else if (placement.adjacentToTileIds?.length) {
    const namedTileIcons = {
      c01_lumber_yard: "named-lumber",
      c02_mine_tunnel: "named-mine",
      c03_gathering_outpost: "named-gathering",
      c04_farmstead: "named-farm",
      c20_dig_site: "named-dig-site"
    };
    iconKey = placement.adjacentToTileIds.length === 1
      ? namedTileIcons[placement.adjacentToTileIds[0]] ?? "rule"
      : "rule";
    kind = "adjacent-named-tile";
  } else if (placement.terrain?.length === 1) {
    iconKey = `terrain-${placement.terrain[0]}`;
    kind = "terrain";
  } else if (placement.terrain?.length) {
    iconKey = "standard-land";
    kind = "standard-land";
  }

  const iconId = `icon-placement-${iconKey}`;
  if (!placementIconIds.has(iconId)) {
    throw new Error(`No placement icon definition for ${tile.id}: ${iconId}`);
  }
  return { iconId, iconKey, kind, lines, text };
}

function tileTypeDescriptor(tile) {
  if (tile.golden === true) {
    return {
      iconId: "icon-crown",
      iconKey: "golden",
      label: "GOLDEN",
      type: "golden",
      glyph: "crown"
    };
  }

  const category = String(tile.category ?? "").toLowerCase();
  if (!tileTypeCategories.has(category)) {
    throw new Error(`No top-left tile type icon mapping for ${tile.id}: ${category || "(missing category)"}`);
  }

  const iconKey = `category-${category}`;
  const iconId = `icon-placement-${iconKey}`;
  if (!placementIconIds.has(iconId)) {
    throw new Error(`No top-left tile type icon definition for ${tile.id}: ${iconId}`);
  }

  return {
    iconId,
    iconKey,
    label: category.toUpperCase(),
    type: category,
    glyph: tileTypeGlyphs[category]
  };
}

function fitCornerLines(lines) {
  const text = lines.join(" ");
  if (lines.length === 1 && text === "ADJ. SALVAGE CAMP") {
    return { fontSize: 15, lines: ["ADJ. SALVAGE", "CAMP"], baselines: [117, 136] };
  }
  if (lines.length === 1 && estimateTextWidth(text, 16, "sans") <= 170) {
    return { fontSize: 16, lines, baselines: [125] };
  }

  const normalizedLines = lines.length > 1 ? lines : (() => {
    const words = text.split(" ");
    let best = [text, ""];
    let score = Number.POSITIVE_INFINITY;
    for (let index = 1; index < words.length; index += 1) {
      const candidate = [words.slice(0, index).join(" "), words.slice(index).join(" ")];
      const candidateScore = Math.max(...candidate.map((line) => estimateTextWidth(line, 16, "sans")));
      if (candidateScore < score) {
        score = candidateScore;
        best = candidate;
      }
    }
    return best.filter(Boolean);
  })();

  let fontSize = 15;
  while (fontSize > 12 && normalizedLines.some((line) => estimateTextWidth(line, fontSize, "sans") > 180)) {
    fontSize -= 1;
  }
  return { fontSize, lines: normalizedLines, baselines: normalizedLines.length === 1 ? [125] : [117, 136] };
}

function renderCornerLabel(lines, x, field) {
  const fitted = fitCornerLines(lines);
  return fitted.lines.map((line, index) =>
    `    <text class="corner" data-field="${field}-${index + 1}" x="${x}" y="${fitted.baselines[index]}" text-anchor="middle" style="font-size:${fitted.fontSize}px" data-safe-x1="${x - 96}" data-safe-x2="${x + 96}">${escapeXml(line)}</text>`
  ).join("\n");
}

function headerContent(tile, name, sideLabel, variant) {
  const placement = placementDescriptor(tile);
  const tileType = tileTypeDescriptor(tile);
  const requirementLines = placement.lines;
  const isGolden = variant === "golden";
  const isSpecial = variant === "special";
  const iconRequirement = placement.iconId;
  const outline = isGolden || variant === "core-upgraded" ? "#50665c" : isSpecial ? "#4d6470" : "#50665c";
  const titleMaximum = variant === "core-basic" ? 60 : 48;
  const placementContent = blankPlacementIconKeys.has(placement.iconKey)
    ? ""
    : `    <circle cx="727" cy="67" r="34" fill="#f4ead6" stroke="${outline}" stroke-width="2.4"/>
    <g class="icon-dark" data-placement-icon="${escapeXml(placement.iconKey)}" data-placement-kind="${escapeXml(placement.kind)}" transform="translate(697 37) scale(.6)"><use href="#${iconRequirement}" width="100" height="100"/></g>
${renderCornerLabel(requirementLines, 727, "requirement-label")}`;

  return `    <circle cx="273" cy="67" r="34" fill="#f4ead6" stroke="${outline}" stroke-width="2.4"/>
    <g class="icon-dark" data-tile-type-icon="${escapeXml(tileType.iconKey)}" data-tile-type="${escapeXml(tileType.type)}" data-tile-type-glyph="${escapeXml(tileType.glyph)}" transform="translate(243 37) scale(.6)"><use href="#${tileType.iconId}" width="100" height="100"/></g>
${renderCornerLabel([tileType.label], 273, "category-label")}
${placementContent}
${renderTitle(name, titleMaximum)}
    <text class="side" x="500" y="132" text-anchor="middle">${escapeXml(sideLabel)}</text>`;
}

function renderScoreBadge(kind, value, side) {
  const isPopulation = kind === "population";
  const x = side === "left" ? 93 : 907;
  const valueX = side === "left" ? 58 : -58;
  const icon = isPopulation ? "icon-population" : "icon-renown";
  const label = isPopulation ? "POPULATION" : "RENOWN";
  return `    <g data-field="${kind}" transform="translate(${x} 383)">
      <g class="score-icon" transform="translate(-23 -23) scale(.46)"><use href="#${icon}" width="100" height="100"/></g>
      <text class="score-value" x="${valueX}" y="13" text-anchor="middle">${value}</text>
      <text class="score-label" x="${valueX}" y="36" text-anchor="middle">${label}</text>
    </g>`;
}

function renderScoreBadges(population, renown) {
  return [
    renderScoreBadge("population", population, "left"),
    renderScoreBadge("renown", renown, "right")
  ].join("\n");
}

function populatedCostItems(cost) {
  return resourceOrder
    .filter((resource) => Number(cost?.[resource] ?? 0) > 0)
    .map((resource) => ({ resource, quantity: Number(cost[resource]) }));
}

function parseAlternateCostItems(alternateCostText) {
  if (!alternateCostText) return null;
  const parts = displayTypography(alternateCostText).split(/\s+or\s+/i);
  if (parts.length < 2) return null;

  const items = parts.map((part) => {
    const match = part.match(/^(\d+)\s+(wood|stone|metal|food|herbs|goods)$/i);
    return match
      ? { resource: match[2].toLowerCase(), quantity: Number(match[1]) }
      : null;
  });
  return items.every(Boolean) ? items : null;
}

function displayedCostItems(face) {
  if (face?.alternateCostText) {
    return parseAlternateCostItems(face.alternateCostText) ?? [];
  }
  return populatedCostItems(face?.cost);
}

function resourceTokenLayout(items, alternative) {
  const fontSize = 29;
  const quantityWidth = 22;
  const iconWidth = 32;
  const iconGap = 9;
  const labelGap = 7;
  const tokenWidths = items.map(({ resource }) =>
    iconWidth + iconGap + quantityWidth + labelGap
      + estimateTextWidth(resourcePresentation[resource].label, fontSize, "sans")
  );
  const connectorFontSize = 19;
  const costRegionCentre = 600;
  const spacing = alternative
    ? 260
    : items.length === 3
      ? 185
      : items.length === 2
        ? 210
        : 0;
  const slotCentres = items.map((_, index) =>
    costRegionCentre + (index - (items.length - 1) / 2) * spacing
  );
  const extents = slotCentres.map((centre, index) => ({
    left: centre - tokenWidths[index] / 2,
    right: centre + tokenWidths[index] / 2
  }));
  for (let index = 0; index < extents.length - 1; index += 1) {
    const connectorClearance = alternative
      ? estimateTextWidth("OR", connectorFontSize, "sans") + 24
      : 18;
    if (extents[index + 1].left - extents[index].right < connectorClearance) {
      throw new Error(`Resource row cannot maintain clean spacing: ${items.map((item) => item.resource).join(", ")}`);
    }
  }
  return {
    fontSize,
    quantityWidth,
    iconWidth,
    iconGap,
    labelGap,
    tokenWidths,
    connectorFontSize,
    costRegionCentre,
    slotCentres,
    extents
  };
}

function renderResourceTokens(items, y, rowName, alternative = false) {
  const layout = resourceTokenLayout(items, alternative);
  const markup = [];

  items.forEach(({ resource, quantity }, index) => {
    const presentation = resourcePresentation[resource];
    const tokenWidth = layout.tokenWidths[index];
    const slotCentre = layout.slotCentres[index];
    const cursor = slotCentre - tokenWidth / 2;
    const quantityX = layout.iconWidth + layout.iconGap + layout.quantityWidth / 2;
    const labelX = layout.iconWidth + layout.iconGap + layout.quantityWidth + layout.labelGap;
    markup.push(`    <g class="resource-token" data-field="${rowName}-cost-${resource}" data-cost-row="${rowName}" data-resource="${resource}" data-resource-icon="${presentation.glyph}" data-resource-colour="${presentation.colour}" data-row-centre="${layout.costRegionCentre}" data-slot-centre="${slotCentre.toFixed(2)}" data-token-width="${tokenWidth.toFixed(2)}" transform="translate(${cursor.toFixed(2)} ${y})">
      <g class="resource-icon resource-icon-${resource}" transform="translate(0 3) scale(.5)"><use href="#${presentation.iconId}" width="64" height="64"/></g>
      <text class="resource-quantity" x="${quantityX.toFixed(2)}" y="31" text-anchor="middle" style="font-size:${layout.fontSize}px">${quantity}</text>
      <text class="resource-name" x="${labelX.toFixed(2)}" y="31" style="font-size:${layout.fontSize}px">${presentation.label}</text>
    </g>`);
    if (index < items.length - 1) {
      if (alternative) {
        const connectorX = (layout.slotCentres[index] + layout.slotCentres[index + 1]) / 2;
        markup.push(`    <text class="resource-or" data-field="${rowName}-cost-or-${index + 1}" x="${connectorX.toFixed(2)}" y="${y + 30}" text-anchor="middle" style="font-size:${layout.connectorFontSize}px">OR</text>`);
      }
    }
  });

  return markup.join("\n");
}

function renderCostRow(cost, alternateCostText, y, rowName) {
  const alternateItems = parseAlternateCostItems(alternateCostText);
  if (alternateItems) {
    return renderResourceTokens(alternateItems, y, rowName, true);
  }

  if (alternateCostText) {
    return `    <text class="cost" data-field="${rowName}-cost-alternative" x="600" y="${y + 31}" text-anchor="middle" style="font-size:29px" data-safe-x1="270" data-safe-x2="930">${escapeXml(displayTypography(alternateCostText).toUpperCase())}</text>`;
  }

  const items = populatedCostItems(cost);
  if (!items.length) {
    return `    <text class="cost" data-field="${rowName}-cost-free" x="600" y="${y + 31}" text-anchor="middle" style="font-size:29px" data-safe-x1="270" data-safe-x2="930">FREE</text>`;
  }
  return renderResourceTokens(items, y, rowName);
}

function normalizedEffect(effectText, kind) {
  let source = displayTypography(effectText);
  if (kind === "core") {
    source = source.replace(/ Passive: Linked Production —.*$/, " Linked Production.");
  }

  const patterns = [
    [/^Activated Effect, once per Season:\s*/i, "ONCE PER SEASON"],
    [/^Activated Effect, once per round:\s*/i, "ONCE PER ROUND"],
    [/^Once per Season,\s*/i, "ONCE PER SEASON"],
    [/^Once per round,\s*/i, "ONCE PER ROUND"],
    [/^Activated Effect:\s*/i, "ACTIVATE"],
    [/^Activate:\s*/i, "ACTIVATE"],
    [/^When placed or activated:\s*/i, "PLACED OR ACTIVATED"],
    [/^Passive:\s*/i, "PERSISTENT EFFECT"]
  ];

  for (const [pattern, label] of patterns) {
    if (pattern.test(source)) {
      return { label, body: sentenceCase(source.replace(pattern, "")) };
    }
  }
  return { label: kind === "golden" ? "PERSISTENT EFFECT" : "EFFECT", body: sentenceCase(source) };
}

function hexSafeWidth(y, margin = 44) {
  if (y <= 433.0127) return 1000 - margin * 2;
  const inset = (y - 433.0127) * 250 / 433.0127;
  return 1000 - inset * 2 - margin * 2;
}

function renderTextBlock(layout, className, fieldPrefix) {
  return layout.lines.map((line, index) => {
    const width = layout.widths[index];
    return `    <text class="${className}" data-field="${fieldPrefix}-${index + 1}" x="500" y="${layout.baselines[index].toFixed(2)}" text-anchor="middle" style="font-size:${layout.fontSize}px" data-safe-width="${width.toFixed(2)}">${escapeXml(line)}</text>`;
  }).join("\n");
}

function artworkSafeWidth(y, margin = 72) {
  const progress = Math.max(0, Math.min(1, (y - 150) / 280));
  const inset = 163 + (1.739 - 163) * progress;
  return 1000 - inset * 2 - margin * 2;
}

function renderArtworkPlaceholder(name) {
  const layout = fitTextBlock(`${displayTypography(name)} Image`, {
    maxFontSize: 78,
    minFontSize: 40,
    maxLines: 3,
    top: 175,
    bottom: 365,
    widthAtY: (y) => artworkSafeWidth(y),
    family: "title",
    enforceVerticalFit: true
  });
  return renderTextBlock(layout, "artwork-placeholder", "artwork-image");
}

function renderCoreEffect(effectText) {
  const effect = normalizedEffect(effectText, "core");
  const layout = fitTextBlock(effect.body, {
    maxFontSize: 38,
    minFontSize: 28,
    maxLines: 4,
    top: 686,
    bottom: 818,
    widthAtY: (y) => hexSafeWidth(y, 48)
  });
  return {
    label: effect.label,
    printedText: effect.body,
    markup: `    <text class="kicker" data-field="effect-type" x="500" y="647" text-anchor="middle">${escapeXml(effect.label)}</text>
${renderTextBlock(layout, "effect-copy", "effect-line")}`
  };
}

function renderSpecialEffect(effectText) {
  const effect = normalizedEffect(effectText, "special");
  const layout = fitTextBlock(effect.body, {
    maxFontSize: 34,
    minFontSize: 25,
    maxLines: 5,
    top: 610,
    bottom: 818,
    widthAtY: (y) => hexSafeWidth(y, 50)
  });
  return {
    label: effect.label,
    printedText: effect.body,
    markup: `    <text class="kicker" data-field="effect-type" x="500" y="572" text-anchor="middle">${escapeXml(effect.label)}</text>
${renderTextBlock(layout, "rules-copy", "effect-line")}`
  };
}

function renderGoldenEffect(effectText) {
  const effect = normalizedEffect(effectText, "golden");
  const layout = fitTextBlock(effect.body, {
    maxFontSize: 30,
    minFontSize: 24,
    maxLines: 3,
    top: 570,
    bottom: 665,
    widthAtY: (y) => hexSafeWidth(y, 52)
  });
  return {
    label: "PERSISTENT EFFECT",
    printedText: effect.body,
    markup: `    <text class="kicker" data-field="effect-type" x="500" y="548" text-anchor="middle">PERSISTENT EFFECT</text>
${renderTextBlock(layout, "rules-copy", "effect-line")}`
  };
}

function normalizedScoring(scoringText) {
  const source = displayTypography(scoringText);
  if (/adjacent to at least four different tile categories/i.test(source)) {
    return "Adjacent to four different tile categories.";
  }
  if (/surrounded by six non-Overstrained placed tiles/i.test(source)) {
    return "Surrounded by six non-Overstrained tiles.";
  }
  if (/placed tiles on both sides of the river connected by a Bridge or Stone Bridge/i.test(source)) {
    return "Non-Overstrained tiles span both riverbanks via a Bridge or Stone Bridge.";
  }
  if (/placed tiles on at least four terrain types other than River\/Water/i.test(source)) {
    return "Non-Overstrained tiles occupy four non-River terrain types.";
  }
  if (/game ends with 0 Overstrained tiles/i.test(source)) {
    return "End with no Overstrained tiles.";
  }
  const body = source.replace(/^\+5 Renown if\s+/i, "");
  return sentenceCase(body);
}

function renderGoldenScoring(scoringText) {
  const printedText = normalizedScoring(scoringText);
  const layout = fitTextBlock(printedText, {
    maxFontSize: 30,
    minFontSize: 28,
    maxLines: 3,
    top: 744,
    bottom: 830,
    widthAtY: (y) => hexSafeWidth(y, 54)
  });
  return {
    printedText,
    markup: `    <g class="score-icon" transform="translate(386 694) scale(.36)"><use href="#icon-renown" width="100" height="100"/></g>
    <text class="score-kicker" x="445" y="727">+5 RENOWN</text>
${renderTextBlock(layout, "score-copy", "scoring-line")}`
  };
}

function extraDefinitions() {
  return `
    <symbol id="icon-population" viewBox="0 0 100 100"><circle cx="50" cy="35" r="16"/><path d="M19 82c5-22 18-31 31-31s26 9 31 31"/></symbol>
    <symbol id="icon-renown" viewBox="0 0 100 100"><path d="M43 83C24 68 23 40 36 18M57 83c19-15 20-43 7-65"/><path d="M36 64C27 64 22 60 20 53c9 0 14 4 16 11ZM33 46C25 45 21 40 21 33c8 1 12 6 12 13ZM64 64c9 0 14-4 16-11-9 0-14 4-16 11ZM67 46c8-1 12-6 12-13-8 1-12 6-12 13Z"/></symbol>
    <style>
      .score-value{font-family:Alegreya,Georgia,serif;font-size:45px;fill:#26221b}
      .score-label{font-family:'Alegreya Sans',Arial,sans-serif;font-size:16px;font-weight:500;letter-spacing:1.2px;fill:#50665c}
      .score-icon{fill:none;stroke:#50665c;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}
    </style>`;
}

function prepareMaster(masterName, metadata) {
  let svg = fs.readFileSync(path.join(scriptDirectory, masterName), "utf8");
  svg = svg.replaceAll("../../src/assets/fonts/", "../../../src/assets/fonts/");
  svg = svg.replace(
    /<svg /,
    `<svg data-template-version="${templateVersion}" data-source-id="${escapeXml(metadata.id)}" data-kind="${escapeXml(metadata.kind)}" data-face="${escapeXml(metadata.face)}" data-footprint="${escapeXml(metadata.footprint)}" data-size-hexes="${metadata.size}" `
  );
  svg = svg.replace(/<title id="title">[\s\S]*?<\/title>/, `<title id="title">${escapeXml(metadata.title)}</title>`);
  svg = svg.replace(/<desc id="desc">[\s\S]*?<\/desc>/, `<desc id="desc">${escapeXml(metadata.description)}</desc>`);
  if (masterName !== "special-numbered-back-master.svg" && masterName !== "core-extension-master.svg") {
    svg = svg.replace(/\n\s*<symbol id="icon-placement-[^"]+"[\s\S]*?<\/symbol>/g, "");
    svg = svg.replace("  </defs>", `${placementIconDefinitions()}\n  </defs>`);
  }
  if (masterName === "core-basic-master.svg" && !svg.includes('<symbol id="icon-population"')) {
    svg = svg.replace("  </defs>", `${extraDefinitions()}\n  </defs>`);
  }
  return svg;
}

function replaceArtwork(svg, name) {
  return svg.replace(
    /(<g id="artwork"[^>]*>)[\s\S]*?(<\/g>)/,
    `$1\n${renderArtworkPlaceholder(name)}\n  $2`
  );
}

function replaceContent(svg, content) {
  return svg.replace(
    /  <g id="content"[\s\S]*?(?=\n  <g id="trim")/,
    `  <g id="content" inkscape:groupmode="layer" inkscape:label="Editable content">\n${content}\n  </g>\n`
  );
}

function sourceMetadata(tile, face, sourceEffectText) {
  const placement = placementDescriptor(tile);
  const tileType = tileTypeDescriptor(tile);
  const size = tile.size ?? 1;
  return `    <metadata>
      <tile-source id="${escapeXml(tile.id)}" face="${escapeXml(face)}" category="${escapeXml(tile.category)}" tile-type="${escapeXml(tileType.type)}" tile-type-icon="${escapeXml(tileType.iconKey)}" tile-type-glyph="${escapeXml(tileType.glyph)}" copies="${tile.count}" size-hexes="${size}" print-units-per-copy="${size}" printed-hexes="${tile.count * size}" footprint="${escapeXml(tile.footprint ?? (size > 1 ? "line" : "single"))}" placement-icon="${escapeXml(placement.iconKey)}">
        <placement>${escapeXml(placement.text)}</placement>
        <effect>${escapeXml(sourceEffectText)}</effect>
      </tile-source>
    </metadata>`;
}

function isTravelLineTile(tile) {
  return tile.category === "travel"
    && (tile.size ?? 1) > 1
    && (tile.footprint ?? "line") === "line";
}

function renderTravelAssemblyInstruction(tile) {
  if (!isTravelLineTile(tile)) return "";
  const extensionCount = (tile.size ?? 1) - 1;
  const noun = extensionCount === 1 ? "HEX" : "HEXES";
  return `    <text class="assembly-note" data-field="travel-extension-instruction" x="500" y="615" text-anchor="middle">PLACE WITH ${extensionCount} TRAVEL EXTENSION ${noun}</text>`;
}

function generateCoreBasic(tile) {
  const face = tile.basic;
  const footprint = tile.footprint ?? (tile.size > 1 ? "line" : "single");
  const effect = renderCoreEffect(face.effectText);
  const hasScore = face.population !== 0 || face.renown !== 0;
  const content = `${sourceMetadata(tile, "basic", face.effectText)}
${headerContent(tile, face.name, "CORE • BASIC", "core-basic")}
${hasScore ? renderScoreBadges(face.population, face.renown) : ""}

    <text class="row-label" x="105" y="481">PLACE</text>
${renderCostRow(face.cost, face.alternateCostText, 445, "place")}

    <text class="row-label" x="89" y="561">UPGRADE</text>
${renderCostRow(tile.upgraded.cost, tile.upgraded.alternateCostText, 525, "upgrade")}

${renderTravelAssemblyInstruction(tile)}
${effect.markup}`;
  const svg = prepareMaster("core-basic-master.svg", {
    id: tile.id,
    kind: "core",
    face: "basic",
    footprint,
    size: tile.size,
    title: `${face.name} — Core basic tile`,
    description: `Dimension-locked 60 millimetre Core basic face for ${face.name}, with a fitted artwork placeholder.`
  });
  return {
    svg: replaceContent(replaceArtwork(svg, face.name), content),
    effectLabel: effect.label,
    printedEffectText: effect.printedText
  };
}

function generateCoreUpgraded(tile) {
  const face = tile.upgraded;
  const footprint = tile.footprint ?? (tile.size > 1 ? "line" : "single");
  const effect = renderCoreEffect(face.effectText);
  const lineageLayout = fitTextBlock(tile.basic.name, {
    maxFontSize: 45,
    minFontSize: 32,
    maxLines: 1,
    top: 509,
    bottom: 565,
    widthAtY: () => 650,
    family: "title"
  });
  const content = `${sourceMetadata(tile, "upgraded", face.effectText)}
${headerContent(tile, face.name, "CORE • UPGRADED", "core-upgraded")}
${renderScoreBadges(face.population, face.renown)}

    <text class="lineage-kicker" x="500" y="488" text-anchor="middle">UPGRADED FROM</text>
${renderTextBlock(lineageLayout, "lineage-name", "basic-name")}

${renderTravelAssemblyInstruction(tile)}
${effect.markup}`;
  const svg = prepareMaster("core-upgraded-master.svg", {
    id: tile.id,
    kind: "core",
    face: "upgraded",
    footprint,
    size: tile.size,
    title: `${face.name} — Core upgraded tile`,
    description: `Dimension-locked 60 millimetre Core upgraded face for ${face.name}, with a fitted artwork placeholder.`
  });
  return {
    svg: replaceContent(replaceArtwork(svg, face.name), content),
    effectLabel: effect.label,
    printedEffectText: effect.printedText
  };
}

function generateCoreExtension(face, compatibleSourceTileIds, compatibleComponentSizes, copies) {
  if (face !== "basic" && face !== "upgraded") {
    throw new Error(`Invalid generic Travel extension face: ${face}`);
  }
  const content = `    <metadata>
      <tile-extension id="travel_extension" face="${escapeXml(face)}" category="travel" compatible-source-tile-ids="${escapeXml(compatibleSourceTileIds.join(" "))}" compatible-component-sizes="${escapeXml(compatibleComponentSizes.join(" "))}" copies="${copies}" artwork-window="standard" street-extension-count="1" track-extension-count="2"/>
    </metadata>
    <text class="title" data-field="extension-title" x="500" y="74" text-anchor="middle">Travel Extension</text>
    <text class="side" data-field="extension-face" x="500" y="125" text-anchor="middle">CORE • ${face.toUpperCase()}</text>
    <text class="row-label" data-field="street-extension-label" x="105" y="481">STREET</text>
    <text class="extension-instruction" data-field="street-extension-count" x="603" y="481" text-anchor="middle">USE 1 TRAVEL EXTENSION HEX</text>
    <text class="row-label" data-field="track-extension-label" x="105" y="561">TRACK</text>
    <text class="extension-instruction" data-field="track-extension-count" x="603" y="561" text-anchor="middle">USE 2 TRAVEL EXTENSION HEXES</text>`;
  const svg = prepareMaster("core-extension-master.svg", {
    id: "travel_extension",
    kind: "core-extension",
    face,
    footprint: "generic-extension",
    size: 1,
    title: `Travel Extension — Core ${face}`,
    description: `Dimension-locked 60 millimetre generic ${face} Travel extension for both two-hex and three-hex Travel components, with the standard artwork window and assembly-count guidance.`
  });
  return replaceContent(replaceArtwork(svg, "Travel Extension"), content);
}

function generateSpecial(tile) {
  const footprint = tile.footprint ?? ((tile.size ?? 1) > 1 ? "line" : "single");
  const effect = renderSpecialEffect(tile.effectText);
  const unlockLayout = fitTextBlock(tile.unlockSource, {
    maxFontSize: 34,
    minFontSize: 24,
    maxLines: 1,
    top: 447,
    bottom: 496,
    widthAtY: () => 420,
    family: "title"
  });
  const unlockText = unlockLayout.lines[0];
  const content = `${sourceMetadata(tile, "one-sided", tile.effectText)}
${headerContent(tile, tile.name, "SPECIAL • ONE-SIDED", "special")}
${renderScoreBadges(tile.population, tile.renown)}

    <text class="unlock-label" x="175" y="479">UNLOCKED BY ARRIVAL</text>
    <text class="unlock-name" data-field="arrival-name" x="805" y="480" text-anchor="end" style="font-size:${unlockLayout.fontSize}px" data-safe-x1="385" data-safe-x2="820">${escapeXml(unlockText)}</text>

${effect.markup}`;
  const svg = prepareMaster("special-one-sided-master.svg", {
    id: tile.id,
    kind: "special",
    face: "one-sided",
    footprint,
    size: tile.size ?? 1,
    title: `${tile.name} — Special tile`,
    description: `Dimension-locked 60 millimetre Special face for ${tile.name}, with a fitted artwork placeholder.`
  });
  return {
    svg: replaceContent(replaceArtwork(svg, tile.name), content),
    effectLabel: effect.label,
    printedEffectText: effect.printedText
  };
}

function generateGolden(tile) {
  const footprint = tile.footprint ?? ((tile.size ?? 1) > 1 ? "line" : "single");
  const effect = renderGoldenEffect(tile.effectText);
  const scoring = renderGoldenScoring(tile.scoringText);
  const content = `${sourceMetadata(tile, "one-sided", tile.effectText)}
${headerContent(tile, tile.name, "GOLDEN LEGACY", "golden")}

    <text class="ledger-label" x="175" y="473">LEDGER UNLOCK</text>
    <text class="ledger-value" data-field="ledger-threshold" x="825" y="475" text-anchor="end">${tile.unlockAt} ENTRIES</text>

${effect.markup}

${scoring.markup}`;
  const svg = prepareMaster("golden-one-sided-master.svg", {
    id: tile.id,
    kind: "golden",
    face: "one-sided",
    footprint,
    size: tile.size ?? 1,
    title: `${tile.name} — Golden tile`,
    description: `Dimension-locked 60 millimetre Golden face for ${tile.name}, with a fitted artwork placeholder.`
  });
  return {
    svg: replaceContent(replaceArtwork(svg, tile.name), content),
    effectLabel: "PERSISTENT EFFECT",
    printedEffectText: effect.printedText,
    printedScoringText: scoring.printedText
  };
}

function generateSpecialBack(tile, specialTileNumber, sourceCopy) {
  const size = tile.size ?? 1;
  const footprint = tile.footprint ?? (size > 1 ? "line" : "single");
  const tuning = specialBackOpticalTuning[specialTileNumber];
  if (!tuning) {
    throw new Error(`Missing Special back optical tuning for number ${specialTileNumber}`);
  }
  const content = `    <metadata>
      <special-back tile-number="${specialTileNumber}" paired-tile-id="${escapeXml(tile.id)}" paired-tile-name="${escapeXml(tile.name)}" source-copy="${sourceCopy}" size-hexes="${size}" footprint="${escapeXml(footprint)}"/>
    </metadata>
    <text class="back-number" data-field="special-tile-number" x="${tuning.x}" y="${tuning.y}" text-anchor="middle" dominant-baseline="central" style="font-size:${tuning.fontSize}px" data-optical-center="500 433.0127" data-optical-visible-height="194">${specialTileNumber}</text>`;
  const svg = prepareMaster("special-numbered-back-master.svg", {
    id: `special_back_${String(specialTileNumber).padStart(2, "0")}`,
    kind: "special-back",
    face: "back",
    footprint,
    size,
    title: `Special tile back ${specialTileNumber} — ${tile.name}`,
    description: `Dimension-locked dark numbered back ${specialTileNumber} for physical copy ${sourceCopy} of ${tile.name}.`
  });
  return replaceContent(svg, content);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownTableCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function productionRecordFields(tile) {
  const size = tile.size ?? 1;
  const placement = placementDescriptor(tile);
  const tileType = tileTypeDescriptor(tile);
  return {
    printUnitsPerCopy: size,
    printedHexesAtStockQuantity: tile.count * size,
    tileTypeIcon: tileType.iconKey,
    tileTypeIconId: tileType.iconId,
    tileTypeLabel: tileType.label,
    tileType: tileType.type,
    tileTypeGlyph: tileType.glyph,
    placementIcon: placement.iconKey,
    placementKind: placement.kind,
    placementLabel: placement.lines.join(" / "),
    placementText: placement.text
  };
}

function galleryFragment(records, extensionRecords, specialBackRecords) {
  const fontFiles = {
    Almendra: path.join(repositoryRoot, "src/assets/fonts/almendra-latin-regular.woff2"),
    Alegreya: path.join(repositoryRoot, "src/assets/fonts/alegreya-latin-variable.woff2"),
    AlegreyaSans: path.join(repositoryRoot, "src/assets/fonts/alegreya-sans-latin-medium.woff2")
  };
  const fontData = Object.fromEntries(
    Object.entries(fontFiles).map(([name, filePath]) => [name, fs.readFileSync(filePath).toString("base64")])
  );

  function inlineSvg(svg, prefix) {
    const identifiers = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    let result = svg.replace(/@font-face\{[^}]+\}/g, "");
    const classNames = [...new Set(
      [...result.matchAll(/\bclass="([^"]+)"/g)]
        .flatMap((match) => match[1].split(/\s+/))
        .filter(Boolean)
    )];
    for (const className of classNames) {
      const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(
        new RegExp(`\\.${escapedClassName}(?![a-zA-Z0-9_-])`, "g"),
        `.${prefix}-${className}`
      );
    }
    result = result.replace(/\bclass="([^"]+)"/g, (_, value) =>
      `class="${value.split(/\s+/).filter(Boolean).map((className) => `${prefix}-${className}`).join(" ")}"`
    );
    for (const identifier of identifiers) {
      const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result
        .replace(new RegExp(`id="${escapedIdentifier}"`, "g"), `id="${prefix}-${identifier}"`)
        .replace(new RegExp(`url\\(#${escapedIdentifier}\\)`, "g"), `url(#${prefix}-${identifier})`)
        .replace(new RegExp(`href="#${escapedIdentifier}"`, "g"), `href="#${prefix}-${identifier}"`);
    }
    result = result.replace(
      /aria-labelledby="title desc"/,
      `aria-labelledby="${prefix}-title ${prefix}-desc"`
    );
    return result.replace(/<svg /, '<svg class="qv-set-svg" ');
  }

  const groups = [
    ["Core — Basic", records.filter((record) => record.kind === "core" && record.face === "basic")],
    ["Core — Upgraded", records.filter((record) => record.kind === "core" && record.face === "upgraded")],
    ["Core — Basic Travel Extensions", extensionRecords.filter((record) => record.face === "basic")],
    ["Core — Upgraded Travel Extensions", extensionRecords.filter((record) => record.face === "upgraded")],
    ["Special", records.filter((record) => record.kind === "special")],
    ["Golden", records.filter((record) => record.kind === "golden")],
    ["Special — Numbered Backs", specialBackRecords]
  ];
  const figures = (groupRecords) => groupRecords.map((record, index) => {
    const isExtension = record.kind === "core-extension";
    const copyLabel = isExtension
      ? `${record.copies} extension hexes`
      : record.copies === 1 ? "1 component" : `${record.copies} components`;
    const sizeLabel = isExtension
      ? `shared by ${record.compatibleComponentSizes.join("- and ")}-hex Travel components`
      : record.size === 1
        ? "1 hex each"
        : `${record.size} hexes each · ${record.printedHexesAtStockQuantity} print hexes`;
    const prefix = `qv-${record.kind}-${record.face}-${record.id}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const pairingLabel = record.kind === "special-back"
      ? ` · ${escapeXml(record.pairedTileName)} copy ${record.sourceCopy}`
      : "";
    return `      <figure class="qv-set-figure">
${inlineSvg(record.svg, prefix).split("\n").map((line) => `        ${line}`).join("\n")}
        <figcaption><span>${escapeXml(record.name)}</span><span class="text-muted">${copyLabel} &middot; ${sizeLabel}${pairingLabel}</span></figcaption>
      </figure>`;
  }).join("\n");

  const componentRecords = records.filter((record) => record.kind !== "core" || record.face === "basic");
  const physicalComponents = componentRecords.reduce((sum, record) => sum + record.copies, 0);
  const physicalHexes = componentRecords.reduce((sum, record) => sum + record.printedHexesAtStockQuantity, 0);
  const printedHexFaces = [...records, ...specialBackRecords]
    .reduce((sum, record) => sum + record.printedHexesAtStockQuantity, 0);

  return `<div id="quiet-vale-complete-set">
  <style>
    @font-face{font-family:Almendra;src:url(data:font/woff2;base64,${fontData.Almendra}) format('woff2');font-weight:400}
    @font-face{font-family:Alegreya;src:url(data:font/woff2;base64,${fontData.Alegreya}) format('woff2');font-weight:400 500}
    @font-face{font-family:'Alegreya Sans';src:url(data:font/woff2;base64,${fontData.AlegreyaSans}) format('woff2');font-weight:500}
    #quiet-vale-complete-set{color:var(--foreground);display:grid;gap:var(--space-6,24px);width:100%}
    #quiet-vale-complete-set .qv-set-summary{display:flex;gap:var(--space-3,12px);flex-wrap:wrap;align-items:center}
    #quiet-vale-complete-set .qv-set-section{display:grid;gap:var(--space-3,12px)}
    #quiet-vale-complete-set .qv-set-section h3{margin:0;font-weight:500}
    #quiet-vale-complete-set .qv-set-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:var(--space-4,16px);align-items:start}
    #quiet-vale-complete-set .qv-set-figure{margin:0;display:grid;gap:var(--space-2,8px);min-width:0}
    #quiet-vale-complete-set .qv-set-figure>.qv-set-svg{display:block;width:100%;height:auto;filter:drop-shadow(0 4px 7px color-mix(in srgb,var(--foreground) 18%,transparent))}
    #quiet-vale-complete-set .qv-set-figure figcaption{display:flex;justify-content:space-between;gap:var(--space-2,8px);align-items:baseline;flex-wrap:wrap;overflow-wrap:anywhere}
    #quiet-vale-complete-set .qv-set-figure figcaption .text-muted{margin-left:auto;text-align:right}
    #quiet-vale-complete-set .qv-set-figure figcaption span:first-child{font-weight:500}
    @media(max-width:430px){#quiet-vale-complete-set .qv-set-grid{grid-template-columns:1fr}}
  </style>
  <div class="qv-set-summary" aria-label="Tile set totals">
    <span class="viz-badge">51 designs</span>
    <span class="viz-badge">${records.length + extensionRecords.length + specialBackRecords.length} faces</span>
    <span class="viz-badge">${physicalComponents} components</span>
    <span class="viz-badge">${physicalHexes} physical hexes</span>
    <span class="viz-badge">${printedHexFaces} printed hex faces</span>
  </div>
${groups.map(([label, groupRecords]) => `  <section class="qv-set-section" aria-labelledby="qv-${label.toLowerCase().replace(/[^a-z]+/g, "-")}">
    <h3 id="qv-${label.toLowerCase().replace(/[^a-z]+/g, "-")}">${escapeXml(label)} &middot; ${groupRecords.length}</h3>
    <div class="qv-set-grid">
${figures(groupRecords)}
    </div>
  </section>`).join("\n")}
</div>
`;
}

function travelPreviewFragment(records, extensionRecords) {
  const fontFiles = {
    Almendra: path.join(repositoryRoot, "src/assets/fonts/almendra-latin-regular.woff2"),
    Alegreya: path.join(repositoryRoot, "src/assets/fonts/alegreya-latin-variable.woff2"),
    AlegreyaSans: path.join(repositoryRoot, "src/assets/fonts/alegreya-sans-latin-medium.woff2")
  };
  const fontData = Object.fromEntries(
    Object.entries(fontFiles).map(([name, filePath]) => [name, fs.readFileSync(filePath).toString("base64")])
  );

  function inlineSvg(svg, prefix) {
    const identifiers = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    let result = svg.replace(/@font-face\{[^}]+\}/g, "");
    const classNames = [...new Set(
      [...result.matchAll(/\bclass="([^"]+)"/g)]
        .flatMap((match) => match[1].split(/\s+/))
        .filter(Boolean)
    )];
    for (const className of classNames) {
      const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(
        new RegExp(`\\.${escapedClassName}(?![a-zA-Z0-9_-])`, "g"),
        `.${prefix}-${className}`
      );
    }
    result = result.replace(/\bclass="([^"]+)"/g, (_, value) =>
      `class="${value.split(/\s+/).filter(Boolean).map((className) => `${prefix}-${className}`).join(" ")}"`
    );
    for (const identifier of identifiers) {
      const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result
        .replace(new RegExp(`id="${escapedIdentifier}"`, "g"), `id="${prefix}-${identifier}"`)
        .replace(new RegExp(`url\\(#${escapedIdentifier}\\)`, "g"), `url(#${prefix}-${identifier})`)
        .replace(new RegExp(`href="#${escapedIdentifier}"`, "g"), `href="#${prefix}-${identifier}"`);
    }
    result = result.replace(
      /aria-labelledby="title desc"/,
      `aria-labelledby="${prefix}-title ${prefix}-desc"`
    );
    return result.replace(/<svg /, '<svg class="qv-travel-svg" ');
  }

  const mainRecord = (tileId) => records.find((record) =>
    record.id === tileId && record.kind === "core" && record.face === "basic"
  );
  const genericExtension = extensionRecords.find((record) => record.face === "basic");
  const street = [mainRecord("c16_street"), genericExtension];
  const track = [mainRecord("c17_track"), genericExtension, genericExtension];
  if ([...street, ...track].some((record) => !record)) {
    throw new Error("Travel preview records are incomplete");
  }

  const renderPiece = (record, index, tileId) => {
    const prefix = `qv-preview-${tileId}-${record.face}-${index}`;
    return `      <div class="qv-piece" aria-label="${escapeXml(record.name)}">
${inlineSvg(record.svg, prefix).split("\n").map((line) => `        ${line}`).join("\n")}
      </div>`;
  };

  return `<div id="quiet-vale-travel-extension-preview">
  <style>
    @font-face{font-family:Almendra;src:url(data:font/woff2;base64,${fontData.Almendra}) format('woff2');font-weight:400}
    @font-face{font-family:Alegreya;src:url(data:font/woff2;base64,${fontData.Alegreya}) format('woff2');font-weight:400 500}
    @font-face{font-family:'Alegreya Sans';src:url(data:font/woff2;base64,${fontData.AlegreyaSans}) format('woff2');font-weight:500}
    #quiet-vale-travel-extension-preview{color:var(--foreground);display:grid;gap:var(--space-5,20px);width:100%}
    #quiet-vale-travel-extension-preview .qv-group{display:grid;gap:var(--space-2,8px);min-width:0}
    #quiet-vale-travel-extension-preview .qv-label{display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-3,12px);flex-wrap:wrap}
    #quiet-vale-travel-extension-preview .qv-label strong{font-weight:500}
    #quiet-vale-travel-extension-preview .qv-assembly{position:relative;width:100%;max-width:736px;margin-inline:auto}
    #quiet-vale-travel-extension-preview .qv-street{aspect-ratio:1750/1299}
    #quiet-vale-travel-extension-preview .qv-track{aspect-ratio:2500/1299}
    #quiet-vale-travel-extension-preview .qv-piece{position:absolute;filter:drop-shadow(0 4px 7px color-mix(in srgb,var(--foreground) 18%,transparent))}
    #quiet-vale-travel-extension-preview .qv-piece>.qv-travel-svg{display:block;width:100%;height:auto}
    #quiet-vale-travel-extension-preview .qv-street .qv-piece{width:57.142857%}
    #quiet-vale-travel-extension-preview .qv-street .qv-piece:nth-child(1){left:0;top:0}
    #quiet-vale-travel-extension-preview .qv-street .qv-piece:nth-child(2){left:42.857143%;top:33.333333%}
    #quiet-vale-travel-extension-preview .qv-track .qv-piece{width:40%}
    #quiet-vale-travel-extension-preview .qv-track .qv-piece:nth-child(1){left:0;top:33.333333%}
    #quiet-vale-travel-extension-preview .qv-track .qv-piece:nth-child(2){left:30%;top:0}
    #quiet-vale-travel-extension-preview .qv-track .qv-piece:nth-child(3){left:60%;top:33.333333%}
  </style>
  <section class="qv-group" aria-labelledby="qv-street-label">
    <div class="qv-label"><strong id="qv-street-label">Street</strong><span class="text-muted">1 main rules hex + 1 artwork extension</span></div>
    <div class="qv-assembly qv-street" role="img" aria-label="Two edge-connected flat-top hexes: the Street main rules tile and one artwork-only Travel extension">
${street.map((record, index) => renderPiece(record, index, "street")).join("\n")}
    </div>
  </section>
  <section class="qv-group" aria-labelledby="qv-track-label">
    <div class="qv-label"><strong id="qv-track-label">Track</strong><span class="text-muted">1 main rules hex + 2 artwork extensions</span></div>
    <div class="qv-assembly qv-track" role="img" aria-label="Three edge-connected flat-top hexes: the Track main rules tile and two artwork-only Travel extensions">
${track.map((record, index) => renderPiece(record, index, "track")).join("\n")}
    </div>
  </section>
</div>
`;
}

function resourcePreviewFragment(records) {
  const fontFiles = {
    Almendra: path.join(repositoryRoot, "src/assets/fonts/almendra-latin-regular.woff2"),
    Alegreya: path.join(repositoryRoot, "src/assets/fonts/alegreya-latin-variable.woff2"),
    AlegreyaSans: path.join(repositoryRoot, "src/assets/fonts/alegreya-sans-latin-medium.woff2")
  };
  const fontData = Object.fromEntries(
    Object.entries(fontFiles).map(([name, filePath]) => [name, fs.readFileSync(filePath).toString("base64")])
  );

  function inlineSvg(svg, prefix) {
    const identifiers = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    let result = svg.replace(/@font-face\{[^}]+\}/g, "");
    const classNames = [...new Set(
      [...result.matchAll(/\bclass="([^"]+)"/g)]
        .flatMap((match) => match[1].split(/\s+/))
        .filter(Boolean)
    )];
    for (const className of classNames) {
      const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(
        new RegExp(`\\.${escapedClassName}(?![a-zA-Z0-9_-])`, "g"),
        `.${prefix}-${className}`
      );
    }
    result = result.replace(/\bclass="([^"]+)"/g, (_, value) =>
      `class="${value.split(/\s+/).filter(Boolean).map((className) => `${prefix}-${className}`).join(" ")}"`
    );
    for (const identifier of identifiers) {
      const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result
        .replace(new RegExp(`id="${escapedIdentifier}"`, "g"), `id="${prefix}-${identifier}"`)
        .replace(new RegExp(`url\\(#${escapedIdentifier}\\)`, "g"), `url(#${prefix}-${identifier})`)
        .replace(new RegExp(`href="#${escapedIdentifier}"`, "g"), `href="#${prefix}-${identifier}"`);
    }
    result = result.replace(
      /aria-labelledby="title desc"/,
      `aria-labelledby="${prefix}-title ${prefix}-desc"`
    );
    return result.replace(/<svg /, '<svg class="qv-resource-svg" ');
  }

  const samples = [
    ["c01_lumber_yard", "Free"],
    ["c19_bridge", "One resource"],
    ["c05_cabin", "Two resources"],
    ["c06_cottage", "Three resources"],
    ["c16_street", "Alternative cost"]
  ].map(([id, label]) => {
    const record = records.find((candidate) =>
      candidate.id === id && candidate.kind === "core" && candidate.face === "basic"
    );
    if (!record) throw new Error(`Resource preview record is missing: ${id}`);
    return { record, label };
  });

  return `<div id="quiet-vale-resource-row-preview">
  <style>
    @font-face{font-family:Almendra;src:url(data:font/woff2;base64,${fontData.Almendra}) format('woff2');font-weight:400}
    @font-face{font-family:Alegreya;src:url(data:font/woff2;base64,${fontData.Alegreya}) format('woff2');font-weight:400 500}
    @font-face{font-family:'Alegreya Sans';src:url(data:font/woff2;base64,${fontData.AlegreyaSans}) format('woff2');font-weight:500}
    #quiet-vale-resource-row-preview{color:var(--foreground);width:100%}
    #quiet-vale-resource-row-preview .qv-resource-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:var(--space-4,16px);align-items:start}
    #quiet-vale-resource-row-preview .qv-resource-figure{margin:0;display:grid;gap:var(--space-2,8px);min-width:0}
    #quiet-vale-resource-row-preview .qv-resource-figure>.qv-resource-svg{display:block;width:100%;height:auto;filter:drop-shadow(0 4px 7px color-mix(in srgb,var(--foreground) 18%,transparent))}
    #quiet-vale-resource-row-preview .qv-resource-figure figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-2,8px);flex-wrap:wrap}
    #quiet-vale-resource-row-preview .qv-resource-figure figcaption strong{font-weight:500}
    #quiet-vale-resource-row-preview .qv-resource-figure figcaption .text-muted{margin-left:auto;text-align:right}
    @media(max-width:430px){#quiet-vale-resource-row-preview .qv-resource-grid{grid-template-columns:1fr}}
  </style>
  <div class="qv-resource-grid">
${samples.map(({ record, label }, index) => `    <figure class="qv-resource-figure">
${inlineSvg(record.svg, `qv-resource-${record.id}-${index}`).split("\n").map((line) => `      ${line}`).join("\n")}
      <figcaption><strong>${escapeXml(label)}</strong><span class="text-muted">${escapeXml(record.name)}</span></figcaption>
    </figure>`).join("\n")}
  </div>
</div>
`;
}

const { coreTiles, specialTiles, goldenTiles } = loadTileData();
const records = [];
const extensionRecords = [];
const specialBackRecords = [];

fs.mkdirSync(path.join(outputRoot, "core"), { recursive: true });
const extensionOutputDirectory = path.join(outputRoot, "core-extensions");
fs.mkdirSync(extensionOutputDirectory, { recursive: true });
for (const fileName of fs.readdirSync(extensionOutputDirectory)) {
  if (fileName.endsWith(".svg")) fs.unlinkSync(path.join(extensionOutputDirectory, fileName));
}
fs.mkdirSync(path.join(outputRoot, "special"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "golden"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "special-backs"), { recursive: true });

const travelLineTiles = coreTiles.filter(isTravelLineTile);
const compatibleExtensionSourceTileIds = travelLineTiles.map((tile) => tile.id);
const compatibleExtensionComponentSizes = [...new Set(travelLineTiles.map((tile) => tile.size ?? 1))].sort((a, b) => a - b);
const genericExtensionCopiesPerSide = travelLineTiles
  .reduce((sum, tile) => sum + tile.count * ((tile.size ?? 1) - 1), 0);
const genericExtensionPathByFace = new Map();

for (const face of ["basic", "upgraded"]) {
  const extensionSvg = generateCoreExtension(
    face,
    compatibleExtensionSourceTileIds,
    compatibleExtensionComponentSizes,
    genericExtensionCopiesPerSide
  );
  const extensionFileName = `travel-extension-${face}.svg`;
  const extensionRelativePath = path.join("core-extensions", extensionFileName);
  fs.writeFileSync(path.join(outputRoot, extensionRelativePath), extensionSvg);
  genericExtensionPathByFace.set(face, extensionRelativePath);
  extensionRecords.push({
    id: "travel_extension",
    kind: "core-extension",
    category: "travel",
    face,
    name: "Travel Extension",
    copies: genericExtensionCopiesPerSide,
    size: 1,
    footprint: "generic-extension",
    printUnitsPerCopy: 1,
    printedHexesAtStockQuantity: genericExtensionCopiesPerSide,
    compatibleSourceTileIds: compatibleExtensionSourceTileIds,
    compatibleComponentSizes: compatibleExtensionComponentSizes,
    tileType: "travel-extension",
    tileTypeIcon: null,
    tileTypeLabel: "TRAVEL EXTENSION",
    tileTypeGlyph: null,
    placementIcon: null,
    placementLabel: "",
    svgPath: extensionRelativePath,
    svg: extensionSvg
  });
}

for (const tile of coreTiles) {
  const faces = [
    ["basic", tile.basic.name, generateCoreBasic(tile)],
    ["upgraded", tile.upgraded.name, generateCoreUpgraded(tile)]
  ];
  for (const [face, name, generated] of faces) {
    const fileName = `${tile.id}-${face}.svg`;
    const relativePath = path.join("core", fileName);
    fs.writeFileSync(path.join(outputRoot, relativePath), generated.svg);
    const segmentSvgPaths = [relativePath];
    if (isTravelLineTile(tile)) {
      for (let segment = 2; segment <= tile.size; segment += 1) {
        segmentSvgPaths.push(genericExtensionPathByFace.get(face));
      }
    }
    records.push({
      id: tile.id,
      kind: "core",
      category: tile.category,
      face,
      name,
      copies: tile.count,
      size: tile.size,
      footprint: tile.footprint ?? (tile.size > 1 ? "line" : "single"),
      ...productionRecordFields(tile),
      svgPath: relativePath,
      segmentSvgPaths,
      svg: generated.svg,
      sourceEffectText: tile[face].effectText,
      printedEffectLabel: generated.effectLabel,
      printedEffectText: generated.printedEffectText,
      printedScoringText: ""
    });
  }
}

for (const tile of specialTiles) {
  const generated = generateSpecial(tile);
  const fileName = `${tile.id}.svg`;
  const relativePath = path.join("special", fileName);
  fs.writeFileSync(path.join(outputRoot, relativePath), generated.svg);
  records.push({
    id: tile.id,
    kind: "special",
    category: tile.category,
    face: "one-sided",
    name: tile.name,
    copies: tile.count,
    size: tile.size ?? 1,
    footprint: tile.footprint ?? ((tile.size ?? 1) > 1 ? "line" : "single"),
    ...productionRecordFields(tile),
    svgPath: relativePath,
    svg: generated.svg,
    sourceEffectText: tile.effectText,
    printedEffectLabel: generated.effectLabel,
    printedEffectText: generated.printedEffectText,
    printedScoringText: ""
  });
}

for (const tile of goldenTiles) {
  const generated = generateGolden(tile);
  const fileName = `${tile.id}.svg`;
  const relativePath = path.join("golden", fileName);
  fs.writeFileSync(path.join(outputRoot, relativePath), generated.svg);
  records.push({
    id: tile.id,
    kind: "golden",
    category: tile.category,
    face: "one-sided",
    name: tile.name,
    copies: tile.count,
    size: tile.size ?? 1,
    footprint: tile.footprint ?? ((tile.size ?? 1) > 1 ? "line" : "single"),
    ...productionRecordFields(tile),
    svgPath: relativePath,
    svg: generated.svg,
    sourceEffectText: tile.effectText,
    printedEffectLabel: generated.effectLabel,
    printedEffectText: generated.printedEffectText,
    printedScoringText: generated.printedScoringText
  });
}

let specialTileNumber = 1;
for (const tile of specialTiles) {
  const size = tile.size ?? 1;
  const footprint = tile.footprint ?? (size > 1 ? "line" : "single");
  for (let sourceCopy = 1; sourceCopy <= tile.count; sourceCopy += 1) {
    const svg = generateSpecialBack(tile, specialTileNumber, sourceCopy);
    const fileName = `special-back-${String(specialTileNumber).padStart(2, "0")}.svg`;
    const relativePath = path.join("special-backs", fileName);
    fs.writeFileSync(path.join(outputRoot, relativePath), svg);
    specialBackRecords.push({
      id: `special_back_${String(specialTileNumber).padStart(2, "0")}`,
      kind: "special-back",
      category: tile.category,
      face: "back",
      name: `Special Back ${specialTileNumber}`,
      copies: 1,
      size,
      footprint,
      printUnitsPerCopy: size,
      printedHexesAtStockQuantity: size,
      specialTileNumber,
      pairedTileId: tile.id,
      pairedTileName: tile.name,
      sourceCopy,
      svgPath: relativePath,
      svg
    });
    specialTileNumber += 1;
  }
}

const coreTilesById = new Map(coreTiles.map((tile) => [tile.id, tile]));

for (const record of records) {
  if (!record.svg.includes(`data-tile-type-icon="${record.tileTypeIcon}"`)) {
    throw new Error(`Generated top-left tile type metadata is missing for ${record.id} ${record.face}`);
  }
  if (!record.svg.includes(`data-tile-type="${record.tileType}"`)) {
    throw new Error(`Generated top-left tile type value is incorrect for ${record.id} ${record.face}`);
  }
  if (!record.svg.includes(`data-tile-type-glyph="${record.tileTypeGlyph}"`)) {
    throw new Error(`Generated top-left tile type glyph is incorrect for ${record.id} ${record.face}`);
  }
  if (!record.svg.includes(`href="#${record.tileTypeIconId}"`)) {
    throw new Error(`Generated top-left tile type icon use is incorrect for ${record.id} ${record.face}`);
  }
  if (!record.svg.includes(`<symbol id="${record.tileTypeIconId}"`)) {
    throw new Error(`Generated top-left tile type icon definition is missing for ${record.id} ${record.face}`);
  }
  if ((record.svg.match(/data-tile-type-icon="/g) ?? []).length !== 1) {
    throw new Error(`Expected exactly one top-left tile type icon for ${record.id} ${record.face}`);
  }
  if (record.svg.includes('<use href="#icon-category"')) {
    throw new Error(`Legacy generic top-left tile type icon remains in ${record.id} ${record.face}`);
  }
  const expectedIconId = `icon-placement-${record.placementIcon}`;
  if (!record.svg.includes(`<symbol id="${expectedIconId}"`)) {
    throw new Error(`Generated placement icon definition is missing for ${record.id} ${record.face}`);
  }
  if (blankPlacementIconKeys.has(record.placementIcon)) {
    if (
      record.svg.includes(`data-placement-icon="${record.placementIcon}"`)
      || record.svg.includes(`href="#${expectedIconId}"`)
      || record.svg.includes('data-field="requirement-label-')
      || record.svg.includes('<circle cx="727" cy="67"')
    ) {
      throw new Error(`Standard land placement must leave the top-right corner blank in ${record.id} ${record.face}`);
    }
  } else {
    if (!record.svg.includes(`data-placement-icon="${record.placementIcon}"`)) {
      throw new Error(`Generated placement icon metadata is missing for ${record.id} ${record.face}`);
    }
    if (!record.svg.includes(`href="#${expectedIconId}"`)) {
      throw new Error(`Generated placement icon use is incorrect for ${record.id} ${record.face}`);
    }
    if (!record.svg.includes('data-field="requirement-label-')) {
      throw new Error(`Generated placement label is missing for ${record.id} ${record.face}`);
    }
  }
  if (record.svg.includes('href="#icon-requirement"') || record.svg.includes('href="#icon-terrain"')) {
    throw new Error(`Legacy generic placement icon remains in ${record.id} ${record.face}`);
  }
  if (record.svg.includes('href="#icon-resource"')) {
    throw new Error(`Legacy generic resource icon remains in ${record.id} ${record.face}`);
  }
  if (record.kind === "core" && record.face === "basic") {
    if (!record.svg.includes(".resource-quantity{font-variant-numeric:lining-nums tabular-nums;font-feature-settings:'lnum' 1,'tnum' 1}")) {
      throw new Error(`Resource quantities are not using uniform lining/tabular figures in ${record.id}`);
    }
    const tile = coreTilesById.get(record.id);
    const costRows = {
      place: tile.basic,
      upgrade: tile.upgraded
    };
    for (const [rowName, face] of Object.entries(costRows)) {
      const expectedItems = displayedCostItems(face);
      const parsedAlternative = parseAlternateCostItems(face.alternateCostText);
      const expectedLayout = expectedItems.length
        ? resourceTokenLayout(expectedItems, Boolean(parsedAlternative))
        : null;
      const renderedTokenCount = (record.svg.match(new RegExp(`data-cost-row="${rowName}"`, "g")) ?? []).length;
      if (renderedTokenCount !== expectedItems.length) {
        throw new Error(`Expected ${expectedItems.length} ${rowName} resource tokens in ${record.id}; found ${renderedTokenCount}`);
      }
      for (const [itemIndex, { resource, quantity }] of expectedItems.entries()) {
        const presentation = resourcePresentation[resource];
        const fieldMarker = `data-field="${rowName}-cost-${resource}"`;
        const tokenStart = record.svg.indexOf(fieldMarker);
        const tokenMarkup = tokenStart >= 0 ? record.svg.slice(tokenStart, tokenStart + 720) : "";
        if (
          !tokenMarkup.includes(`data-resource-icon="${presentation.glyph}"`)
          || !tokenMarkup.includes(`data-resource-colour="${presentation.colour}"`)
          || !tokenMarkup.includes(`href="#${presentation.iconId}"`)
          || !tokenMarkup.includes(`>${quantity}</text>`)
          || !tokenMarkup.includes(`>${presentation.label}</text>`)
          || !tokenMarkup.includes('data-row-centre="600"')
          || !tokenMarkup.includes(`data-slot-centre="${expectedLayout.slotCentres[itemIndex].toFixed(2)}"`)
          || (tokenMarkup.match(/font-size:29px/g) ?? []).length < 2
        ) {
          throw new Error(`Incorrect ${resource} token in the ${rowName} row of ${record.id}`);
        }
        if (!record.svg.includes(`<symbol id="${presentation.iconId}"`)) {
          throw new Error(`Missing ${resource} icon definition in ${record.id}`);
        }
        if (!record.svg.includes(`.resource-icon-${resource}{stroke:${presentation.colour}}`)) {
          throw new Error(`Incorrect ${resource} Logistics-board colour in ${record.id}`);
        }
      }
      if (!expectedItems.length) {
        const fieldName = face.alternateCostText
          ? `${rowName}-cost-alternative`
          : `${rowName}-cost-free`;
        const fieldStart = record.svg.indexOf(`data-field="${fieldName}"`);
        const fieldMarkup = fieldStart >= 0 ? record.svg.slice(fieldStart, fieldStart + 300) : "";
        if (
          !fieldMarkup
          || !fieldMarkup.includes('x="600"')
          || !fieldMarkup.includes('style="font-size:29px"')
        ) {
          throw new Error(`Missing ${rowName} cost text in ${record.id}`);
        }
      }
      const expectedOrCount = parsedAlternative ? parsedAlternative.length - 1 : 0;
      const renderedOrCount = (record.svg.match(new RegExp(`data-field="${rowName}-cost-or-`, "g")) ?? []).length;
      if (renderedOrCount !== expectedOrCount) {
        throw new Error(`Expected ${expectedOrCount} OR separators in the ${rowName} row of ${record.id}; found ${renderedOrCount}`);
      }
      if (expectedOrCount && !record.svg.includes(`data-field="${rowName}-cost-or-1" x="600.00"`)) {
        throw new Error(`The ${rowName} OR separator is not centred in ${record.id}`);
      }
    }
  }
  if (record.printedHexesAtStockQuantity !== record.copies * record.size) {
    throw new Error(`Printable footprint quantity is incorrect for ${record.id} ${record.face}`);
  }
  const sourceTile = coreTilesById.get(record.id);
  if (record.kind === "core" && sourceTile && isTravelLineTile(sourceTile)) {
    const extensionCount = (sourceTile.size ?? 1) - 1;
    const noun = extensionCount === 1 ? "HEX" : "HEXES";
    const instruction = `PLACE WITH ${extensionCount} TRAVEL EXTENSION ${noun}`;
    if (
      !record.svg.includes('data-field="travel-extension-instruction"')
      || !record.svg.includes(`>${instruction}</text>`)
    ) {
      throw new Error(`Travel extension assembly instruction is incorrect for ${record.id} ${record.face}`);
    }
    if (
      !Array.isArray(record.segmentSvgPaths)
      || record.segmentSvgPaths.length !== sourceTile.size
      || record.segmentSvgPaths[0] !== record.svgPath
      || record.segmentSvgPaths.slice(1).some((svgPath) => svgPath !== genericExtensionPathByFace.get(record.face))
    ) {
      throw new Error(`Travel extension segment paths are incorrect for ${record.id} ${record.face}`);
    }
  } else if (record.svg.includes('data-field="travel-extension-instruction"')) {
    throw new Error(`Unexpected travel extension assembly instruction in ${record.id} ${record.face}`);
  }
  const artworkText = [...record.svg.matchAll(/class="artwork-placeholder"[^>]*>([^<]+)<\/text>/g)]
    .map((match) => match[1])
    .join(" ");
  const expectedArtworkText = escapeXml(`${displayTypography(record.name)} Image`);
  if (artworkText !== expectedArtworkText) {
    throw new Error(`Artwork placeholder is incorrect for ${record.id} ${record.face}: ${artworkText}`);
  }
  if (record.svg.includes('<circle cx="0" cy="0" r="34"')) {
    throw new Error(`Legacy score circle remains in ${record.id} ${record.face}`);
  }
  if (record.svg.includes('data-field="population"') && !record.svg.includes('>POPULATION</text>')) {
    throw new Error(`Population label is not fully written in ${record.id} ${record.face}`);
  }
  if (record.svg.includes('>POP</text>')) {
    throw new Error(`Abbreviated Population label remains in ${record.id} ${record.face}`);
  }
  if (record.kind === "golden") {
    if (!record.svg.includes('.ledger-value{font-family:Almendra,Georgia,serif;font-size:34px;fill:#7f6a3d}')) {
      throw new Error(`Golden entry threshold is not using the approved aged-gold colour in ${record.id}`);
    }
    const isRiverGate = record.id === "golden_tile_the_golden_river_gate";
    const hasExpectedGoldenPlacementIcon = isRiverGate
      ? record.placementIcon === "adjacent-water"
      : blankPlacementIconKeys.has(record.placementIcon);
    if (!hasExpectedGoldenPlacementIcon) {
      throw new Error(`Golden placement rule is incorrect in ${record.id}: ${record.placementIcon}`);
    }
  }
}

if (extensionRecords.length !== 2) {
  throw new Error(`Expected one generic Travel extension face per Core side; found ${extensionRecords.length}`);
}
for (const record of extensionRecords) {
  if (record.size !== 1 || record.footprint !== "generic-extension") {
    throw new Error(`Invalid travel extension geometry in ${record.svgPath}`);
  }
  if (record.copies !== genericExtensionCopiesPerSide || record.printedHexesAtStockQuantity !== genericExtensionCopiesPerSide) {
    throw new Error(`Generic Travel extension quantity is incorrect in ${record.svgPath}`);
  }
  if (
    JSON.stringify(record.compatibleSourceTileIds) !== JSON.stringify(compatibleExtensionSourceTileIds)
    || JSON.stringify(record.compatibleComponentSizes) !== JSON.stringify(compatibleExtensionComponentSizes)
  ) {
    throw new Error(`Generic Travel extension compatibility is incorrect in ${record.svgPath}`);
  }
  if (!record.svg.includes(`<tile-extension id="travel_extension" face="${record.face}" category="travel"`)) {
    throw new Error(`Travel extension metadata is missing in ${record.svgPath}`);
  }
  if (
    !record.svg.includes(`compatible-source-tile-ids="${escapeXml(compatibleExtensionSourceTileIds.join(" "))}"`)
    || !record.svg.includes(`compatible-component-sizes="${escapeXml(compatibleExtensionComponentSizes.join(" "))}"`)
    || !record.svg.includes('artwork-window="standard"')
    || !record.svg.includes('street-extension-count="1"')
    || !record.svg.includes('track-extension-count="2"')
  ) {
    throw new Error(`Generic Travel extension metadata is incorrect in ${record.svgPath}`);
  }
  if (
    !record.svg.includes('<clipPath id="artwork-clip"><path d="M163 150H837L998.261 430H1.739Z"/></clipPath>')
    || [...record.svg.matchAll(/class="artwork-placeholder"[^>]*>([^<]+)<\/text>/g)]
      .map((match) => match[1])
      .join(" ") !== "Travel Extension Image"
  ) {
    throw new Error(`Travel extension artwork placeholder is missing in ${record.svgPath}`);
  }
  if (
    !record.svg.includes('data-field="extension-title"')
    || !record.svg.includes('>Travel Extension</text>')
    || !record.svg.includes(`>CORE • ${record.face.toUpperCase()}</text>`)
    || !record.svg.includes('data-field="street-extension-count"')
    || !record.svg.includes('>USE 1 TRAVEL EXTENSION HEX</text>')
    || !record.svg.includes('data-field="track-extension-count"')
    || !record.svg.includes('>USE 2 TRAVEL EXTENSION HEXES</text>')
  ) {
    throw new Error(`Travel extension identification is incorrect in ${record.svgPath}`);
  }
  if (
    record.svg.includes('data-tile-type-icon=')
    || record.svg.includes('data-placement-icon=')
    || record.svg.includes('data-cost-row=')
    || record.svg.includes('data-field="effect-type"')
    || record.svg.includes('data-field="population"')
    || record.svg.includes('data-field="renown"')
    || record.svg.includes('source-tile-id=')
    || record.svg.includes('component-size-hexes=')
    || record.svg.includes('segment=')
  ) {
    throw new Error(`Repeated gameplay information remains on ${record.svgPath}`);
  }
}

const expectedSpecialBackCount = specialTiles.reduce((sum, tile) => sum + tile.count, 0);
if (specialBackRecords.length !== expectedSpecialBackCount) {
  throw new Error(`Expected ${expectedSpecialBackCount} numbered Special backs; found ${specialBackRecords.length}`);
}
for (const [index, record] of specialBackRecords.entries()) {
  const expectedNumber = index + 1;
  const tuning = specialBackOpticalTuning[expectedNumber];
  if (record.specialTileNumber !== expectedNumber) {
    throw new Error(`Special back numbering is not sequential at ${record.svgPath}`);
  }
  if (!record.svg.includes(`data-field="special-tile-number"`) || !record.svg.includes(`>${expectedNumber}</text>`)) {
    throw new Error(`Visible Special back number is incorrect in ${record.svgPath}`);
  }
  const expectedOpticalPlacement = `x="${tuning.x}" y="${tuning.y}" text-anchor="middle" dominant-baseline="central" style="font-size:${tuning.fontSize}px" data-optical-center="500 433.0127" data-optical-visible-height="194"`;
  if (!record.svg.includes(expectedOpticalPlacement)) {
    throw new Error(`Special back number is not optically centred and normalized in ${record.svgPath}`);
  }
  if (!record.svg.includes(".back-number{font-family:Alegreya,Georgia,serif;font-size:320px;font-variant-numeric:lining-nums tabular-nums;font-feature-settings:'lnum' 1,'tnum' 1;fill:#d8caaa}")) {
    throw new Error(`Special back number is not using the approved lining-figure typography and parchment colour in ${record.svgPath}`);
  }
  if (!record.svg.includes(`paired-tile-id="${escapeXml(record.pairedTileId)}"`)) {
    throw new Error(`Special back pairing metadata is incorrect in ${record.svgPath}`);
  }
  if (record.printedHexesAtStockQuantity !== record.size) {
    throw new Error(`Special back footprint quantity is incorrect in ${record.svgPath}`);
  }
}

const physicalTileCount = coreTiles.reduce((sum, tile) => sum + tile.count, 0)
  + specialTiles.reduce((sum, tile) => sum + tile.count, 0)
  + goldenTiles.reduce((sum, tile) => sum + tile.count, 0);
const physicalHexCount = coreTiles.reduce((sum, tile) => sum + tile.count * (tile.size ?? 1), 0)
  + specialTiles.reduce((sum, tile) => sum + tile.count * (tile.size ?? 1), 0)
  + goldenTiles.reduce((sum, tile) => sum + tile.count * (tile.size ?? 1), 0);
const frontComponentFaceCount = coreTiles.reduce((sum, tile) => sum + tile.count * 2, 0)
  + specialTiles.reduce((sum, tile) => sum + tile.count, 0)
  + goldenTiles.reduce((sum, tile) => sum + tile.count, 0);
const specialBackComponentFaceCount = specialTiles.reduce((sum, tile) => sum + tile.count, 0);
const frontPrintedHexFaceCount = coreTiles.reduce((sum, tile) => sum + tile.count * (tile.size ?? 1) * 2, 0)
  + specialTiles.reduce((sum, tile) => sum + tile.count * (tile.size ?? 1), 0)
  + goldenTiles.reduce((sum, tile) => sum + tile.count * (tile.size ?? 1), 0);
const specialBackPrintedHexFaceCount = specialTiles
  .reduce((sum, tile) => sum + tile.count * (tile.size ?? 1), 0);

const manifest = {
  generatedAt: new Date().toISOString(),
  source: "src/data/tiles.ts",
  templateVersion,
  dimensions: {
    widthMm: 60,
    heightMm: 51.9615,
    viewBox: "0 0 1000 866.0254"
  },
  resourceSystem: Object.fromEntries(
    Object.entries(resourcePresentation).map(([resource, presentation]) => [resource, {
      label: presentation.label,
      icon: presentation.glyph,
      colour: presentation.colour
    }])
  ),
  totals: {
    uniqueTileDesigns: coreTiles.length + specialTiles.length + goldenTiles.length,
    uniqueMainFrontFaces: records.length,
    uniqueExtensionFrontFaces: extensionRecords.length,
    uniqueFrontFaces: records.length + extensionRecords.length,
    uniqueSpecialBacks: specialBackRecords.length,
    uniqueFaces: records.length + extensionRecords.length + specialBackRecords.length,
    physicalTiles: physicalTileCount,
    physicalHexesAtStockQuantity: physicalHexCount,
    frontComponentFacesAtStockQuantity: frontComponentFaceCount,
    specialBackComponentFacesAtStockQuantity: specialBackComponentFaceCount,
    componentFacesAtStockQuantity: frontComponentFaceCount + specialBackComponentFaceCount,
    frontPrintedFacesAtStockQuantity: frontPrintedHexFaceCount,
    specialBackPrintedFacesAtStockQuantity: specialBackPrintedHexFaceCount,
    printedFacesAtStockQuantity: frontPrintedHexFaceCount + specialBackPrintedHexFaceCount
  },
  records: records.map(({ svg, ...record }) => record),
  extensionRecords: extensionRecords.map(({ svg, ...record }) => record),
  specialBackRecords: specialBackRecords.map(({ svg, ...record }) => record)
};
fs.writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const csvHeaders = [
  "tile_id",
  "kind",
  "category",
  "face",
  "name",
  "copies",
  "size_hexes",
  "footprint",
  "print_units_per_copy",
  "printed_hexes_at_stock_quantity",
  "tile_type",
  "tile_type_icon",
  "tile_type_icon_id",
  "tile_type_label",
  "tile_type_glyph",
  "placement_icon",
  "placement_kind",
  "placement_label",
  "placement_text",
  "svg_path",
  "segment_svg_paths",
  "source_effect_text",
  "printed_effect_label",
  "printed_effect_text",
  "printed_scoring_text"
];
const csvRows = records.map((record) => [
  record.id,
  record.kind,
  record.category,
  record.face,
  record.name,
  record.copies,
  record.size,
  record.footprint,
  record.printUnitsPerCopy,
  record.printedHexesAtStockQuantity,
  record.tileType,
  record.tileTypeIcon,
  record.tileTypeIconId,
  record.tileTypeLabel,
  record.tileTypeGlyph,
  record.placementIcon,
  record.placementKind,
  record.placementLabel,
  record.placementText,
  record.svgPath,
  record.segmentSvgPaths?.join(" | ") ?? record.svgPath,
  record.sourceEffectText,
  record.printedEffectLabel,
  record.printedEffectText,
  record.printedScoringText
]);
const csv = [csvHeaders, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
fs.writeFileSync(path.join(outputRoot, "print-manifest.csv"), `${csv}\n`);

const extensionCsvHeaders = [
  "extension_id",
  "face",
  "name",
  "copies_per_side",
  "compatible_source_tile_ids",
  "compatible_component_sizes",
  "footprint",
  "svg_path"
];
const extensionCsvRows = extensionRecords.map((record) => [
  record.id,
  record.face,
  record.name,
  record.copies,
  record.compatibleSourceTileIds.join(" "),
  record.compatibleComponentSizes.join(" "),
  record.footprint,
  record.svgPath
]);
const extensionCsv = [extensionCsvHeaders, ...extensionCsvRows]
  .map((row) => row.map(csvCell).join(","))
  .join("\n");
fs.writeFileSync(path.join(outputRoot, "extension-manifest.csv"), `${extensionCsv}\n`);

const specialBackCsvHeaders = [
  "special_tile_number",
  "back_id",
  "paired_tile_id",
  "paired_tile_name",
  "source_copy",
  "size_hexes",
  "footprint",
  "print_units_per_copy",
  "printed_hexes_at_stock_quantity",
  "svg_path"
];
const specialBackCsvRows = specialBackRecords.map((record) => [
  record.specialTileNumber,
  record.id,
  record.pairedTileId,
  record.pairedTileName,
  record.sourceCopy,
  record.size,
  record.footprint,
  record.printUnitsPerCopy,
  record.printedHexesAtStockQuantity,
  record.svgPath
]);
const specialBackCsv = [specialBackCsvHeaders, ...specialBackCsvRows]
  .map((row) => row.map(csvCell).join(","))
  .join("\n");
fs.writeFileSync(path.join(outputRoot, "special-back-manifest.csv"), `${specialBackCsv}\n`);

const specialTileNumberReferenceRows = specialBackRecords.map((record) => {
  const backHexes = record.size === 1
    ? "1"
    : `${record.size} (repeat ${record.specialTileNumber} on every back hex)`;
  return [
    record.specialTileNumber,
    record.pairedTileName,
    record.sourceCopy,
    backHexes,
    record.specialTileNumber
  ];
});
const specialTileNumberReference = `# Special tile number reference

Generated from \`src/data/tiles.ts\` by the v${templateVersion} tile generator.

## Arrival unlock encounter card rule

Print the **Special tile number** shown below on the corresponding Arrival unlock encounter card. This table is the locked pairing authority: do not renumber cards independently of the Special tile backs.

For a multi-hex Special tile, every back hex belonging to the same physical tile copy repeats that copy's number. The two Stables copies are separate physical tiles and therefore use separate numbers, 17 and 18.

| Special tile number | Special tile | Physical copy | Back hexes | Number to print on matching Arrival unlock encounter card |
|---:|---|---:|---|---:|
${specialTileNumberReferenceRows
    .map((row) => `| ${row.map(markdownTableCell).join(" | ")} |`)
    .join("\n")}
`;
fs.writeFileSync(
  path.join(outputRoot, "SPECIAL-TILE-NUMBER-REFERENCE.md"),
  specialTileNumberReference
);

if (galleryPath) {
  fs.mkdirSync(path.dirname(galleryPath), { recursive: true });
  fs.writeFileSync(galleryPath, galleryFragment(records, extensionRecords, specialBackRecords));
}

if (travelPreviewPath) {
  fs.mkdirSync(path.dirname(travelPreviewPath), { recursive: true });
  fs.writeFileSync(travelPreviewPath, travelPreviewFragment(records, extensionRecords));
}

if (resourcePreviewPath) {
  fs.mkdirSync(path.dirname(resourcePreviewPath), { recursive: true });
  fs.writeFileSync(resourcePreviewPath, resourcePreviewFragment(records));
}

console.log(JSON.stringify({ outputRoot, galleryPath, travelPreviewPath, resourcePreviewPath, totals: manifest.totals }, null, 2));
