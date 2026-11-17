import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const htmlPath = "/workspace/.grok/og-card.html";
const outPath = "/workspace/.grok/og-raw.png";

const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle", timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: outPath, type: "png" });
await browser.close();
console.log("screenshot", outPath);
