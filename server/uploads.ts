// Files the learner adds to a topic (lecture notes, slides, textbooks). Athena reads them and
// teaches from them. Originals go to uploads/; for Word and PowerPoint files, which the agent can
// not read, the server also writes a Markdown text version and the files' images to uploads/text/.
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { inflateRawSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { Uploads, type Upload } from "./db.ts";
import { resolveInTopic, topicDir } from "./paths.ts";

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Extensions Stoa accepts, and the kind shown to the agent. */
const KINDS: Record<string, string> = {
  ".pdf": "PDF", ".docx": "Word document", ".pptx": "PowerPoint slides",
  ".txt": "text", ".md": "Markdown", ".csv": "CSV table",
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image", ".gif": "image",
};
export const ACCEPT = Object.keys(KINDS).join(",");

/** Formats that need an export first, with the reason shown to the learner. */
const EXPORT_FIRST: Record<string, string> = {
  ".doc": "Word 97-2003", ".ppt": "PowerPoint 97-2003", ".key": "Keynote", ".pages": "Pages",
  ".odt": "OpenDocument", ".odp": "OpenDocument", ".epub": "EPUB", ".rtf": "RTF",
};

export class UploadError extends Error {
  readonly status: 400 | 413;
  constructor(message: string, status: 400 | 413 = 400) { super(message); this.status = status; }
}

const SAFE = /[^A-Za-z0-9._-]+/g;

/** A file name that is safe on disk and in a URL, unique in the folder. */
function uniqueName(dir: string, original: string) {
  const ext = path.extname(original).toLowerCase();
  const stem = path.basename(original, path.extname(original)).replace(SAFE, "-").replace(/-{2,}/g, "-").replace(/^[-.]+|-+$/g, "").slice(0, 80) || "file";
  let name = `${stem}${ext}`;
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stem}-${n}${ext}`;
  return name;
}

export function checkName(original: string) {
  const ext = path.extname(original).toLowerCase();
  if (KINDS[ext]) return;
  if (EXPORT_FIRST[ext]) {
    throw new UploadError(`Stoa can not read ${EXPORT_FIRST[ext]} files. Save "${original}" as a PDF, then add the PDF.`);
  }
  throw new UploadError(`Stoa can not read "${original}". Add a PDF, Word (.docx), PowerPoint (.pptx), text or image file.`);
}

/** Write the request body to uploads/, make a text version if needed, and record it. */
export async function saveUpload(topicId: string, original: string, body: ReadableStream<Uint8Array> | null) {
  checkName(original);
  if (!body) throw new UploadError("The file is empty.");
  const dir = resolveInTopic(topicId, "uploads")!;
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.incoming-${randomBytes(6).toString("hex")}`);
  let size = 0;
  const count = new Transform({
    transform(chunk, _enc, done) {
      size += chunk.length;
      done(size > MAX_UPLOAD_BYTES ? new UploadError("The file is larger than 500 MB.", 413) : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as any), count, fs.createWriteStream(temp));
    if (size === 0) throw new UploadError("The file is empty.");
  } catch (err) {
    fs.rmSync(temp, { force: true });
    throw err;
  }
  const name = uniqueName(dir, original);
  fs.renameSync(temp, path.join(dir, name));
  const file = `uploads/${name}`;

  let textFile: string | null = null;
  let problem: string | null = null;
  const ext = path.extname(name);
  if (ext === ".docx" || ext === ".pptx") {
    try {
      textFile = writeTextVersion(topicId, name, original);
    } catch (err) {
      problem = `Stoa could not take the text out of this file (${err instanceof Error ? err.message : err}). ` +
        `A PDF export of it would work.`;
      console.warn(`[upload] ${topicId}/${file}:`, problem);
    }
  }
  const id = Uploads.add(topicId, { file, name: original, size, textFile, problem });
  return Uploads.get(topicId, id)!;
}

export function deleteUpload(topicId: string, u: Upload) {
  const stem = path.basename(u.file, path.extname(u.file));
  for (const rel of [u.file, u.text_file, `uploads/text/${stem}-media`]) {
    const abs = rel && resolveInTopic(topicId, rel);
    if (abs && abs.startsWith(path.join(topicDir(topicId), "uploads") + path.sep)) fs.rmSync(abs, { recursive: true, force: true });
  }
  Uploads.remove(topicId, u.id);
}

// ---- What the agents see ----

const formatSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function howToRead(u: Upload) {
  const ext = path.extname(u.file).toLowerCase();
  if (u.text_file) return `Read ${u.text_file}: the text and the images of the file, in order. Images are listed by path; read the ones that matter.`;
  if (u.problem) return u.problem;
  if (ext === ".pdf") return "Read it with the Read tool. Give the pages parameter (at most 20 pages for each call); long PDFs need it.";
  return "Read it with the Read tool.";
}

export function uploadInfo(u: Upload) {
  return {
    id: u.id, name: u.name, file: u.file, kind: KINDS[path.extname(u.file).toLowerCase()] ?? "file",
    size: formatSize(u.size), added: u.created_at, read: !!u.read_at, summary: u.summary, how_to_read: howToRead(u),
  };
}

/** A block for a teacher prompt when the learner added files Athena has not read. Empty if none. */
export function uploadsNotice(topicId: string) {
  const unread = Uploads.unread(topicId);
  if (!unread.length) return "";
  const lines = unread.map((u) => `- ${u.file} ("${u.name}", ${KINDS[path.extname(u.file).toLowerCase()] ?? "file"}, ${formatSize(u.size)})`);
  return `\n\n<uploads>\nThe learner added files for you to teach from. You have not read them yet:\n${lines.join("\n")}\n` +
    `Follow the teach skill's MATERIALS.md: read and map each one, then call mcp__learn__mark_upload_read.\n</uploads>`;
}

/** A steering message for a teacher run that is working when the learner adds files. */
export function uploadsSteer(fresh: Upload[]) {
  const lines = fresh.map((u) => `- ${u.file} ("${u.name}", ${KINDS[path.extname(u.file).toLowerCase()] ?? "file"}, ${formatSize(u.size)})`);
  return `<uploads>\nThe learner just added ${fresh.length === 1 ? "a file" : "files"} while you work:\n${lines.join("\n")}\n\n` +
    `At the next good point in your work (not in the middle of a render or an edit), read and map ${fresh.length === 1 ? "it" : "them"} ` +
    `as the teach skill's MATERIALS.md describes, and call mcp__learn__mark_upload_read.\n` +
    `- In the intake chat: use the files in your next reply and questions.\n` +
    `- Lesson not published yet: change it where the files show your plan was wrong for the learner's course ` +
    `(its order, terms, notation or level). Do not start again from the beginning.\n` +
    `- Lesson already published: do not rebuild it. Finish your current work, and write in NOTES.md how the ` +
    `files change the next lessons.\n</uploads>`;
}

// ---- Word and PowerPoint to Markdown ----

/** The entries of a zip file, read on demand. Enough for Office files (no zip64, no encryption). */
function readZip(buf: Buffer) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a valid Office file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map<string, () => Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("damaged file");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const rawSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.set(name, () => {
      if (rawSize > 200 * 1024 * 1024) throw new Error(`${name} is too large`);
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data, { maxOutputLength: Math.max(rawSize, 1) });
      throw new Error(`unsupported compression in ${name}`);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const text = (name: string) => entries.get(name)?.().toString("utf8") ?? null;
  return { entries, text };
}
type Zip = ReturnType<typeof readZip>;

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()]);

/** Relationship ID -> part path in the zip, for the part at `partPath`. */
function readRels(zip: Zip, partPath: string) {
  const dir = path.posix.dirname(partPath);
  const xml = zip.text(path.posix.join(dir, "_rels", path.posix.basename(partPath) + ".rels")) ?? "";
  const rels = new Map<string, { target: string; type: string }>();
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1];
    const target = m[0].match(/\bTarget="([^"]+)"/)?.[1];
    const type = m[0].match(/\bType="([^"]+)"/)?.[1] ?? "";
    if (!id || !target || /TargetMode="External"/.test(m[0])) continue;
    const t = decode(target);
    rels.set(id, { target: t.startsWith("/") ? t.slice(1) : path.posix.normalize(path.posix.join(dir, t)), type });
  }
  return rels;
}

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

/** Copies images out of the zip into the media folder; returns the workspace path of each. */
function mediaWriter(zip: Zip, topicId: string, mediaRel: string) {
  const written = new Map<string, string | null>();
  return (part: string) => {
    if (written.has(part)) return written.get(part)!;
    let out: string | null = null;
    const read = zip.entries.get(part);
    if (read && IMAGE.test(part)) {
      const abs = resolveInTopic(topicId, mediaRel)!;
      fs.mkdirSync(abs, { recursive: true });
      const name = path.posix.basename(part);
      fs.writeFileSync(path.join(abs, name), read());
      out = `${mediaRel}/${name}`;
    }
    written.set(part, out);
    return out;
  };
}

