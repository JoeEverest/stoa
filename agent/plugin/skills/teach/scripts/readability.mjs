#!/usr/bin/env node
// Flesch-Kincaid grade of the prose in a lesson or reference page, plus places where the prose
// may sound stiff: full forms where a contraction is natural, manual wording, very long
// sentences, and runs of very short sentences.
// Usage: node readability.mjs <file.html | script.txt> [--target <grade>] [--json]
// Reads the text inside <main>, skipping scripts, styles, SVG, code, formulas and inputs.
// A plain text file (a video script) is read as it is.
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

// Exercise panels are marked, so their prompts and option labels do not count as a choppy run.
html = html.replace(/<section\b[^>]*class="[^"]*\bexercise\b[\s\S]*?<\/section>/gi, (m) => ` \u27e6. ${m} \u27e7. `);

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
  .filter((s) => words(s).length >= 3 || /[\u27e6\u27e7]/.test(s));

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

let inExercise = false;
const stats = sentences.map((raw) => {
  if (raw.includes("\u27e6")) inExercise = true;
  const exercise = inExercise;
  if (raw.includes("\u27e7")) inExercise = false;
  const s = raw.replace(/[\u27e6\u27e7]\.?/g, "").trim();
  const w = words(s);
  if (w.length < 3) return null;
  const syl = w.reduce((n, x) => n + syllables(x), 0);
  return { s, exercise, words: w.length, syl, grade: 0.39 * w.length + 11.8 * (syl / w.length) - 15.59 };
}).filter(Boolean);

// Stiffness flags. These are places to read aloud, not errors: a full form can carry stress.
const FULL_FORM = /\b(do not|does not|did not|cannot|can not|will not|would not|should not|is not|are not|was not|were not|have not|has not|it is|that is|there is|here is|what is|let us|you will|we will|you have|we have|you are|we are|they are|i am)\b/gi;
const MANUAL = /\b(one time|two times|thus|hence|therefore|in order to|prior to|utili[sz]e[sd]?|commence[sd]?|shall)\b/gi;
const flags = [];
const uniq = (m) => [...new Set((m ?? []).map((x) => x.toLowerCase()))].join(", ");
for (const x of stats) {
  const why = [];
  if (x.words > 35) why.push(`${x.words} words`);
  const full = x.s.match(FULL_FORM);
  if (full) why.push(`full form: ${uniq(full)}`);
  const man = x.s.match(MANUAL);
  if (man) why.push(`manual wording: ${uniq(man)}`);
  if (why.length) flags.push({ why: why.join("; "), sentence: x.s });
}
// A run of four or more sentences of eight words or fewer sounds like a list read aloud.
for (let i = 0; i < stats.length; ) {
  let j = i;
  while (j < stats.length && stats[j].words <= 8 && !stats[j].exercise) j++;
  if (j - i >= 4) flags.push({ why: `${j - i} short sentences in a row`, sentence: stats.slice(i, j).map((x) => x.s).join(" ") });
  i = Math.max(j, i + 1);
}
const contractions = (text.match(/\b\w+(n['’]t|['’](ll|re|ve|d|m|s))\b/gi) ?? []).length;

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
    contractions,
    flags,
  }, null, 2));
} else {
  console.log(`Flesch-Kincaid grade: ${grade.toFixed(1)}${target != null ? ` (target ${target})` : ""}`);
  console.log(`${stats.length} sentences, ${totalWords} words, ${(totalWords / stats.length).toFixed(1)} words per sentence`);
  if (target != null) console.log(over ? "Above target: edit the hardest sentences below." : "Within target.");
  console.log("\nHardest sentences:");
  for (const x of hardest) console.log(`  [${x.grade.toFixed(1)}, ${x.words} words] ${x.s}`);
  console.log(`\nMay sound stiff: ${flags.length}${flags.length ? " (read each one aloud; keep a full form that carries stress)" : ""}. Contractions used: ${contractions}`);
  for (const x of flags) console.log(`  [${x.why}] ${x.sentence}`);
}
process.exit(over ? 1 : 0);
