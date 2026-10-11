// 2x website screenshot for video: walks the page so scroll reveals fire, removes fixed popups.
// usage: node shoot.mjs <url> <out.png> [width] [height] [scrollY] [waitMs] [fullPage]
import { createRequire } from "module"; const puppeteer = createRequire(process.env.PUPPETEER_DIR || (await import("child_process")).execSync("dirname $(dirname $(find ~/.npm/_npx -path '*node_modules/puppeteer-core/package.json' | head -1))").toString().trim() + "/")("puppeteer-core");
import { readdirSync } from "fs";
const base = `${process.env.HOME}/.cache/puppeteer/chrome-headless-shell`;
const ver = readdirSync(base)[0];
const exe = `${base}/${ver}/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const [url, out, w = 1440, h = 900, sy = 0, wait = 3500, full = "0"] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: exe, args: ["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: +w, height: +h, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
// walk the page so scroll-triggered reveals fire, then settle at scrollY
const H = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < H; y += 400) { await p.evaluate(v => window.scrollTo(0, v), y); await new Promise(r => setTimeout(r, 120)); }
await p.evaluate(v => window.scrollTo(0, v), +sy);
await new Promise(r => setTimeout(r, +wait));
await p.evaluate(() => { document.querySelectorAll("body *").forEach(el => { const s = getComputedStyle(el); if ((s.position === "fixed") && !el.closest("header") && el.getBoundingClientRect().top > 100) el.remove(); }); }); await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: out, fullPage: full === "1" });
console.log("saved", out, "pageHeight", H);
await b.close();
