#!/usr/bin/env node

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const {
  PDFDocument,
  StandardFonts,
  rgb,
} = require('pdf-lib');

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../..');
const TILE_SET_DIR = path.join(ROOT, 'design/tile-set');
const OUTPUT_DIR = path.join(ROOT, 'output/pdf');
const RENDER_DIR = path.join(ROOT, 'tmp/pdfs/tile-renders-600dpi');
const MANIFEST_PATH = path.join(TILE_SET_DIR, 'manifest.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MM_TO_PT = 72 / 25.4;
const A4 = Object.freeze({ widthMm: 210, heightMm: 297 });
const TILE = Object.freeze({ widthMm: 60, heightMm: 51.9615 });
const GRID = Object.freeze({ columns: 3, rows: 5, gapMm: 3 });
const DPI = 600;
const TILE_PIXELS = Object.freeze({
  width: Math.round((TILE.widthMm / 25.4) * DPI),
  height: Math.round((TILE.heightMm / 25.4) * DPI),
});
const GRID_WIDTH_MM = GRID.columns * TILE.widthMm + (GRID.columns - 1) * GRID.gapMm;
const GRID_HEIGHT_MM = GRID.rows * TILE.heightMm + (GRID.rows - 1) * GRID.gapMm;
const MARGINS = Object.freeze({
  xMm: (A4.widthMm - GRID_WIDTH_MM) / 2,
  yMm: (A4.heightMm - GRID_HEIGHT_MM) / 2,
});

const FONT_FILES = Object.freeze({
  "../../../src/assets/fonts/almendra-latin-regular.woff2": path.join(ROOT, 'src/assets/fonts/almendra-latin-regular.woff2'),
  "../../../src/assets/fonts/alegreya-latin-variable.woff2": path.join(ROOT, 'src/assets/fonts/alegreya-latin-variable.woff2'),
  "../../../src/assets/fonts/alegreya-sans-latin-medium.woff2": path.join(ROOT, 'src/assets/fonts/alegreya-sans-latin-medium.woff2'),
});

const mm = (value) => value * MM_TO_PT;
const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeRenderName(svgPath) {
  return svgPath.replaceAll('/', '__').replace(/\.svg$/u, '.png');
}

async function loadFontDataUrls() {
  const entries = await Promise.all(
    Object.entries(FONT_FILES).map(async ([source, fontPath]) => {
      const encoded = (await readFile(fontPath)).toString('base64');
      return [source, `data:font/woff2;base64,${encoded}`];
    }),
  );
  return new Map(entries);
}

function inlineFonts(svg, fontDataUrls) {
  let result = svg;
  for (const [source, dataUrl] of fontDataUrls) {
    result = result.replaceAll(source, dataUrl);
  }
  return result;
}

async function renderAllTiles(records, fontDataUrls) {
  await mkdir(RENDER_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
  });

  try {
    const page = await browser.newPage({
      viewport: TILE_PIXELS,
      deviceScaleFactor: 1,
    });

    for (const [index, record] of records.entries()) {
      const sourcePath = path.join(TILE_SET_DIR, record.svgPath);
      const outputPath = path.join(RENDER_DIR, safeRenderName(record.svgPath));
      const svg = inlineFonts(await readFile(sourcePath, 'utf8'), fontDataUrls);
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${TILE_PIXELS.width}px;height:${TILE_PIXELS.height}px;overflow:hidden;background:transparent}svg{display:block;width:${TILE_PIXELS.width}px;height:${TILE_PIXELS.height}px}</style></head><body>${svg}</body></html>`;

      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(async () => document.fonts.ready);
      const loadedFonts = await page.evaluate(() => ({
        almendra: document.fonts.check('16px Almendra'),
        alegreya: document.fonts.check('16px Alegreya'),
        alegreyaSans: document.fonts.check('16px "Alegreya Sans"'),
      }));
      assert(Object.values(loadedFonts).every(Boolean), `Fonts did not load for ${record.svgPath}`);

      const bounds = await page.locator('svg').boundingBox();
      assert(bounds, `SVG bounds missing for ${record.svgPath}`);
      assert(Math.abs(bounds.width - TILE_PIXELS.width) < 0.01, `Wrong rendered width for ${record.svgPath}`);
      assert(Math.abs(bounds.height - TILE_PIXELS.height) < 0.01, `Wrong rendered height for ${record.svgPath}`);

      await page.screenshot({
        path: outputPath,
        omitBackground: true,
        animations: 'disabled',
      });

      if ((index + 1) % 12 === 0 || index + 1 === records.length) {
        process.stdout.write(`Rendered ${index + 1}/${records.length} tile faces at ${DPI} DPI\n`);
      }
    }
  } finally {
    await browser.close();
  }
}

function expandRecord(record) {
  const printUnitsPerCopy = record.printUnitsPerCopy ?? record.size ?? 1;
  assert(
    printUnitsPerCopy === (record.size ?? 1),
    `Print-unit footprint mismatch for ${record.svgPath}`,
  );
  return Array.from({ length: record.copies }, (_, copyIndex) =>
    Array.from({ length: printUnitsPerCopy }, (_, segmentIndex) => ({
      record,
      copy: copyIndex + 1,
      segment: segmentIndex + 1,
      printUnit: copyIndex * printUnitsPerCopy + segmentIndex + 1,
    })),
  ).flat();
}

function makeCorePairs(records, extensionRecords) {
  const basics = records.filter((record) => record.kind === 'core' && record.face === 'basic');
  const upgradedById = new Map(
    records
      .filter((record) => record.kind === 'core' && record.face === 'upgraded')
      .map((record) => [record.id, record]),
  );
  const extensionByFace = new Map(
    extensionRecords.map((record) => [record.face, record]),
  );

  return basics.flatMap((front) => {
    const back = upgradedById.get(front.id);
    assert(back, `Missing upgraded Core face for ${front.id}`);
    assert(back.copies === front.copies, `Core face copy mismatch for ${front.id}`);
    assert(back.size === front.size, `Core face footprint mismatch for ${front.id}`);
    const printUnitsPerCopy = front.printUnitsPerCopy ?? front.size ?? 1;
    return Array.from({ length: front.copies }, (_, copyIndex) =>
      Array.from({ length: printUnitsPerCopy }, (_, segmentIndex) => {
        const segment = segmentIndex + 1;
        const segmentFront = segment === 1
          ? front
          : extensionByFace.get('basic');
        const segmentBack = segment === 1
          ? back
          : extensionByFace.get('upgraded');
        assert(segmentFront, `Missing generic basic Travel extension for ${front.id}`);
        assert(segmentBack, `Missing generic upgraded Travel extension for ${front.id}`);
        return {
          front: segmentFront,
          back: segmentBack,
          sourceTileId: front.id,
          componentSize: front.size,
          copy: copyIndex + 1,
          segment,
          printUnit: copyIndex * printUnitsPerCopy + segment,
        };
      }),
    ).flat();
  });
}

function makeSpecialPairs(records, specialBackRecords) {
  const backsByPhysicalTile = new Map(
    specialBackRecords.map((record) => [`${record.pairedTileId}:${record.sourceCopy}`, record]),
  );
  const frontItems = records
    .filter((record) => record.kind === 'special')
    .flatMap(expandRecord);

  return frontItems.map((item) => {
    const key = `${item.record.id}:${item.copy}`;
    const back = backsByPhysicalTile.get(key);
    assert(back, `Missing numbered Special back for ${key}`);
    assert(back.size === item.record.size, `Special back footprint mismatch for ${key}`);
    return {
      front: item.record,
      back,
      copy: item.copy,
      segment: item.segment,
      printUnit: item.printUnit,
      specialTileNumber: back.specialTileNumber,
    };
  });
}

function basicsPhysicalComponentCount(records) {
  return records
    .filter((record) => record.kind === 'core' && record.face === 'basic')
    .reduce((sum, record) => sum + record.copies, 0);
}

function mirrorSlotsForLongEdge(items) {
  const slots = Array(GRID.columns * GRID.rows).fill(null);
  items.forEach((item, frontSlot) => {
    const row = Math.floor(frontSlot / GRID.columns);
    const column = frontSlot % GRID.columns;
    const mirroredSlot = row * GRID.columns + (GRID.columns - 1 - column);
    slots[mirroredSlot] = item;
  });
  return slots;
}

function drawCenteredText(page, font, text, size, y, color = rgb(0.22, 0.22, 0.2)) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (mm(A4.widthMm) - width) / 2,
    y,
    size,
    font,
    color,
  });
}

function drawRegistrationCross(page, xMm, yMm) {
  const x = mm(xMm);
  const y = mm(yMm);
  const arm = mm(2.2);
  const color = rgb(0.25, 0.25, 0.22);
  page.drawLine({ start: { x: x - arm, y }, end: { x: x + arm, y }, thickness: 0.35, color });
  page.drawLine({ start: { x, y: y - arm }, end: { x, y: y + arm }, thickness: 0.35, color });
  page.drawCircle({ x, y, size: mm(0.75), borderWidth: 0.35, borderColor: color });
}

function drawPageFurniture(page, font, label) {
  drawCenteredText(page, font, label, 6.4, mm(A4.heightMm - 6.7));

  const scaleY = mm(5.2);
  const scaleStart = mm((A4.widthMm - 50) / 2);
  const scaleEnd = scaleStart + mm(50);
  const tick = mm(1.3);
  const color = rgb(0.25, 0.25, 0.22);
  page.drawLine({ start: { x: scaleStart, y: scaleY }, end: { x: scaleEnd, y: scaleY }, thickness: 0.55, color });
  page.drawLine({ start: { x: scaleStart, y: scaleY - tick }, end: { x: scaleStart, y: scaleY + tick }, thickness: 0.55, color });
  page.drawLine({ start: { x: scaleEnd, y: scaleY - tick }, end: { x: scaleEnd, y: scaleY + tick }, thickness: 0.55, color });
  drawCenteredText(page, font, '50 mm SCALE CHECK', 5.5, mm(7.1));

  drawRegistrationCross(page, 6.2, A4.heightMm / 2);
  drawRegistrationCross(page, A4.widthMm - 6.2, A4.heightMm / 2);
}

function slotPosition(slot) {
  const row = Math.floor(slot / GRID.columns);
  const column = slot % GRID.columns;
  const xMm = MARGINS.xMm + column * (TILE.widthMm + GRID.gapMm);
  const topMm = MARGINS.yMm + row * (TILE.heightMm + GRID.gapMm);
  const yMm = A4.heightMm - topMm - TILE.heightMm;
  return { row, column, xMm, yMm };
}

async function embedRecordImage(pdf, record, embeddedImages) {
  if (!embeddedImages.has(record.svgPath)) {
    const pngPath = path.join(RENDER_DIR, safeRenderName(record.svgPath));
    embeddedImages.set(record.svgPath, await pdf.embedPng(await readFile(pngPath)));
  }
  return embeddedImages.get(record.svgPath);
}

async function drawTileSlots(pdf, page, slots, embeddedImages) {
  const placements = [];
  for (let slot = 0; slot < slots.length; slot += 1) {
    const item = slots[slot];
    if (!item) continue;
    const record = item.record ?? item;
    const position = slotPosition(slot);
    const image = await embedRecordImage(pdf, record, embeddedImages);
    page.drawImage(image, {
      x: mm(position.xMm),
      y: mm(position.yMm),
      width: mm(TILE.widthMm),
      height: mm(TILE.heightMm),
    });
    placements.push({
      slot,
      row: position.row + 1,
      column: position.column + 1,
      xMm: Number(position.xMm.toFixed(5)),
      yMm: Number(position.yMm.toFixed(5)),
      id: record.id,
      sourceTileId: item.sourceTileId ?? record.sourceTileId ?? record.id,
      name: record.name,
      kind: record.kind,
      face: record.face,
      copy: item.copy ?? null,
      segment: item.segment ?? null,
      printUnit: item.printUnit ?? null,
      sizeHexes: record.size,
      componentSizeHexes: item.componentSize ?? record.componentSize ?? record.size,
      extensionSegment: record.kind === 'core-extension'
        ? (item.segment ?? null)
        : (record.extensionSegment ?? null),
      printUnitsPerCopy: item.componentSize ?? record.printUnitsPerCopy ?? record.size,
      footprint: record.footprint,
      tileType: record.tileType,
      tileTypeIcon: record.tileTypeIcon,
      tileTypeLabel: record.tileTypeLabel,
      tileTypeGlyph: record.tileTypeGlyph,
      placementIcon: record.placementIcon,
      placementLabel: record.placementLabel,
      specialTileNumber: record.specialTileNumber ?? item.specialTileNumber ?? null,
      pairedTileId: record.pairedTileId ?? null,
      pairedTileName: record.pairedTileName ?? null,
      svgPath: record.svgPath,
    });
  }
  return placements;
}

async function createPdfDocument(title) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor('The Quiet Vale');
  pdf.setSubject('Exact-scale A4 tile face sheets');
  pdf.setCreator('The Quiet Vale A4 print pack generator');
  pdf.setProducer('pdf-lib');
  return pdf;
}

async function savePdf(pdf, filename) {
  const outputPath = path.join(OUTPUT_DIR, filename);
  const bytes = await pdf.save({ useObjectStreams: true });
  await writeFile(outputPath, bytes);
  return outputPath;
}

async function makeCoreDuplexPdf(records, extensionRecords) {
  const pairs = makeCorePairs(records, extensionRecords);
  const sheets = chunk(pairs, GRID.columns * GRID.rows);
  const pdf = await createPdfDocument('The Quiet Vale - Core tiles - A4 duplex');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const embeddedImages = new Map();
  const pages = [];

  for (const [sheetIndex, sheetPairs] of sheets.entries()) {
    const frontSlots = sheetPairs.map((pair) => ({
      record: pair.front,
      sourceTileId: pair.sourceTileId,
      componentSize: pair.componentSize,
      copy: pair.copy,
      segment: pair.segment,
      printUnit: pair.printUnit,
    }));
    const frontPage = pdf.addPage([mm(A4.widthMm), mm(A4.heightMm)]);
    const frontLabel = `THE QUIET VALE - CORE ${sheetIndex + 1}/${sheets.length} - FRONT / BASIC`;
    drawPageFurniture(frontPage, font, frontLabel);
    pages.push({
      pdfPage: pages.length + 1,
      sheet: sheetIndex + 1,
      side: 'front',
      label: frontLabel,
      placements: await drawTileSlots(pdf, frontPage, frontSlots, embeddedImages),
    });

    const backSlots = mirrorSlotsForLongEdge(
      sheetPairs.map((pair) => ({
        record: pair.back,
        sourceTileId: pair.sourceTileId,
        componentSize: pair.componentSize,
        copy: pair.copy,
        segment: pair.segment,
        printUnit: pair.printUnit,
      })),
    );
    const backPage = pdf.addPage([mm(A4.widthMm), mm(A4.heightMm)]);
    const backLabel = `THE QUIET VALE - CORE ${sheetIndex + 1}/${sheets.length} - BACK / UPGRADED - FLIP LONG EDGE`;
    drawPageFurniture(backPage, font, backLabel);
    pages.push({
      pdfPage: pages.length + 1,
      sheet: sheetIndex + 1,
      side: 'back',
      label: backLabel,
      placements: await drawTileSlots(pdf, backPage, backSlots, embeddedImages),
    });
  }

  return {
    path: await savePdf(pdf, 'the-quiet-vale-core-tiles-a4-duplex.pdf'),
    pages,
    physicalSheets: sheets.length,
    physicalComponents: basicsPhysicalComponentCount(records),
    printedHexesPerSide: pairs.length,
    printedFaces: pairs.length * 2,
  };
}

async function makeSpecialGoldenPdf(records, specialBackRecords) {
  const specialPairs = makeSpecialPairs(records, specialBackRecords);
  const specialSheets = chunk(specialPairs, GRID.columns * GRID.rows);
  const goldenItems = records
    .filter((record) => record.kind === 'golden')
    .flatMap(expandRecord);
  const goldenSheets = chunk(goldenItems, GRID.columns * GRID.rows);

  const pdf = await createPdfDocument('The Quiet Vale - Special numbered duplex backs and Golden tiles - A4');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const embeddedImages = new Map();
  const pages = [];

  for (const [sheetIndex, sheetPairs] of specialSheets.entries()) {
    const frontSlots = sheetPairs.map((pair) => ({
      record: pair.front,
      copy: pair.copy,
      segment: pair.segment,
      printUnit: pair.printUnit,
      specialTileNumber: pair.specialTileNumber,
    }));
    const frontPage = pdf.addPage([mm(A4.widthMm), mm(A4.heightMm)]);
    const frontLabel = `THE QUIET VALE - SPECIAL ${sheetIndex + 1}/${specialSheets.length} - FRONT`;
    drawPageFurniture(frontPage, font, frontLabel);
    pages.push({
      pdfPage: pages.length + 1,
      sheet: sheetIndex + 1,
      side: 'front',
      type: 'special',
      label: frontLabel,
      placements: await drawTileSlots(pdf, frontPage, frontSlots, embeddedImages),
    });

    const backSlots = mirrorSlotsForLongEdge(
      sheetPairs.map((pair) => ({
        record: pair.back,
        copy: pair.copy,
        segment: pair.segment,
        printUnit: pair.printUnit,
        specialTileNumber: pair.specialTileNumber,
      })),
    );
    const backPage = pdf.addPage([mm(A4.widthMm), mm(A4.heightMm)]);
    const backLabel = `THE QUIET VALE - SPECIAL ${sheetIndex + 1}/${specialSheets.length} - NUMBERED BACK - FLIP LONG EDGE`;
    drawPageFurniture(backPage, font, backLabel);
    pages.push({
      pdfPage: pages.length + 1,
      sheet: sheetIndex + 1,
      side: 'back',
      type: 'special',
      label: backLabel,
      placements: await drawTileSlots(pdf, backPage, backSlots, embeddedImages),
    });
  }

  for (const [sheetIndex, sheetItems] of goldenSheets.entries()) {
    const frontPage = pdf.addPage([mm(A4.widthMm), mm(A4.heightMm)]);
    const frontLabel = `THE QUIET VALE - GOLDEN ${sheetIndex + 1}/${goldenSheets.length} - FRONT`;
    drawPageFurniture(frontPage, font, frontLabel);
    pages.push({
      pdfPage: pages.length + 1,
      sheet: sheetIndex + 1,
      side: 'front',
      type: 'golden',
      label: frontLabel,
      placements: await drawTileSlots(pdf, frontPage, sheetItems, embeddedImages),
    });

    pdf.addPage([mm(A4.widthMm), mm(A4.heightMm)]);
    pages.push({
      pdfPage: pages.length + 1,
      sheet: sheetIndex + 1,
      side: 'back',
      type: 'golden',
      label: 'BLANK GOLDEN BACK',
      placements: [],
    });
  }

  return {
    path: await savePdf(pdf, 'the-quiet-vale-special-golden-tiles-a4.pdf'),
    pages,
    physicalSheets: specialSheets.length + goldenSheets.length,
    physicalComponents: records
      .filter((record) => record.kind === 'special' || record.kind === 'golden')
      .reduce((sum, record) => sum + record.copies, 0),
    specialNumberedBacks: specialBackRecords.length,
    specialPrintedHexesPerSide: specialPairs.length,
    goldenPrintedHexes: goldenItems.length,
    printedHexFaces: specialPairs.length * 2 + goldenItems.length,
  };
}

async function makeUniqueProofPdf(records) {
  const groups = chunk(records, GRID.columns * GRID.rows);
  const pdf = await createPdfDocument('The Quiet Vale - Unique tile faces - A4 proof');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const embeddedImages = new Map();
  const pages = [];

  for (const [pageIndex, group] of groups.entries()) {
    const page = pdf.addPage([mm(A4.widthMm), mm(A4.heightMm)]);
    const label = `THE QUIET VALE - UNIQUE FACE PROOF ${pageIndex + 1}/${groups.length} - SINGLE-SIDED`;
    drawPageFurniture(page, font, label);
    pages.push({
      pdfPage: pageIndex + 1,
      sheet: pageIndex + 1,
      side: 'front',
      label,
      placements: await drawTileSlots(pdf, page, group, embeddedImages),
    });
  }

  return {
    path: await savePdf(pdf, 'the-quiet-vale-unique-faces-a4-proof.pdf'),
    pages,
    physicalSheets: groups.length,
    uniqueFaces: records.length,
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const records = manifest.records;
  const extensionRecords = manifest.extensionRecords;
  const specialBackRecords = manifest.specialBackRecords;
  assert(records.length === 72, `Expected 72 unique main front faces; found ${records.length}`);
  assert(extensionRecords.length === 2, `Expected 2 generic Travel extension faces; found ${extensionRecords.length}`);
  assert(specialBackRecords.length === 26, `Expected 26 numbered Special backs; found ${specialBackRecords.length}`);
  const allRecords = [...records, ...extensionRecords, ...specialBackRecords];

  const fontDataUrls = await loadFontDataUrls();
  await renderAllTiles(allRecords, fontDataUrls);

  const core = await makeCoreDuplexPdf(records, extensionRecords);
  const specialGolden = await makeSpecialGoldenPdf(records, specialBackRecords);
  const proof = await makeUniqueProofPdf(allRecords);
  assert(
    core.printedFaces + specialGolden.printedHexFaces === manifest.totals.printedFacesAtStockQuantity,
    'Expanded printed-face total does not match the source manifest',
  );
  assert(
    core.physicalComponents + specialGolden.physicalComponents === manifest.totals.physicalTiles,
    'Physical component total does not match the source manifest',
  );

  const printManifest = {
    generatedAt: new Date().toISOString(),
    sourceManifest: path.relative(ROOT, MANIFEST_PATH),
    format: 'A4 portrait',
    page: A4,
    rasterDpi: DPI,
    renderedTilePixels: TILE_PIXELS,
    sourceTotals: manifest.totals,
    tile: {
      ...TILE,
      viewBox: manifest.dimensions.viewBox,
    },
    grid: {
      ...GRID,
      capacityPerPage: GRID.columns * GRID.rows,
      widthMm: GRID_WIDTH_MM,
      heightMm: GRID_HEIGHT_MM,
      marginXMm: MARGINS.xMm,
      marginYMm: MARGINS.yMm,
    },
    duplex: {
      core: true,
      special: true,
      goldenBlankBack: true,
      binding: 'long-edge',
      backPlacement: 'horizontal slot mirror',
    },
    files: {
      core: { ...core, path: path.basename(core.path) },
      specialGolden: { ...specialGolden, path: path.basename(specialGolden.path) },
      uniqueProof: { ...proof, path: path.basename(proof.path) },
    },
  };
  await writeFile(
    path.join(OUTPUT_DIR, 'the-quiet-vale-a4-print-manifest.json'),
    `${JSON.stringify(printManifest, null, 2)}\n`,
  );

  process.stdout.write(`Created ${path.relative(ROOT, core.path)}\n`);
  process.stdout.write(`Created ${path.relative(ROOT, specialGolden.path)}\n`);
  process.stdout.write(`Created ${path.relative(ROOT, proof.path)}\n`);
  process.stdout.write('Created output/pdf/the-quiet-vale-a4-print-manifest.json\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
