// Lets Athena see her pages the way the learner does: rendered by Chrome with the lesson kit, the
// palette and the bridge, in the light and the dark theme, at a computer and a phone width. Besides
// the screenshots it checks the rendered page for low-contrast text and colors outside the palette.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import { runtimeEnv } from "./runtimes.ts";

const PALETTE = ["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"];
const WIDTHS = { desktop: 900, phone: 390 } as const;
const MAX_HEIGHT = 6000; // longer pages are cut; ask for a selector to see the rest

export type Theme = "light" | "dark";
export type Width = keyof typeof WIDTHS;

/** A Chrome the server may drive: the desktop app's (from the video tools), CHROME_PATH, or a system one. */
function findChrome(): string | null {
  const fromRuntime = (runtimeEnv() as Record<string, string | undefined>).HYPERFRAMES_BROWSER_PATH;
  const candidates = [
    fromRuntime,
    process.env.CHROME_PATH,
    process.env.HYPERFRAMES_BROWSER_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  // HyperFrames downloads chrome-headless-shell into its cache on the first video render.
  for (const root of [process.env.HYPERFRAMES_CACHE_DIR, path.join(os.homedir(), ".cache", "hyperframes")]) {
    const dir = root && path.join(root, "chrome");
    if (!dir || !fs.existsSync(dir)) continue;
    const found = walk(dir, (f) => /chrome-headless-shell(\.exe)?$/.test(f) || /\/chrome$/.test(f), 6);
    if (found) return found;
  }
  return null;
}

function walk(dir: string, match: (f: string) => boolean, depth: number): string | null {
  if (depth < 0) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isFile() && match(f)) return f;
    if (e.isDirectory()) { const r = walk(f, match, depth - 1); if (r) return r; }
  }
  return null;
}

// One browser, started on first use and closed after a minute without previews.
let browser: Promise<Browser> | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;
function getBrowser() {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => { browser?.then((b) => b.close()).catch(() => {}); browser = null; }, 60_000);
  if (!browser) {
    const executablePath = findChrome();
    if (!executablePath) throw new Error("No Chrome found for previews. In the desktop app the video tools include one; on a server set CHROME_PATH.");
    browser = puppeteer.launch({ executablePath, headless: true, args: ["--hide-scrollbars", "--no-first-run"] });
    browser.catch(() => { browser = null; });
  }
  return browser;
}

export type PreviewShot = { theme: Theme; width: Width; image: string; cut: boolean };
export type PreviewResult = { shots: PreviewShot[]; findings: string[] };

/**
 * Render a workspace page. `file` is relative to the topic folder (lessons/0001-x.html,
 * reference/y.html). `selector` limits the picture to one element (an exercise, a figure).
 */
export async function previewPage(topicId: string, file: string, opts: { themes: Theme[]; widths: Width[]; selector?: string }): Promise<PreviewResult> {
  const port = process.env.PORT ?? "3210";
  const base = `http://127.0.0.1:${port}`;
  const url = `${base}/w/${encodeURIComponent(topicId)}/${file.split("/").map(encodeURIComponent).join("/")}`;
  const b = await getBrowser();
  const shots: PreviewShot[] = [];
  const findings = new Set<string>();
  for (const width of opts.widths) {
    for (const theme of opts.themes) {
      const page = await b.newPage();
      try {
        await page.setViewport({ width: WIDTHS[width], height: 900, deviceScaleFactor: 1 });
        // The desktop app's server only answers its own window (a per-launch cookie).
        if (process.env.STOA_TOKEN) await page.setCookie({ name: "stoa_token", value: process.env.STOA_TOKEN, url: base });
        await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("stoa-theme", t); } catch {} }, theme);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e instanceof Error ? e.message : String(e)));
        const res = await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
        if (!res?.ok()) throw new Error(`The page did not load (${res?.status() ?? "no response"}): ${file}`);
        await page.evaluate(() => document.fonts?.ready);
        await new Promise((r) => setTimeout(r, 400)); // the bridge fills the video area after a fetch

        for (const e of errors) findings.add(`${theme}: script error: ${e}`);
        for (const f of await page.evaluate(checkPage, PALETTE)) findings.add(`${theme}, ${width}: ${f}`);

        let image: Uint8Array, cut = false;
        if (opts.selector) {
          const el = await page.$(opts.selector);
          if (!el) throw new Error(`No element matches ${opts.selector} in ${file}.`);
          image = await el.screenshot({ type: "jpeg", quality: 72 });
        } else {
          const height = await page.evaluate(() => document.documentElement.scrollHeight);
          cut = height > MAX_HEIGHT;
          image = await page.screenshot({ type: "jpeg", quality: 72, fullPage: !cut, clip: cut ? { x: 0, y: 0, width: WIDTHS[width], height: MAX_HEIGHT } : undefined, captureBeyondViewport: true });
        }
        shots.push({ theme, width, image: Buffer.from(image).toString("base64"), cut });
      } finally {
        await page.close();
      }
    }
  }
  return { shots, findings: [...findings] };
}

