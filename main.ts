// Trophy Atlas packager. Reads the trophy data, refuses anything malformed, then copies
// app/ and screenshots/ into the output directory and writes a dossier.json summary.
// Node built-ins only; run with: MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(new URL(import.meta.url)));
const DATA_FILE = join(ROOT, 'app', 'data', 'trophies.json');
const SCREENSHOTS_DIR = join(ROOT, 'screenshots');
const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144;
const GRADES = ['platinum', 'gold', 'silver', 'bronze'] as const;

type Grade = (typeof GRADES)[number];

interface Trophy {
  id: number;
  name: string;
  description: string;
  grade: string;
  guide: string;
  steps: string[];
  hint: string;
  verification: string;
  hours: number;
  [key: string]: unknown;
}

interface TrophyData {
  game: string;
  platform: string;
  phases: Array<{ id: string; name: string; goal?: string; about?: string; trophies: number[] }>;
  trophies: Trophy[];
}

interface Screenshot {
  file: string;
  bytes: number;
}

function fail(message: string): never {
  console.error('refusing to package: ' + message);
  process.exit(1);
}

function countSentences(text: string): number {
  return (text.replace(/\.\.\./g, '…').match(/[.!?…](\s|$)/g) ?? []).length;
}

// Reads and fully validates the trophy data before anything is copied anywhere.
function readTrophies(): TrophyData {
  let raw: string;
  try {
    raw = readFileSync(DATA_FILE, 'utf8');
  } catch (err) {
    fail('cannot read ' + DATA_FILE + ' (' + (err as Error).message + ')');
  }
  let data: TrophyData;
  try {
    data = JSON.parse(raw) as TrophyData;
  } catch (err) {
    fail('invalid JSON in trophies.json (' + (err as Error).message + ')');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.trophies)) {
    fail('trophies.json has no trophies array');
  }
  const ids = new Set<number>();
  for (const t of data.trophies) {
    const label = 'trophy ' + (typeof t.id === 'number' ? 't' + t.id : JSON.stringify(t.id ?? t));
    if (!Number.isInteger(t.id) || (t.id as number) < 1) fail(label + ': missing or invalid id');
    if (ids.has(t.id)) fail(label + ': duplicate id');
    ids.add(t.id);
    if (typeof t.name !== 'string' || !t.name.trim()) fail(label + ': missing name');
    if (typeof t.description !== 'string' || !t.description.trim()) fail(label + ': missing description');
    if (typeof t.grade !== 'string' || !(GRADES as readonly string[]).includes(t.grade)) {
      fail(label + ': missing or unknown grade ' + JSON.stringify(t.grade));
    }
    if (!Array.isArray(t.steps) || t.steps.length < 3 || t.steps.some((s) => typeof s !== 'string' || !s.trim())) {
      fail(label + ': guide steps missing or fewer than 3');
    }
    if (typeof t.guide !== 'string' || countSentences(t.guide) < 3) {
      fail(label + ': guide paragraph has fewer than 3 sentences');
    }
    if (typeof t.hint !== 'string' || !t.hint.trim()) fail(label + ': missing hint');
    if (typeof t.verification !== 'string' || !t.verification.trim()) fail(label + ': missing verification');
    if (typeof t.hours !== 'number' || t.hours < 0) fail(label + ': missing or invalid hours');
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) fail('trophies.json has no phases');
  for (const p of data.phases) {
    if (typeof p.id !== 'string' || !Array.isArray(p.trophies)) fail('phase ' + JSON.stringify(p.id) + ': missing id or trophies');
    for (const id of p.trophies) if (!ids.has(id)) fail('phase ' + p.id + ': unknown trophy t' + id);
  }
  return data;
}

// Screenshots are evidence, not product: count and size limits are enforced before copying.
function readScreenshots(): Screenshot[] {
  let files: string[];
  try {
    files = readdirSync(SCREENSHOTS_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  } catch (err) {
    fail('cannot read screenshots directory (' + (err as Error).message + ')');
  }
  if (files.length > MAX_SCREENSHOTS) {
    fail('screenshots directory has ' + files.length + ' images; more than ' + MAX_SCREENSHOTS + ' is not allowed');
  }
  return files.map((file) => {
    const bytes = statSync(join(SCREENSHOTS_DIR, file)).size;
    if (bytes > MAX_SCREENSHOT_BYTES) {
      fail(file + ' is ' + bytes + ' bytes; over the ' + MAX_SCREENSHOT_BYTES + '-byte limit');
    }
    return { file, bytes };
  });
}

// The summary contract for dossier.json: grade counts, hour estimate, screenshot manifest.
function buildDossier(data: TrophyData, screenshots: Screenshot[]) {
  const counts: Record<Grade, number> = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of data.trophies) counts[t.grade as Grade]++;
  const estimatedHours = Math.round(data.trophies.reduce((sum, t) => sum + (t.hours as number), 0) * 100) / 100;
  return {
    game: data.game,
    platform: data.platform,
    trophies: data.trophies.length,
    phases: data.phases.length,
    countsByGrade: counts,
    estimatedTotalHours: estimatedHours,
    screenshots: screenshots.map((s) => ({ file: s.file, bytes: s.bytes })),
    generatedFrom: 'app/data/trophies.json',
  };
}

const outputDir = resolve(ROOT, process.env.MAKEFUN_OUTPUT_DIR || 'out');
const data = readTrophies();
const screenshots = readScreenshots();

mkdirSync(outputDir, { recursive: true });
cpSync(join(ROOT, 'app'), join(outputDir, 'app'), { recursive: true });
cpSync(SCREENSHOTS_DIR, join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(data, screenshots);
writeFileSync(join(outputDir, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n', 'utf8');

const gradeLine = GRADES.map((g) => g + ' ' + dossier.countsByGrade[g]).join(', ');
console.log('packaged ' + dossier.trophies + ' trophies (' + gradeLine + ')');
console.log('phases ' + dossier.phases + ', estimated total hours \u2248 ' + dossier.estimatedTotalHours);
console.log('screenshots found: ' + (screenshots.length ? screenshots.map((s) => s.file).join(', ') : 'none'));
console.log('output: ' + outputDir);
