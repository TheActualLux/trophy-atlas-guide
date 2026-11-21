// Validate the authored trophy guide, then package its static app and screenshot evidence.
// Run with: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = dirname(fileURLToPath(import.meta.url));
const dataPath = join(root, 'app', 'data', 'trophies.json');
const imageFolder = join(root, 'screenshots');
const validGrades = new Set(['platinum', 'gold', 'silver', 'bronze']);
const imageLimit = 262144;

function refuse(reason: string): never {
  console.error(`Build refused: ${reason}`);
  process.exit(1);
}

function requireText(value: unknown, where: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) refuse(`${where} must be non-empty text`);
}

function sentenceCount(value: string): number {
  return (value.replace(/\.\.\./g, '…').match(/[.!?…](?=\s|$)/g) ?? []).length;
}

function validateTrophies(): any {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(dataPath, 'utf8'));
  } catch (error) {
    refuse(`cannot read valid JSON from app/data/trophies.json (${(error as Error).message})`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).trophies)) {
    refuse('app/data/trophies.json must contain a trophies array');
  }
  const data = parsed as { phases?: unknown; trophies: any[] };
  if (data.trophies.length !== 55) refuse(`expected 55 trophies, found ${data.trophies.length}`);
  const knownIds = new Set<number>();
  for (const trophy of data.trophies) {
    const label = `trophy ${String(trophy?.id ?? '?')}`;
    if (!Number.isInteger(trophy?.id) || trophy.id < 1 || trophy.id > 55) refuse(`${label} has an invalid ID`);
    if (knownIds.has(trophy.id)) refuse(`${label} repeats an ID`);
    knownIds.add(trophy.id);
    requireText(trophy.name, `${label} name`);
    requireText(trophy.description, `${label} description`);
    if (!validGrades.has(trophy.grade)) refuse(`${label} has an invalid grade`);
    if (!Array.isArray(trophy.tags) || trophy.tags.some((tag: unknown) => typeof tag !== 'string' || !tag.trim())) refuse(`${label} needs non-empty tags`);
    if (!Number.isInteger(trophy.difficulty) || trophy.difficulty < 1 || trophy.difficulty > 5) refuse(`${label} difficulty must be 1–5`);
    if (typeof trophy.hours !== 'number' || !Number.isFinite(trophy.hours) || trophy.hours < 0) refuse(`${label} has an invalid time estimate`);
    requireText(trophy.missable, `${label} missable note`);
    requireText(trophy.requires, `${label} prerequisites`);
    if (!Array.isArray(trophy.steps) || trophy.steps.length < 3) refuse(`${label} needs at least three numbered steps`);
    for (const [index, step] of trophy.steps.entries()) requireText(step, `${label} step ${index + 1}`);
    requireText(trophy.guide, `${label} guide`);
    if (sentenceCount(trophy.guide) < 3) refuse(`${label} guide needs at least three sentences`);
    requireText(trophy.hint, `${label} hint`);
    requireText(trophy.verification, `${label} verification`);
    if (!Array.isArray(trophy.sources) || trophy.sources.length === 0) refuse(`${label} needs at least one source`);
    for (const [index, source] of trophy.sources.entries()) requireText(source, `${label} source ${index + 1}`);
    requireText(trophy.phase, `${label} phase`);
  }
  if (!Array.isArray(data.phases) || data.phases.length !== 8) refuse('the route must have exactly eight phases');
  const placements: number[] = [];
  const phaseIds = new Set<string>();
  for (const [index, phase] of (data.phases as any[]).entries()) {
    requireText(phase?.id, `phase ${index + 1} id`);
    requireText(phase?.name, `phase ${index + 1} name`);
    requireText(phase?.goal, `phase ${index + 1} objective`);
    requireText(phase?.about, `phase ${index + 1} route note`);
    if (phaseIds.has(phase.id)) refuse(`phase ${phase.id} repeats an ID`);
    phaseIds.add(phase.id);
    if (!Array.isArray(phase.trophies) || phase.trophies.length === 0) refuse(`phase ${phase.id} has no trophies`);
    for (const id of phase.trophies) {
      if (!knownIds.has(id)) refuse(`phase ${phase.id} refers to unknown trophy ${String(id)}`);
      placements.push(id);
    }
  }
  if (placements.length !== 55 || new Set(placements).size !== 55) refuse('each trophy must appear in exactly one route phase');
  for (const trophy of data.trophies) if (!phaseIds.has(trophy.phase)) refuse(`trophy ${trophy.id} refers to unknown phase ${trophy.phase}`);
  return data;
}

function validateScreenshots(): Array<{ name: string; size: number }> {
  let names: string[];
  try {
    names = readdirSync(imageFolder).filter((name) => /\.(?:png|jpe?g)$/i.test(name)).sort();
  } catch (error) {
    refuse(`cannot read screenshots directory (${(error as Error).message})`);
  }
  if (names.length < 3 || names.length > 4) refuse(`screenshots must contain 3–4 PNG/JPEG images; found ${names.length}`);
  return names.map((name) => {
    const size = statSync(join(imageFolder, name)).size;
    if (size > imageLimit) refuse(`${name} is ${size} bytes; maximum is ${imageLimit}`);
    return { name, size };
  });
}

const data = validateTrophies();
const screenshots = validateScreenshots();
const outputDir = resolve(root, process.env.MAKEFUN_OUTPUT_DIR || 'out');
mkdirSync(outputDir, { recursive: true });
cpSync(join(root, 'app'), join(outputDir, 'app'), { recursive: true });
cpSync(imageFolder, join(outputDir, 'screenshots'), { recursive: true });

const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);

const grades = Object.fromEntries([...validGrades].map((grade) => [grade, data.trophies.filter((trophy: any) => trophy.grade === grade).length]));
const totalHours = data.trophies.reduce((sum: number, trophy: any) => sum + trophy.hours, 0);
console.log(`Packaged ${data.trophies.length} trophies in ${data.phases.length} route phases (${Object.entries(grades).map(([grade, count]) => `${grade} ${count}`).join(', ')}).`);
console.log(`Screenshots: ${screenshots.length}; dossier.json: ${dossierBytes.length} bytes; estimated route total: ${totalHours} hours.`);
console.log(`Output: ${outputDir}`);
