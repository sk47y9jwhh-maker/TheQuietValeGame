import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("docs-live-screenshots");
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1050 },
  deviceScaleFactor: 1.25,
  colorScheme: "light",
  reducedMotion: "reduce"
});
const page = await context.newPage();
page.setDefaultTimeout(7000);

const log = [];
const note = (message) => {
  log.push(`${new Date().toISOString()} ${message}`);
  console.log(message);
};

async function settle(ms = 900) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function full(name) {
  await settle(350);
  await page.screenshot({ path: path.join(outputDir, name), fullPage: true });
  note(`saved ${name}`);
}

async function crop(name, selector) {
  try {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0 || !(await locator.isVisible())) return false;
    await locator.scrollIntoViewIfNeeded();
    await settle(250);
    await locator.screenshot({ path: path.join(outputDir, name) });
    note(`saved ${name} from ${selector}`);
    return true;
  } catch (error) {
    note(`crop failed ${name}: ${error.message}`);
    return false;
  }
}

async function clickByRole(name) {
  try {
    const button = page.getByRole("button", { name }).first();
    if ((await button.count()) === 0 || !(await button.isVisible()) || !(await button.isEnabled())) {
      note(`button unavailable: ${name}`);
      return false;
    }
    await button.click();
    await settle();
    note(`clicked ${name}`);
    return true;
  } catch (error) {
    note(`click failed ${name}: ${error.message}`);
    return false;
  }
}

try {
  await page.goto("https://thequietvalegame.com/", { waitUntil: "networkidle", timeout: 90000 });
  await settle(1500);

  await full("01-new-game-full.png");
  await crop("02-new-game-command-table.png", "main.setup-command-table");
  await crop("03-new-game-controls.png", ".setup-control-panel");
  await crop("04-new-game-overview.png", ".setup-overview-panel");
  await crop("05-new-game-stewards.png", ".setup-roster-panel");
  await crop("06-new-game-header.png", ".setup-top-bar");

  await clickByRole(/^Start Season I$/i);
  await full("07-place-steward-full.png");
  await crop("08-place-steward-map.png", "[aria-label='Steward starting map']");
  await crop("09-place-steward-flow.png", "main.steward-start-flow");

  const validStart = page.getByRole("button", { name: /valid start/i }).first();
  if ((await validStart.count()) && (await validStart.isVisible())) {
    await validStart.click();
    await settle(450);
    note("selected first valid start");
  }
  await clickByRole(/Confirm .* Start/i);

  await full("10-season-seeding-full.png");
  await crop("11-season-seeding-board.png", ".seeding-card-board");
  await crop("12-season-seeding-controls.png", ".seeding-control-panel");
  await crop("13-season-seeding-cards.png", ".hand-grid");
  await clickByRole(/^Confirm Seeding$/i);

  await full("14-round-one-full.png");
  await crop("15-round-one-header.png", ".top-bar");
  await crop("16-round-one-map.png", "[aria-label='Settlement map']");
  await crop("17-round-one-actions.png", ".action-console");
  await crop("18-round-one-encounters.png", ".right-panel");

  await clickByRole(/Reveal Encounters/i);
  await settle(1200);
  await full("19-revealed-encounters-full.png");
  await crop("20-revealed-map.png", "[aria-label='Settlement map']");
  await crop("21-revealed-actions.png", ".action-console");
  await crop("22-revealed-encounters.png", ".right-panel");

  // Resolve any straightforward acknowledgement buttons so the active table is also captured.
  for (let index = 0; index < 8; index += 1) {
    const candidates = page.getByRole("button").filter({ hasText: /^(Continue|Acknowledge|Resolve|Skip|Done)$/i });
    if ((await candidates.count()) === 0) break;
    const candidate = candidates.first();
    if (!(await candidate.isVisible()) || !(await candidate.isEnabled())) break;
    await candidate.click();
    await settle(500);
  }

  await full("23-active-table-full.png");
  await crop("24-active-table-map.png", "[aria-label='Settlement map']");
  await crop("25-active-table-actions.png", ".action-console");
  await crop("26-active-table-encounters.png", ".right-panel");

  const buttonTexts = await page.getByRole("button").allTextContents();
  await fs.writeFile(path.join(outputDir, "button-texts.json"), JSON.stringify(buttonTexts, null, 2));
} catch (error) {
  note(`fatal: ${error.stack ?? error.message}`);
  try {
    await full("99-error-state.png");
  } catch {}
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(outputDir, "capture-log.txt"), `${log.join("\n")}\n`);
  await browser.close();
}
