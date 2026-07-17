import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("docs-live-screenshots");
const appUrl = process.env.QV_CAPTURE_URL ?? "http://127.0.0.1:4173/";

async function loadSavedExample(browser, stateFile) {
  const save = await fs.readFile(path.join(outputDir, stateFile), "utf8");
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1080 },
    deviceScaleFactor: 1.25,
    colorScheme: "light",
    reducedMotion: "reduce"
  });
  await context.addInitScript(({ activeSave }) => {
    window.localStorage.clear();
    window.localStorage.setItem("quietVale.activeGame.v1", activeSave);
  }, { activeSave: save });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(appUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  return { context, page };
}

async function screenshotLocator(page, selector, filename) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await locator.screenshot({ path: path.join(outputDir, filename) });
}

const browser = await chromium.launch({ headless: true });
try {
  {
    const { context, page } = await loadSavedExample(browser, "bridge-state.json");
    await screenshotLocator(page, ".map-artwork-frame", "27-bridge-placed-map.png");
    await page.screenshot({
      path: path.join(outputDir, "28-bridge-state-full.png"),
      fullPage: true
    });
    await context.close();
  }

  {
    const { context, page } = await loadSavedExample(browser, "strain-state.json");
    await screenshotLocator(page, ".map-artwork-frame", "29-strain-markers-map.png");
    await page.screenshot({
      path: path.join(outputDir, "30-overstrained-state-full.png"),
      fullPage: true
    });
    await context.close();
  }
} finally {
  await browser.close();
}
