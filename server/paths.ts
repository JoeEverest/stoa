import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(APP_ROOT, "data"));
export const TOPICS_DIR = path.join(DATA_DIR, "topics");
export const PLUGIN_DIR = path.join(APP_ROOT, "agent", "plugin");
export const WEB_DIST = path.join(APP_ROOT, "dist", "web");

fs.mkdirSync(TOPICS_DIR, { recursive: true });

export function topicDir(topicId: string) {
  return path.join(TOPICS_DIR, topicId);
}

/** Resolve a path inside a topic folder. Returns null if it leaves the folder. */
export function resolveInTopic(topicId: string, rel: string): string | null {
  const root = topicDir(topicId);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

/** "lessons/0001-two-motions.html" -> "0001-two-motions" */
export function lessonIdFromFile(file: string) {
  return path.basename(file).replace(/\.html?$/i, "");
}
