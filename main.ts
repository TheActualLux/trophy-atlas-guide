// gta6-trophy-guide-01 entry (Node 22+, standard library only).
//
// Trophy Atlas: a static single-page GTA VI platinum guide in app/ (ES modules, CSS,
// no build step, no network beyond its own trophies.json). This program hands it in:
// it copies app/ and screenshots/ beside this file to the output directory and writes
// dossier.json via the vendored make.fun library, whose byte output the scorer
// reproduces. Leave vendor/makefun-frontend.ts untouched.
//
// Preflight runs BEFORE any copy or output side effect:
//   - app/data/trophies.json must parse as JSON;
//   - every trophy record must carry id/name/grade/guide (guide at least 3 sentences);
//   - screenshots/ holds at most 4 images (JPEG/PNG), each at most 262144 bytes.
// Serve locally with `node serve.ts [--port n]`.
// Outside the grader's container:  MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144; // 256 KiB
const MIN_GUIDE_SENTENCES = 3;

function fail(message) {
  console.error(`preflight: ${message}`);
  process.exit(1);
}

function countSentences(text) {
  return text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0).length;
}

function preflight() {
  // 1. The trophy data must parse and satisfy the guide's schema.
  const dataPath = join(here, 'app', 'data', 'trophies.json');
  let doc;
  try {
    doc = JSON.parse(readFileSync(dataPath, 'utf8'));
  } catch (err) {
    fail(`app/data/trophies.json is not valid JSON (${err.message})`);
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) fail('app/data/trophies.json: not a JSON object');
  if (!Array.isArray(doc.trophies)) fail('app/data/trophies.json: missing "trophies" array');
  if (doc.trophies.length === 0) fail('app/data/trophies.json: "trophies" is empty');
  const seen = new Set();
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of doc.trophies) {
    if (t === null || typeof t !== 'object' || Array.isArray(t)) fail('app/data/trophies.json: a trophy record is not an object');
    for (const key of ['id', 'name', 'grade', 'guide']) {
      if (!(key in t)) fail(`app/data/trophies.json: trophy record missing "${key}"`);
    }
    if (!Number.isInteger(t.id) || t.id < 1) fail(`trophy: id is not a positive integer (${JSON.stringify(t.id)})`);
    if (seen.has(t.id)) fail(`trophy ${t.id}: duplicate id`);
    seen.add(t.id);
    if (typeof t.name !== 'string' || t.name.trim() === '') fail(`trophy ${t.id}: "name" is not a non-empty string`);
    if (typeof t.grade !== 'string' || !GRADES.includes(t.grade)) fail(`trophy ${t.id}: grade is not one of ${GRADES.join(', ')}`);
    if (typeof t.guide !== 'string' || t.guide.trim() === '') fail(`trophy ${t.id}: "guide" is empty`);
    const sentences = countSentences(t.guide);
    if (sentences < MIN_GUIDE_SENTENCES) fail(`trophy ${t.id}: guide has ${sentences} sentence(s), fewer than the ${MIN_GUIDE_SENTENCES} the guide contract requires`);
    counts[t.grade] += 1;
  }
  return { counts, total: doc.trophies.length };
}

function preflightScreenshots() {
  // 2. Screenshots must exist, be images, and stay under the scorer's caps —
  //    checked (and their bytes read) before anything is copied out.
  const dir = join(here, 'screenshots');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail('screenshots/: no such directory');
  const images = [];
  for (const name of readdirSync(dir)) {
    const dot = name.lastIndexOf('.');
    if (dot < 0 || !IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase())) continue;
    const path = join(dir, name);
    const stats = statSync(path);
    if (!stats.isFile()) continue;
    if (stats.size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshots/${name} is ${stats.size} bytes, over the ${MAX_SCREENSHOT_BYTES} cap`);
    }
    images.push({ name, bytes: readFileSync(path).length });
    if (images.length > MAX_SCREENSHOTS) {
      fail(`screenshots/ holds more than ${MAX_SCREENSHOTS} images`);
    }
  }
  if (images.length === 0) fail('screenshots/: no PNG or JPEG image found');
  if (images.length > MAX_SCREENSHOTS) fail(`screenshots/ holds ${images.length} images, more than the ${MAX_SCREENSHOTS} cap`);
  return images;
}

const { counts, total } = preflight();
const images = preflightScreenshots();

// Side effects only after both preflights pass.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);

const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`trophy counts (${total} total): platinum ${counts.platinum}, gold ${counts.gold}, silver ${counts.silver}, bronze ${counts.bronze}`);
console.log(`screenshots found: ${images.length} (${images.map((i) => `${i.name} ${i.bytes}B`).join(', ')})`);
console.log(`dossier.json written: ${dossierBytes} bytes`);