function docxToMarkdown(zip: Zip, saveImage: (part: string) => string | null) {
  const doc = "word/document.xml";
  const xml = zip.text(doc);
  if (!xml) throw new Error("no document text found");
  const rels = readRels(zip, doc);
  const out: string[] = [];
  for (const [p] of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? "";
    const heading = style === "Title" ? 2 : Number(style.match(/^Heading(\d)$/i)?.[1] ?? -2) + 2;
    let text = "";
    const images: string[] = [];
    for (const t of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\/>|r:embed="([^"]+)"/g)) {
      if (t[1] !== undefined) text += decode(t[1]);
      else if (t[2]) { const img = rels.get(t[2]); const at = img && saveImage(img.target); if (at) images.push(at); }
      else text += t[0].startsWith("<w:tab") ? "\t" : "\n";
    }
    text = text.trim();
    const listItem = /<w:numPr>/.test(p) || /^List/i.test(style);
    if (text) out.push(heading ? `${"#".repeat(Math.min(heading, 6))} ${text}` : listItem ? `- ${text}` : text);
    for (const img of images) out.push(`[Image: ${img}]`);
  }
  return out.join("\n\n");
}

/** Text of a slide or notes part: one entry per shape, the title shape marked. */
function shapes(xml: string) {
  const result: { title: boolean; lines: string[] }[] = [];
  for (const [sp] of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>|<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g)) {
    const ph = sp.match(/<p:ph\b[^>]*type="([^"]+)"/)?.[1];
    if (ph === "sldNum" || ph === "sldImg" || ph === "dt" || ph === "ftr") continue;
    const lines: string[] = [];
    for (const [para] of sp.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)) {
      const t = [...para.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1])).join("").trim();
      if (t) lines.push(t);
    }
    if (lines.length) result.push({ title: ph === "title" || ph === "ctrTitle", lines });
  }
  return result;
}

function pptxToMarkdown(zip: Zip, saveImage: (part: string) => string | null) {
  const pres = "ppt/presentation.xml";
  const xml = zip.text(pres);
  if (!xml) throw new Error("no slides found");
  const rels = readRels(zip, pres);
  const slides = [...xml.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => rels.get(m[1])?.target).filter(Boolean) as string[];
  const out: string[] = [];
  slides.forEach((part, i) => {
    const sx = zip.text(part);
    if (!sx) return;
    const srels = readRels(zip, part);
    const parts = shapes(sx);
    const title = parts.find((s) => s.title)?.lines.join(" ");
    out.push(`## Slide ${i + 1}${title ? `: ${title}` : ""}`);
    for (const s of parts) if (!s.title) out.push(s.lines.map((l) => `- ${l}`).join("\n"));
    for (const [, id] of sx.matchAll(/r:embed="([^"]+)"/g)) {
      const at = srels.get(id) && saveImage(srels.get(id)!.target);
      if (at) out.push(`[Image: ${at}]`);
    }
    const notesPart = [...srels.values()].find((r) => r.type.endsWith("/notesSlide"))?.target;
    const notes = notesPart && zip.text(notesPart);
    if (notes) {
      const text = shapes(notes).flatMap((s) => s.lines).join("\n");
      if (text) out.push(`Speaker notes:\n\n${text}`);
    }
  });
  if (!slides.length) throw new Error("no slides found");
  return out.join("\n\n");
}

/** Write uploads/text/<stem>.md (and <stem>-media/) for a .docx or .pptx. Returns its workspace path. */
function writeTextVersion(topicId: string, name: string, original: string) {
  const stem = path.basename(name, path.extname(name));
  const zip = readZip(fs.readFileSync(resolveInTopic(topicId, `uploads/${name}`)!));
  const saveImage = mediaWriter(zip, topicId, `uploads/text/${stem}-media`);
  const body = name.endsWith(".pptx") ? pptxToMarkdown(zip, saveImage) : docxToMarkdown(zip, saveImage);
  if (!body.trim()) throw new Error("the file has no text");
  const rel = `uploads/text/${stem}.md`;
  const abs = resolveInTopic(topicId, rel)!;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs,
    `# ${original}\n\n` +
    `Text and images that Stoa took from uploads/${name}. Layout, charts and drawn shapes are not here; ` +
    `equations may be missing if the file shows them as images.\n\n${body}\n`);
  return rel;
}
