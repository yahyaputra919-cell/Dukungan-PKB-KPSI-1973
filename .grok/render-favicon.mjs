import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 200, height: 80 },
  deviceScaleFactor: 2,
});
await page.goto("file:///workspace/.grok/favicon-preview.html", { waitUntil: "load" });
await page.screenshot({ path: "/workspace/.grok/favicon-preview.png", type: "png" });
await browser.close();