/**
 * Runs inside the page. Finds text below 4.5:1 contrast (3:1 for large text) against its real
 * background, and colors that are not the palette, black, white, or a mix of a palette color with
 * white or the page background. Returns short, specific findings.
 */
function checkPage(palette: string[]): string[] {
  const out: string[] = [];
  const parse = (c: string): [number, number, number, number] | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const describe = (el: Element) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList.length ? `.${[...el.classList].slice(0, 2).join(".")}` : "";
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
    return `<${el.tagName.toLowerCase()}${id}${cls}>${text ? ` "${text}"` : ""}`;
  };
  const pageBg = parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
  /** The color behind an element: the first opaque background up the tree, blended. */
  const behind = (el: Element | null): number[] => {
    const stack: number[][] = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let base = [...pageBg.slice(0, 3)];
    for (const c of stack.reverse()) base = base.map((v, i) => v * (1 - c[3]) + c[i] * c[3]);
    return base;
  };

  // 1. Contrast of text
  let lowContrast = 0;
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !(n.textContent ?? "").trim()) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden], svg, [aria-hidden=true]")) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = behind(el);
    const color = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 600;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const r = ratio(color, bg);
    if (r < need && lowContrast++ < 12) out.push(`low contrast ${r.toFixed(1)}:1 (needs ${need}:1): ${describe(el)}`);
  }
  if (lowContrast > 12) out.push(`… and ${lowContrast - 12} more low-contrast text elements`);

  // 2. Colors outside the palette
  const anchors = palette.map(hex);
  const mixes = [[255, 255, 255], [0, 0, 0], pageBg.slice(0, 3)];
  const isNeutral = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b) <= 18;
  /** On the line from a palette color to white, black or the page background (a tint or shade)? */
  const inPalette = (c: number[]) => anchors.some((p) => mixes.some((m) => {
    const d = p.map((v, i) => v - m[i]);
    const len = d.reduce((s, v) => s + v * v, 0);
    if (!len) return false;
    const t = Math.max(0, Math.min(1, d.reduce((s, v, i) => s + v * (c[i] - m[i]), 0) / len));
    const dist = Math.hypot(...c.map((v, i) => v - (m[i] + t * d[i])));
    return dist <= 14;
  }));
  const offPalette = new Map<string, string>();
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || cs.display === "none" || cs.visibility === "hidden") continue;
    const props = el instanceof SVGElement ? ["fill", "stroke", "color"] : ["color", "background-color", "border-top-color", "border-left-color"];
    for (const prop of props) {
      if (prop.startsWith("border") && parseFloat(cs.getPropertyValue(prop.replace("color", "width"))) === 0) continue;
      const c = parse(cs.getPropertyValue(prop));
      if (!c || c[3] === 0) continue;
      const rgb = c.slice(0, 3);
      if (isNeutral(rgb) || inPalette(rgb)) continue;
      const key = `rgb(${rgb.map(Math.round).join(", ")})`;
      if (!offPalette.has(key)) offPalette.set(key, `${prop} on ${describe(el)}`);
    }
  }
  let i = 0;
  for (const [color, where] of offPalette) {
    if (i++ >= 10) { out.push(`… and ${offPalette.size - 10} more colors outside the palette`); break; }
    out.push(`color outside the palette ${color}: ${where}`);
  }
  return out;
}
