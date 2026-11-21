// Static Trophy Atlas package check. Run from this folder with: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(root, 'app', 'data', 'trophies.json');
const screenshotsPath = join(root, 'screenshots');
const allowedGrades = ['platinum', 'gold', 'silver', 'bronze'];
const screenshotMaxBytes = 262144;

function stop(reason: string): never {
  console.error(`Package check failed: ${reason}`);
  process.exit(1);
}

function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) stop(`${label} is required`);
}

function validateData(): any {
  let data: any;
  try { data = JSON.parse(readFileSync(jsonPath, 'utf8')); }
  catch (error) { stop(`could not parse app/data/trophies.json: ${(error as Error).message}`); }
  if (!data || !Array.isArray(data.trophies) || data.trophies.length !== 55) stop('the trophy list must contain exactly 55 items');
  const ids = new Set<number>();
  for (const trophy of data.trophies) {
    const label = `trophy ${String(trophy?.id ?? '?')}`;
    if (!Number.isInteger(trophy.id) || trophy.id < 1 || trophy.id > 55 || ids.has(trophy.id)) stop(`${label} has an invalid or repeated ID`);
    ids.add(trophy.id);
    text(trophy.name, `${label} name`);
    text(trophy.description, `${label} official description`);
    if (!allowedGrades.includes(trophy.grade)) stop(`${label} has an unknown grade`);
    if (!Array.isArray(trophy.tags) || trophy.tags.length < 1) stop(`${label} needs at least one tag`);
    if (!Number.isInteger(trophy.difficulty) || trophy.difficulty < 1 || trophy.difficulty > 5) stop(`${label} difficulty must be 1–5`);
    if (typeof trophy.hours !== 'number' || !Number.isFinite(trophy.hours) || trophy.hours < 0) stop(`${label} has an invalid time estimate`);
    text(trophy.requires, `${label} prerequisites`);
    text(trophy.missable, `${label} missable note`);
    text(trophy.guide, `${label} guide`);
    text(trophy.hint, `${label} hint`);
    text(trophy.verification, `${label} verification`);
    if (!Array.isArray(trophy.steps) || trophy.steps.length < 5 || trophy.steps.some((step: unknown) => typeof step !== 'string' || !step.trim())) stop(`${label} needs at least five full steps`);
    if (!Array.isArray(trophy.sources) || trophy.sources.length === 0 || trophy.sources.some((source: unknown) => typeof source !== 'string' || !source.trim())) stop(`${label} needs a named source`);
    if (!data.phases?.some((phase: any) => phase.id === trophy.phase)) stop(`${label} uses an unknown route phase`);
  }
  if (!Array.isArray(data.phases) || data.phases.length !== 8) stop('the route must have exactly eight phases');
  const placements: number[] = [];
  for (const phase of data.phases) {
    text(phase.name, 'phase name');
    text(phase.goal, `${phase.name} objective`);
    text(phase.about, `${phase.name} order explanation`);
    if (!Array.isArray(phase.trophies) || phase.trophies.length === 0) stop(`${phase.name} has no trophy IDs`);
    for (const id of phase.trophies) {
      if (!ids.has(id)) stop(`${phase.name} refers to unknown trophy ${String(id)}`);
      placements.push(id);
    }
  }
  if (placements.length !== 55 || new Set(placements).size !== 55) stop('every trophy must appear in exactly one phase');
  return data;
}

function validateScreenshots(): string[] {
  let files: string[];
  try { files = readdirSync(screenshotsPath).filter((name) => /\.(?:png|jpe?g)$/i.test(name)).sort(); }
  catch (error) { stop(`cannot read screenshots/: ${(error as Error).message}`); }
  if (files.length < 3 || files.length > 4) stop(`expected 3–4 PNG/JPEG screenshots, found ${files.length}`);
  for (const file of files) {
    const size = statSync(join(screenshotsPath, file)).size;
    if (size > screenshotMaxBytes) stop(`${file} exceeds ${screenshotMaxBytes} bytes`);
  }
  return files;
}

const data = validateData();
const screenshots = validateScreenshots();
const destination = resolve(root, process.env.MAKEFUN_OUTPUT_DIR || 'out');
mkdirSync(destination, { recursive: true });
cpSync(join(root, 'app'), join(destination, 'app'), { recursive: true });
cpSync(screenshotsPath, join(destination, 'screenshots'), { recursive: true });

const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(destination, 'dossier.json'), dossier);

const totalHours = data.trophies.reduce((sum: number, trophy: any) => sum + trophy.hours, 0);
console.log(`Checked and packaged ${data.trophies.length} trophies across ${data.phases.length} phases.`);
console.log(`${screenshots.length} screenshots · estimated total ${totalHours} hours · dossier ${dossier.length} bytes.`);
console.log(`Output: ${destination}`);
