import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.goto("file:///workspace/.grok/og-card.html", { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const metrics = await page.evaluate(() => {
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return {
      t: Math.round(b.top),
      b: Math.round(b.bottom),
      l: Math.round(b.left),
      r: Math.round(b.right),
      w: Math.round(b.width),
      h: Math.round(b.height),
    };
  };
  const h1 = document.querySelector("h1");
  const org = document.querySelector(".org");
  return {
    fonts: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`),
    h1: box(h1),
    org: box(org),
    lock: box(document.querySelector(".lockup")),
    text: h1.innerText.replaceAll("\n", " | "),
    orgText: org.textContent,
  };
});
console.log(JSON.stringify(metrics, null, 2));
await page.screenshot({ path: "/workspace/.grok/card-raw.png", type: "png" });
await browser.close();
