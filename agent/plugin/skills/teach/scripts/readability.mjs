#!/usr/bin/env node
// Flesch-Kincaid grade of the prose in a lesson or reference page, plus possible
// ASD-STE100 problems (long sentences, -ing words, passive voice, contractions).
// Usage: node readability.mjs <file.html> [--target <grade>] [--json]
// Reads the text inside <main>, skipping scripts, styles, SVG, code, formulas and inputs.
import fs from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--target");
const target = args.includes("--target") ? Number(args[args.indexOf("--target") + 1]) : null;
const asJson = args.includes("--json");
if (!file) {
  console.error("Usage: node readability.mjs <file.html> [--target <grade>] [--json]");
  process.exit(2);
}

let html = fs.readFileSync(file, "utf8");
const main = html.match(/<main[\s\S]*?<\/main>/i);
if (main) html = main[0];

const text = html
  .replace(/<(script|style|svg|pre|code|textarea|select|template)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<(div|p|span)\b[^>]*class="[^"]*\b(formula|math|meta|count|score)\b[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, " ")
  .replace(/<\/(p|li|h[1-6]|figcaption|summary|td|th|button|label|div|section)>/gi, ". ")
  .replace(/<br\s*\/?>/gi, ". ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&[a-z]+;|&#\d+;/gi, " ")
  .replace(/\s+/g, " ");

// Split into sentences; drop fragments with fewer than 3 words (labels, buttons, captions).
const sentences = text
  .split(/(?<=[.!?])\s+|\.\s*\./)
  .map((s) => s.replace(/^[\s.]+|[\s]+$/g, ""))
  .filter((s) => words(s).length >= 3);

function words(s) {
  return s.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
}

function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

const stats = sentences.map((s) => {
  const w = words(s);
  const syl = w.reduce((n, x) => n + syllables(x), 0);
  return { s, words: w.length, syl, grade: 0.39 * w.length + 11.8 * (syl / w.length) - 15.59 };
});

// STE flags. These are heuristics: a technical term (for example "string") can be a false flag.
const ING_OK = new Set(["thing", "things", "nothing", "something", "anything", "everything", "during",
  "string", "strings", "spring", "springs", "ring", "rings", "king", "wing", "wings", "bring", "sing",
  "swing", "sting", "ceiling", "morning", "evening", "building", "buildings", "bearing", "bearings",
  "spelling", "meaning", "meanings", "setting", "settings", "heading", "headings", "warning", "warnings"]);
const PASSIVE = /\b(is|are|was|were|be|been|being|gets|got)\s+(\w+ly\s+)?(\w+ed|made|done|given|shown|known|seen|taken|thrown|drawn|written|found|kept|held|left|set|put|split)\b/i;
const CONTRACTION = /\b\w+(n['’]t|['’](ll|re|ve|d|m))\b|\b(it|that|there|here|what|who|he|she|let)['’]s\b/i;
const ste = [];
for (const x of stats) {
  const why = [];
  if (x.words > 25) why.push(`${x.words} words`);
  const ing = words(x.s).filter((w) => /ing$/i.test(w) && w.length > 4 && !ING_OK.has(w.toLowerCase()));
  if (ing.length) why.push(`-ing: ${[...new Set(ing)].join(", ")}`);
  const pas = x.s.match(PASSIVE);
  if (pas) why.push(`passive? "${pas[0]}"`);
  const con = x.s.match(CONTRACTION);
  if (con) why.push(`contraction: ${con[0]}`);
  if (why.length) ste.push({ why: why.join("; "), sentence: x.s });
}

const totalWords = stats.reduce((n, x) => n + x.words, 0);
const totalSyl = stats.reduce((n, x) => n + x.syl, 0);
if (!totalWords) {
  console.log("No prose found.");
  process.exit(0);
}
const grade = 0.39 * (totalWords / stats.length) + 11.8 * (totalSyl / totalWords) - 15.59;
const hardest = [...stats].sort((a, b) => b.grade - a.grade).slice(0, 6);
const over = target != null && grade > target + 1;

if (asJson) {
  console.log(JSON.stringify({
    grade: +grade.toFixed(1), target, over, sentences: stats.length, words: totalWords,
    wordsPerSentence: +(totalWords / stats.length).toFixed(1),
    hardest: hardest.map((x) => ({ grade: +x.grade.toFixed(1), words: x.words, sentence: x.s })),
    ste,
  }, null, 2));
} else {
  console.log(`Flesch-Kincaid grade: ${grade.toFixed(1)}${target != null ? ` (target ${target})` : ""}`);
  console.log(`${stats.length} sentences, ${totalWords} words, ${(totalWords / stats.length).toFixed(1)} words per sentence`);
  if (target != null) console.log(over ? "Above target: edit the hardest sentences below." : "Within target.");
  console.log("\nHardest sentences:");
  for (const x of hardest) console.log(`  [${x.grade.toFixed(1)}, ${x.words} words] ${x.s}`);
  console.log(`\nPossible STE problems: ${ste.length}${ste.length ? " (a technical term may be a false flag)" : ""}`);
  for (const x of ste) console.log(`  [${x.why}] ${x.sentence}`);
}
process.exit(over ? 1 : 0);
